import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

// Entidades
import { Cobranza, EstadoCobranza } from './entities/cobranza.entity';
import { CobranzaMetodo } from './entities/cobranza-metodo.entity';
import { CobranzaFactura } from './entities/cobranza-factura.entity';
import { Factura, EstadoFactura } from '../ventas/facturas/entities/factura.entity'; // Verifica esta ruta

// DTOs
import { CreateCobranzaDto } from './dto/create-cobranza.dto';

@Injectable()
export class CobranzasService {
  private readonly logger = new Logger(CobranzasService.name);

  constructor(
    @InjectRepository(Cobranza)
    private readonly cobranzaRepo: Repository<Cobranza>,
    @InjectRepository(Factura)
    private readonly facturaRepo: Repository<Factura>,
    private readonly dataSource: DataSource,
  ) {}

  // =================================================================
  // 1. REGISTRAR PAGO
  // =================================================================
  async create(dto: CreateCobranzaDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // A. Validar Montos
      const sumaMetodos = dto.metodos.reduce((acc, m) => acc + m.monto, 0);
      const sumaFacturas = dto.facturas.reduce((acc, f) => acc + f.monto_aplicado, 0);

      if (Math.abs(dto.monto_total - sumaMetodos) > 0.01) {
        throw new BadRequestException('El monto total no coincide con la suma de los métodos de pago');
      }
      if (Math.abs(dto.monto_total - sumaFacturas) > 0.01) {
        throw new BadRequestException('El monto total no coincide con la suma aplicada a las facturas');
      }

      // B. Crear Cabecera
      // ⚠️ CORRECCIÓN: Usamos 'empresa: { id: ... }' en lugar de 'id_empresa'
      const nuevaCobranza = this.cobranzaRepo.create({
        consecutivo: await this.generarConsecutivo(dto.id_empresa),
        fecha_reporte: dto.fecha_reporte,
        monto_total: dto.monto_total,
        url_comprobante: dto.url_comprobante,
        nota_vendedor: dto.nota_vendedor,
        estado: EstadoCobranza.POR_CONCILIAR,
        vendedor: { id: dto.id_vendedor } as any,
        empresa: { id: dto.id_empresa } as any, // 👈 SOLUCIÓN AL ERROR TS2769
      });

      const cobradoGuardado = await queryRunner.manager.save(nuevaCobranza);

      // C. Guardar Métodos
      for (const metodo of dto.metodos) {
        const nuevoMetodo = queryRunner.manager.create(CobranzaMetodo, {
            cobranza: cobradoGuardado,
            ...metodo,
            empresa: { id: dto.id_empresa } as any // 👈 SOLUCIÓN AL ERROR ID_EMPRESA
        });
        await queryRunner.manager.save(nuevoMetodo);
      }

      // D. Relacionar Facturas
      for (const item of dto.facturas) {
        const factura = await queryRunner.manager.findOne(Factura, { where: { id_factura: item.id_factura } });
        if (!factura) throw new NotFoundException(`Factura ${item.id_factura} no encontrada`);

        const relacion = queryRunner.manager.create(CobranzaFactura, {
            cobranza: cobradoGuardado, // Ahora sí es un objeto único
            factura: factura,
            monto_aplicado: item.monto_aplicado,
            saldo_anterior: factura.saldo_pendiente,
            saldo_nuevo: factura.saldo_pendiente
        });
        await queryRunner.manager.save(relacion);
      }

      await queryRunner.commitTransaction();
      
      // SOLUCIÓN AL ERROR TS2339: cobradoGuardado ahora es seguro un objeto
      return { success: true, message: 'Cobro registrado. Pendiente de aprobación.', id: cobradoGuardado.id_cobranza };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error.code === '23505') {
         throw new BadRequestException('Esa referencia bancaria ya fue registrada anteriormente.');
      }
      this.logger.error(error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // =================================================================
  // 2. APROBAR PAGO
  // =================================================================
  async aprobarCobranza(idCobranza: string, idAdmin: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cobranza = await this.cobranzaRepo.findOne({
        where: { id_cobranza: idCobranza },
        relations: ['facturas_afectadas', 'facturas_afectadas.factura']
      });

      if (!cobranza) throw new NotFoundException('Cobranza no encontrada');
      if (cobranza.estado !== EstadoCobranza.POR_CONCILIAR) {
        throw new BadRequestException(`Esta cobranza ya está ${cobranza.estado}`);
      }

      for (const detalle of cobranza.facturas_afectadas) {
        const factura = detalle.factura;
        
        if (Number(factura.saldo_pendiente) < Number(detalle.monto_aplicado)) {
            throw new BadRequestException(`El abono excede la deuda de la Factura ${factura.numero_control}`);
        }

        factura.monto_pagado = Number(factura.monto_pagado) + Number(detalle.monto_aplicado);
        factura.saldo_pendiente = Number(factura.saldo_pendiente) - Number(detalle.monto_aplicado);

        if (factura.saldo_pendiente <= 0.01) {
            factura.saldo_pendiente = 0;
            factura.estado = EstadoFactura.PAGADA;
        } else {
            factura.estado = EstadoFactura.PARCIAL;
        }

        await queryRunner.manager.update(CobranzaFactura, detalle.id_detalle, {
            saldo_anterior: Number(factura.saldo_pendiente) + Number(detalle.monto_aplicado),
            saldo_nuevo: factura.saldo_pendiente
        });

        await queryRunner.manager.save(factura);
      }

      cobranza.estado = EstadoCobranza.APLICADA;
      cobranza.aprobador = { id: idAdmin } as any;
      cobranza.fecha_aprobacion = new Date();

      await queryRunner.manager.save(cobranza);

      await queryRunner.commitTransaction();
      return { success: true, message: 'Cobranza aplicada correctamente.' };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // =================================================================
  // 3. RECHAZAR PAGO
  // =================================================================
  async rechazarCobranza(idCobranza: string, idAdmin: string, motivo: string) {
    const cobranza = await this.cobranzaRepo.findOne({ where: { id_cobranza: idCobranza } });
    if (!cobranza) throw new NotFoundException('Cobranza no encontrada');
    if (cobranza.estado !== EstadoCobranza.POR_CONCILIAR) throw new BadRequestException('Solo pendiente');

    cobranza.estado = EstadoCobranza.RECHAZADA;
    cobranza.nota_admin = motivo;
    cobranza.aprobador = { id: idAdmin } as any;
    
    return this.cobranzaRepo.save(cobranza);
  }

  // Helper
  private async generarConsecutivo(idEmpresa: string): Promise<string> {
    // ⚠️ CORRECCIÓN: where: { empresa: { id: ... } }
    const count = await this.cobranzaRepo.count({ where: { empresa: { id: idEmpresa } } });
    return String(count + 1).padStart(6, '0');
  }

  // NUEVO: Listar absolutamente todas las cobranzas de una empresa
  async findAll(idEmpresa: string) {
    return this.cobranzaRepo.find({
      where: { empresa: { id: idEmpresa } },
      relations: [
        'vendedor', 
        'metodos', 
        'facturas_afectadas', 
        'facturas_afectadas.factura',
        'facturas_afectadas.factura.cliente'
      ],
      order: { created_at: 'DESC' }
    });
  }

  // Listar pendientes (Sincronizado con Controller)
  async findAllPendientes(idEmpresa: string) {
      return this.cobranzaRepo.find({
          where: { 
            empresa: { id: idEmpresa }, 
            estado: EstadoCobranza.POR_CONCILIAR 
          },
          relations: ['vendedor', 'metodos', 'facturas_afectadas', 'facturas_afectadas.factura'],
          order: { fecha_reporte: 'ASC' }
      });
  }
}