import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CuentaPorPagar, EstadoCxP } from './entities/cuenta-pagar.entity';
import { PagoCxP, MetodoPago } from './entities/pago-cxp.entity';
import { Compra } from '../inventario/compras/entities/compra.entity';
import { Proveedor } from '../inventario/proveedores/entities/proveedor.entity';
import { AplicarPagoDto } from './dto/aplicar-pago.dto';  

@Injectable()
export class CuentasPagarService {
  private readonly logger = new Logger(CuentasPagarService.name);

  constructor(
    @InjectRepository(CuentaPorPagar)
    private cuentaRepo: Repository<CuentaPorPagar>,
    @InjectRepository(PagoCxP)
    private pagoRepo: Repository<PagoCxP>,
    @InjectRepository(Proveedor)
    private proveedorRepo: Repository<Proveedor>,
    private readonly dataSource: DataSource,
  ) {}

  // ═══════════════════════════════════════
  // 1. CREAR CxP DESDE COMPRA A CREDITO
  // ═══════════════════════════════════════
  async crearDesdeCompra(compra: Compra): Promise<CuentaPorPagar> {
    const proveedor = await this.proveedorRepo.findOne({
      where: { id_proveedor: compra.id_proveedor },
    });

    let fechaVencimiento: Date | null = null;
    if (proveedor?.dias_credito && proveedor.dias_credito > 0) {
      fechaVencimiento = new Date(compra.fecha_compra);
      fechaVencimiento.setDate(fechaVencimiento.getDate() + proveedor.dias_credito);
    }

    const cuentaData: Partial<CuentaPorPagar> = {
      id_compra:       compra.id_compra,
      id_proveedor:    compra.id_proveedor,
      id_empresa:      compra.id_empresa,
      num_factura:     compra.num_factura,
      monto_original:  Number(compra.total),
      monto_pagado:    0,
      saldo_pendiente: Number(compra.total),
      estado:          EstadoCxP.PENDIENTE,
    };

    if (fechaVencimiento) {
      cuentaData.fecha_vencimiento = fechaVencimiento;
    }

    const cuenta = this.cuentaRepo.create(cuentaData);
    const saved = await this.cuentaRepo.save(cuenta);
    this.logger.log(`CxP creada para compra ${compra.num_factura} — $${compra.total}`);
    return saved;
  }

  // ═══════════════════════════════════════
  // 2. LISTAR CxP
  // ═══════════════════════════════════════
  async findAll(idEmpresa: string, soloActivas = false) {
    const qb = this.cuentaRepo.createQueryBuilder('cxp')
      .leftJoinAndSelect('cxp.proveedor', 'proveedor')
      .leftJoinAndSelect('cxp.compra', 'compra')
      .leftJoinAndSelect('cxp.pagos', 'pagos')
      .where('cxp.id_empresa = :idEmpresa', { idEmpresa });

    if (soloActivas) {
      qb.andWhere('cxp.estado IN (:...estados)', {
        estados: [EstadoCxP.PENDIENTE, EstadoCxP.PARCIAL],
      });
    }

    return qb
      .orderBy('cxp.fecha_vencimiento', 'ASC')
      .addOrderBy('cxp.created_at', 'DESC')
      .getMany();
  }

  // ═══════════════════════════════════════
  // 3. DETALLE
  // ═══════════════════════════════════════
  async findOne(idCuenta: string) {
    const cuenta = await this.cuentaRepo.findOne({
      where: { id_cuenta: idCuenta },
      relations: ['proveedor', 'compra', 'pagos'],
    });
    if (!cuenta) throw new NotFoundException('Cuenta por pagar no encontrada');
    return cuenta;
  }

  // ═══════════════════════════════════════
  // 4. APLICAR PAGO (parcial o total)
  // ═══════════════════════════════════════
  async aplicarPago(idCuenta: string, dto: AplicarPagoDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cuenta = await queryRunner.manager.findOne(CuentaPorPagar, {
        where: { id_cuenta: idCuenta },
      });

      if (!cuenta) throw new NotFoundException('Cuenta por pagar no encontrada');
      if (cuenta.estado === EstadoCxP.PAGADA)
        throw new BadRequestException('Esta cuenta ya esta completamente pagada');
      if (cuenta.estado === EstadoCxP.ANULADA)
        throw new BadRequestException('Esta cuenta esta anulada');

      const monto = Number(dto.monto);
      if (monto <= 0) throw new BadRequestException('El monto debe ser mayor a 0');
      if (monto > Number(cuenta.saldo_pendiente))
        throw new BadRequestException(
          `El monto ($${monto}) supera el saldo pendiente ($${cuenta.saldo_pendiente})`
        );

      const pago = queryRunner.manager.create(PagoCxP, {
        cuenta:      { id_cuenta: idCuenta },
        monto,
        metodo_pago: dto.metodo_pago,
        referencia:  dto.referencia,
        observacion: dto.observacion,
        fecha_pago:  dto.fecha_pago ? new Date(dto.fecha_pago) : new Date(),
      });
      await queryRunner.manager.save(pago);

      const nuevoMontoPagado  = Number(cuenta.monto_pagado) + monto;
      const nuevoSaldo        = Number(cuenta.monto_original) - nuevoMontoPagado;
      const nuevoEstado       = nuevoSaldo <= 0 ? EstadoCxP.PAGADA : EstadoCxP.PARCIAL;

      await queryRunner.manager.update(CuentaPorPagar, idCuenta, {
        monto_pagado:    nuevoMontoPagado,
        saldo_pendiente: Math.max(nuevoSaldo, 0),
        estado:          nuevoEstado,
      });

      await queryRunner.commitTransaction();
      this.logger.log(`Pago $${monto} aplicado a CxP ${idCuenta}. Estado: ${nuevoEstado}`);

      return {
        success: true,
        message: nuevoEstado === EstadoCxP.PAGADA
          ? 'Cuenta pagada completamente'
          : `Pago aplicado. Saldo restante: $${Math.max(nuevoSaldo, 0).toFixed(2)}`,
        saldo_pendiente: Math.max(nuevoSaldo, 0),
        estado: nuevoEstado,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════════════════════
  // 5. HISTORIAL POR PROVEEDOR
  // ═══════════════════════════════════════
  async historialProveedor(idProveedor: string, idEmpresa: string) {
    return this.cuentaRepo.find({
      where: { id_proveedor: idProveedor, id_empresa: idEmpresa },
      relations: ['pagos', 'compra'],
      order: { created_at: 'DESC' },
    });
  }

  // ═══════════════════════════════════════
  // 6. RESUMEN / KPIs
  // ═══════════════════════════════════════
  async resumen(idEmpresa: string) {
    const result = await this.cuentaRepo
      .createQueryBuilder('cxp')
      .select([
        'SUM(cxp.saldo_pendiente) AS total_pendiente',
        'COUNT(CASE WHEN cxp.estado IN (\'PENDIENTE\',\'PARCIAL\') THEN 1 END) AS cantidad_activas',
        'COUNT(CASE WHEN cxp.fecha_vencimiento < NOW() AND cxp.estado IN (\'PENDIENTE\',\'PARCIAL\') THEN 1 END) AS cantidad_vencidas',
        'SUM(CASE WHEN cxp.fecha_vencimiento < NOW() AND cxp.estado IN (\'PENDIENTE\',\'PARCIAL\') THEN cxp.saldo_pendiente ELSE 0 END) AS total_vencido',
      ])
      .where('cxp.id_empresa = :idEmpresa', { idEmpresa })
      .getRawOne();

    return {
      total_pendiente:   Number(result.total_pendiente   ?? 0),
      cantidad_activas:  Number(result.cantidad_activas  ?? 0),
      cantidad_vencidas: Number(result.cantidad_vencidas ?? 0),
      total_vencido:     Number(result.total_vencido     ?? 0),
    };
  }
}
