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
  // 1. REGISTRAR PAGO (DESDE APP / WEB) - CORREGIDO #9
  // =================================================================
  async create(dto: CreateCobranzaDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sumaMetodos = dto.metodos.reduce((acc, m) => acc + Number(m.monto || 0), 0);
      if (Math.abs(Number(dto.monto_total) - sumaMetodos) > 0.01) {
        throw new BadRequestException('El monto total no coincide con los métodos');
      }
      
      // 🚀 SOLUCIÓN #9: Generar consecutivo DENTRO de la transacción con bloqueo
      // Buscamos la última cobranza de la empresa y bloqueamos la fila
      const ultima = await queryRunner.manager.findOne(Cobranza, {
        where: { empresa: { id: dto.id_empresa } },
        order: { consecutivo: 'DESC' },
        lock: { mode: 'pessimistic_write' }
      });
      const consecutivo = ultima ? (Number(ultima.consecutivo) + 1).toString() : '1';

      // INSERTAR COBRANZA - SQL Puro
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

      for (const m of dto.metodos) {
        await queryRunner.manager.query(
          `INSERT INTO cobranza_metodos (id_cobranza, metodo, monto, referencia, banco, id_empresa)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [idNuevaCobranza, m.metodo, m.monto, m.referencia || null, m.banco || null, dto.id_empresa]
        );
      }

      for (const fDetalle of dto.facturas) {
        const montoAbono = Number(fDetalle.monto_aplicado);
        if (montoAbono > 0) {
          await queryRunner.manager.query(
            `INSERT INTO cobranza_facturas (id_cobranza, id_factura, monto_aplicado) 
             VALUES ($1, $2, $3)`,
            [idNuevaCobranza, fDetalle.id_factura, montoAbono]
          );
        }
      }

      await queryRunner.commitTransaction();
      return { success: true, id_cobranza: idNuevaCobranza, consecutivo };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      // this.logger.error(error); // Descomenta si tienes el logger importado
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // =================================================================
  // 2. APROBAR PAGO (Cambios estructurales aplicados aquí)
  // =================================================================
  // src/modules/cobranzas/cobranzas.service.ts

async aprobarCobranza(id: string, idAprobador: string) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Buscamos la cobranza CON sus facturas relacionadas
    const cobranza = await queryRunner.manager.findOne(Cobranza, {
      where: { id_cobranza: id },
      relations: ['facturas_afectadas', 'facturas_afectadas.factura'] // 👈 Vital para traer los saldos
    });

    if (!cobranza) {
      throw new NotFoundException('Cobranza no encontrada');
    }
    if (cobranza.estado === EstadoCobranza.APLICADA) {
      throw new BadRequestException('Esta cobranza ya fue aplicada anteriormente');
    }

    // 2. Actualizamos la cobranza
    cobranza.estado = EstadoCobranza.APLICADA;
    cobranza.fecha_aprobacion = new Date();
    cobranza.aprobador = { id_usuario: idAprobador } as any;
    
    await queryRunner.manager.save(cobranza);

    // 3. Recorremos las facturas para descontar el saldo
    if (cobranza.facturas_afectadas && cobranza.facturas_afectadas.length > 0) {
      for (const detalle of cobranza.facturas_afectadas) {
        const factura = detalle.factura;
        
        const monto = Number(detalle.monto_aplicado);
        const saldoAnterior = Number(factura.saldo_pendiente);
        const nuevoSaldo = Math.max(0, Number((saldoAnterior - monto).toFixed(2)));
        const nuevoPagado = Number((Number(factura.monto_pagado) + monto).toFixed(2));

        factura.saldo_pendiente = nuevoSaldo;
        factura.monto_pagado = nuevoPagado;
        factura.estado = nuevoSaldo <= 0.01 ? EstadoFactura.PAGADA : EstadoFactura.PARCIAL;

        // Guardamos la factura actualizada
        await queryRunner.manager.save(factura);
      }
    }

    // 4. Confirmamos la transacción (Se guardan todos los cambios juntos)
    await queryRunner.commitTransaction();
    return { message: 'Cobranza aprobada y saldos descontados correctamente' };

  } catch (error) {
    // Si algo falla, deshacemos todo para no alterar saldos por error
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    // Liberamos el motor de base de datos
    await queryRunner.release();
  }
}
  // =================================================================
  // 3. RECHAZAR PAGO
  // =================================================================
  async rechazarCobranza(id: string, idAprobador: string, motivo: string) {
    const cobranza = await this.cobranzaRepo.findOne({ 
      where: { id_cobranza: id } 
    });
  
    if (!cobranza) {
      throw new NotFoundException('Cobranza no encontrada');
    }
  
    cobranza.estado = EstadoCobranza.RECHAZADA;
    cobranza.fecha_aprobacion = new Date();
    cobranza.nota_admin = motivo;
    
    cobranza.aprobador = { id_usuario: idAprobador } as any;
  
    // 4. Guardamos los cambios
    return await this.cobranzaRepo.save(cobranza);
  }

  // =================================================================
  // 4. ANULAR PAGO (REVERSAR SALDOS) - CORREGIDO #10
  // =================================================================
  async anularCobranza(idCobranza: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 🚀 SOLUCIÓN #10: Usar queryRunner y añadir bloqueo pesimista
      const cobranza = await queryRunner.manager.findOne(Cobranza, {
        where: { id_cobranza: idCobranza },
        relations: ['facturas_afectadas', 'facturas_afectadas.factura'],
        lock: { mode: 'pessimistic_write' }
      });

      if (!cobranza) {
        throw new NotFoundException('Cobranza no encontrada');
      }

      if (cobranza.estado !== EstadoCobranza.APLICADA) {
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

      // 🚀 OTRA MEJORA: Actualizar usando el queryRunner en lugar del manager suelto
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
      where: { 
        empresa: { id: idEmpresa } as any,
        estado: EstadoCobranza.APLICADA // 👈 O déjala sin estado si quieres ver TODO (incluyendo fallidas)
      },
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
      where: { 
        empresa: { id: idEmpresa } as any,
        // 🚀 FILTRO CLAVE: Solo lo aprobado
        estado: EstadoCobranza.APLICADA 
      },
      relations: ['cliente', 'vendedor', 'metodos', 'facturas_afectadas'],
      // 💡 Tip: Ordena por fecha_aprobacion para que el historial sea cronológico de cierre
      order: { fecha_aprobacion: 'DESC' }, 
      take: 100
    });
  }

  async findHistorialByVendedor(idVendedor: string) {
    return this.cobranzaRepo.find({
      where: { vendedor: { id_usuario: idVendedor } as any, estado: EstadoCobranza.APLICADA },
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