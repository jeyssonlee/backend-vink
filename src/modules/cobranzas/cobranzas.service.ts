import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

// Entidades
import { Cobranza, EstadoCobranza } from './entities/cobranza.entity';
import { CobranzaMetodo } from './entities/cobranza-metodo.entity';
import { CobranzaFactura } from './entities/cobranza-factura.entity';
import { Factura, EstadoFactura } from '../ventas/facturas/entities/factura.entity';

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
  // 1. REGISTRAR PAGO (DESDE APP / WEB)
  // =================================================================
  async create(dto: CreateCobranzaDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validaciones matemáticas
      const sumaMetodos = dto.metodos.reduce((acc, m) => acc + Number(m.monto || 0), 0);
      if (Math.abs(Number(dto.monto_total) - sumaMetodos) > 0.01) {
        throw new BadRequestException('El monto total no coincide con los métodos');
      }
      
      const consecutivo = await this.generarConsecutivo(dto.id_empresa);

      // INSERTAR COBRANZA - Usamos SQL puro para evitar el UpdateValuesMissingError
      // Recuperamos vendedor y url_comprobante para que se vea en el Front
      const resCobranza = await queryRunner.manager.query(
        `INSERT INTO cobranzas (
          consecutivo, fecha_reporte, monto_total, url_comprobante, 
          nota_vendedor, estado, origen, id_cliente, id_vendedor, id_empresa, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING id_cobranza`,
        [
          consecutivo,
          dto.fecha_reporte || new Date(),
          dto.monto_total,
          dto.url_comprobante || null, 
          dto.nota_vendedor || null,
          EstadoCobranza.POR_CONCILIAR, 
          'APP',
          dto.id_cliente,
          dto.id_vendedor, 
          dto.id_empresa
        ]
      );

      const idNuevaCobranza = resCobranza[0].id_cobranza;

      // Guardar Métodos
      for (const m of dto.metodos) {
        await queryRunner.manager.query(
          `INSERT INTO cobranza_metodos (id_cobranza, metodo, monto, referencia, banco, id_empresa)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [idNuevaCobranza, m.metodo, m.monto, m.referencia || null, m.banco || null, dto.id_empresa]
        );
      }

      // Relacionar Facturas - AQUÍ NO SE DESCUENTA SALDO (Flujo original)
      for (const fDetalle of dto.facturas) {
        const montoAbono = Number(fDetalle.monto_aplicado);
        if (montoAbono > 0) {
          await queryRunner.manager.query(
            `INSERT INTO cobranza_factura (id_cobranza, id_factura, monto_aplicado) 
             VALUES ($1, $2, $3)`,
            [idNuevaCobranza, fDetalle.id_factura, montoAbono]
          );
        }
      }

      await queryRunner.commitTransaction();
      return { success: true, id_cobranza: idNuevaCobranza };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // =================================================================
  // 2. APROBAR PAGO (Saldos se descuentan aquí)
  // =================================================================
  async aprobarCobranza(idCobranza: string, idAdmin: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cobranza = await this.cobranzaRepo.findOne({
        where: { id_cobranza: idCobranza }
      });

      if (!cobranza) throw new NotFoundException('Cobranza no encontrada');
      if (cobranza.estado !== EstadoCobranza.POR_CONCILIAR) throw new BadRequestException('Ya procesada');

      const detalles = await queryRunner.manager.find(CobranzaFactura, {
        where: { cobranza: { id_cobranza: idCobranza } },
        relations: ['factura']
      });

      for (const detalle of detalles) {
        const factura = detalle.factura;
        const monto = Number(detalle.monto_aplicado);
        const saldoAnterior = Number(factura.saldo_pendiente);

        const nuevoSaldo = Number((saldoAnterior - monto).toFixed(2));
        const nuevoPagado = Number((Number(factura.monto_pagado) + monto).toFixed(2));
        const nuevoEstado = nuevoSaldo <= 0.01 ? EstadoFactura.PAGADA : EstadoFactura.PARCIAL;

        // Actualizamos factura vía SQL para máxima seguridad con decimales
        await queryRunner.manager.query(
            `UPDATE facturas SET saldo_pendiente = $1, monto_pagado = $2, estado = $3 WHERE id_factura = $4`,
            [nuevoSaldo, nuevoPagado, nuevoEstado, factura.id_factura]
        );

        // Actualizamos la relación con saldos históricos
        await queryRunner.manager.update(CobranzaFactura, 
            { id_detalle: detalle.id_detalle }, 
            { saldo_anterior: saldoAnterior, saldo_nuevo: nuevoSaldo }
        );
      }

      // Finalizamos el estado de la cobranza
      await queryRunner.manager.update(Cobranza, 
        { id_cobranza: idCobranza }, 
        {
          estado: EstadoCobranza.APLICADA,
          fecha_aprobacion: new Date(),
          aprobador: { id: idAdmin } as any
        }
      );

      await queryRunner.commitTransaction();
      return { success: true };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(error);
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

    return this.cobranzaRepo.update({ id_cobranza: idCobranza }, {
      estado: EstadoCobranza.RECHAZADA,
      nota_admin: motivo,
      aprobador: { id: idAdmin } as any
    });
  }

  // =================================================================
  // 4. ANULAR PAGO (REVERSAR SALDOS)
  // =================================================================
  async anularCobranza(idCobranza: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cobranza = await this.cobranzaRepo.findOne({
        where: { id_cobranza: idCobranza },
        relations: ['facturas_afectadas', 'facturas_afectadas.factura']
      });

      if (!cobranza || cobranza.estado !== EstadoCobranza.APLICADA) {
        throw new BadRequestException('Solo se pueden anular cobranzas aplicadas');
      }

      for (const detalle of cobranza.facturas_afectadas) {
        const factura = detalle.factura;
        const montoReversar = Number(detalle.monto_aplicado);

        const nuevoSaldo = Number((Number(factura.saldo_pendiente) + montoReversar).toFixed(2));
        const nuevoPagado = Number((Number(factura.monto_pagado) - montoReversar).toFixed(2));
        
        await queryRunner.manager.query(
            `UPDATE facturas SET saldo_pendiente = $1, monto_pagado = $2, estado = $3 WHERE id_factura = $4`,
            [nuevoSaldo, nuevoPagado, nuevoPagado <= 0 ? EstadoFactura.PENDIENTE : EstadoFactura.PARCIAL, factura.id_factura]
        );
      }

      await queryRunner.manager.update(Cobranza, { id_cobranza: idCobranza }, { estado: EstadoCobranza.ANULADA });
      await queryRunner.commitTransaction();
      return { success: true };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // =================================================================
  // 5. REGISTRAR PAGO MANUAL (CAJA)
  // =================================================================
  async createManual(data: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const payload: any = {
            consecutivo: await this.generarConsecutivo(data.id_empresa),
            fecha_reporte: data.fecha_reporte,
            monto_total: data.monto_total,
            nota_vendedor: data.nota_vendedor,
            estado: EstadoCobranza.APLICADA,
            fecha_aprobacion: new Date(),
            origen: 'CAJA',
            cliente: { id_cliente: data.id_cliente },
            empresa: { id: data.id_empresa },
        };

        const nuevaCobranza = this.cobranzaRepo.create(payload);
        const cobradoGuardado = (await queryRunner.manager.save(nuevaCobranza)) as unknown as Cobranza;

        if (data.metodos) {
            for (const metodo of data.metodos) {
                const nuevoMetodo = queryRunner.manager.create(CobranzaMetodo, {
                    cobranza: cobradoGuardado,
                    metodo: metodo.metodo,
                    monto: metodo.monto,
                    referencia: metodo.referencia || null,
                    banco: metodo.banco,
                    empresa: { id: data.id_empresa }
                });
                await queryRunner.manager.save(nuevoMetodo);
            }
        }

        if (data.facturas) {
            let montoDisponible = Number(data.monto_total);

            for (const item of data.facturas) {
                const factura = await queryRunner.manager.findOne(Factura, { where: { id_factura: item.id_factura } });
                if (!factura) continue;

                let montoAAplicar = Number(item.monto_aplicado || 0);
                if (montoAAplicar <= 0) {
                    const deuda = Number(factura.saldo_pendiente);
                    montoAAplicar = (montoDisponible >= deuda) ? deuda : montoDisponible;
                }

                if (montoAAplicar > 0) {
                    const saldoAnterior = Number(factura.saldo_pendiente);
                    factura.monto_pagado = Number((Number(factura.monto_pagado) + montoAAplicar).toFixed(2));
                    factura.saldo_pendiente = Number((saldoAnterior - montoAAplicar).toFixed(2));
                    
                    factura.estado = factura.saldo_pendiente <= 0.01 ? EstadoFactura.PAGADA : EstadoFactura.PARCIAL;

                    await queryRunner.manager.save(factura);

                    const detalle = queryRunner.manager.create(CobranzaFactura, {
                        cobranza: cobradoGuardado,
                        factura: factura,
                        monto_aplicado: montoAAplicar,
                        saldo_anterior: saldoAnterior,
                        saldo_nuevo: factura.saldo_pendiente
                    });
                    await queryRunner.manager.save(detalle);
                    montoDisponible -= montoAAplicar;
                }
            }
        }

        await queryRunner.commitTransaction();
        return { success: true, id_cobranza: cobradoGuardado.id_cobranza };

    } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error(error);
        throw new BadRequestException('Error registro manual');
    } finally {
        await queryRunner.release();
    }
  }

  // =================================================================
  // 6. CONSULTAS
  // =================================================================
  async findAll(idEmpresa: string) {
    return this.cobranzaRepo.find({
      where: { empresa: { id: idEmpresa } as any },
      relations: ['cliente', 'vendedor', 'metodos', 'facturas_afectadas'],
      order: { created_at: 'DESC' },
      take: 100
    });
  }

  async findAllPendientes(idEmpresa: string) {
    return this.cobranzaRepo.find({
      where: { empresa: { id: idEmpresa } as any, estado: EstadoCobranza.POR_CONCILIAR },
      relations: ['vendedor', 'metodos', 'facturas_afectadas', 'facturas_afectadas.factura', 'cliente'],
      order: { fecha_reporte: 'ASC' }
    });
  }

  async findHistorial(idEmpresa: string) {
    return this.cobranzaRepo.find({
      where: { empresa: { id: idEmpresa } as any },
      relations: ['cliente', 'vendedor', 'metodos', 'facturas_afectadas'],
      order: { created_at: 'DESC' },
      take: 100
    });
  }

  async findHistorialByVendedor(idVendedor: string) {
    return this.cobranzaRepo.find({
      where: { vendedor: { id: idVendedor } as any },
      relations: ['cliente', 'metodos'],
      order: { created_at: 'DESC' },
      take: 50
    });
  }

  private async generarConsecutivo(idEmpresa: string): Promise<string> {
    const count = await this.cobranzaRepo.count({ 
      where: { empresa: { id: idEmpresa } as any } 
    });
    return String(count + 1).padStart(6, '0');
  }
}