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
      // 🚀 SOLUCIÓN: Quitamos el "lock: { mode: 'pessimistic_write' }"
      // Postgres prohíbe bloquear filas en consultas que usan LEFT JOIN.
      const cobranza = await queryRunner.manager.findOne(Cobranza, {
        where: { id_cobranza: idCobranza },
        relations: ['facturas_afectadas', 'facturas_afectadas.factura']
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
  // 5. REGISTRAR PAGO MANUAL (CAJA) - BLINDADO CON VENDEDOR HEREDADO
  // =================================================================
  async createManual(data: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        // 🚀 LÓGICA DE VENDEDOR HEREDADO AUTOMÁTICO
        let idVendedorHeredado = data.id_vendedor;

        // 1. Heredar de la factura (si aplica)
        if (!idVendedorHeredado && data.facturas && data.facturas.length > 0) {
            const fInfo = await queryRunner.manager.query(
                `SELECT id_vendedor FROM facturas WHERE id_factura = $1 LIMIT 1`, [data.facturas[0].id_factura]
            );
            if (fInfo.length > 0) idVendedorHeredado = fInfo[0].id_vendedor;
        }

        // 2. Fallback: Heredar del perfil del cliente
        if (!idVendedorHeredado && data.id_cliente) {
            const cInfo = await queryRunner.manager.query(
                `SELECT id_vendedor FROM clientes WHERE id_cliente = $1 LIMIT 1`, [data.id_cliente]
            );
            if (cInfo.length > 0) idVendedorHeredado = cInfo[0].id_vendedor;
        }

        // Consecutivo manual
        const ultima = await queryRunner.manager.findOne(Cobranza, {
          where: { empresa: { id: data.id_empresa } as any },
          order: { consecutivo: 'DESC' }
        });
        const consecutivo = ultima ? (Number(ultima.consecutivo) + 1).toString().padStart(6, '0') : '000001';

        // 🚀 SOLUCIÓN TYPEORM: Inserción SQL cruda para evitar "UpdateValuesMissingError" por cascadas fantasma
        const resCobranza = await queryRunner.manager.query(
          `INSERT INTO cobranzas (
              consecutivo, fecha_reporte, monto_total, nota_vendedor, 
              estado, fecha_aprobacion, origen, id_cliente, id_empresa, id_vendedor, id_aprobador, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING id_cobranza`,
          [
              consecutivo,
              data.fecha_reporte || new Date(),
              data.monto_total,
              data.nota_vendedor || null,
              EstadoCobranza.APLICADA,
              new Date(),
              'CAJA',
              data.id_cliente,
              data.id_empresa,
              idVendedorHeredado || null,
              data.id_aprobador || null // <-- $11 El usuario del token
          ]
      );
        const idCobranzaGuardada = resCobranza[0].id_cobranza;

        // Métodos de pago
        if (data.metodos) {
            for (const metodo of data.metodos) {
                await queryRunner.manager.query(
                    `INSERT INTO cobranza_metodos (id_cobranza, metodo, monto, referencia, banco, id_empresa)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [idCobranzaGuardada, metodo.metodo, metodo.monto, metodo.referencia || null, metodo.banco || null, data.id_empresa]
                );
            }
        }

        // Facturas y Saldos
        if (data.facturas) {
            let montoDisponible = Number(data.monto_total);

            for (const item of data.facturas) {
                const resFactura = await queryRunner.manager.query(
                    `SELECT id_factura, saldo_pendiente, monto_pagado FROM facturas WHERE id_factura = $1 LIMIT 1`,
                    [item.id_factura]
                );
                if (resFactura.length === 0) continue;
                
                const factura = resFactura[0];
                let montoAAplicar = Number(item.monto_aplicado || 0);
                const deuda = Number(factura.saldo_pendiente);
                
                if (montoAAplicar <= 0) {
                    montoAAplicar = (montoDisponible >= deuda) ? deuda : montoDisponible;
                }

                if (montoAAplicar > 0) {
                    const nuevoPagado = Number((Number(factura.monto_pagado) + montoAAplicar).toFixed(2));
                    const nuevoSaldo = Number((deuda - montoAAplicar).toFixed(2));
                    const nuevoEstado = nuevoSaldo <= 0.01 ? EstadoFactura.PAGADA : EstadoFactura.PARCIAL;

                    // Actualización directa, ultra rápida y sin bugs
                    await queryRunner.manager.query(
                        `UPDATE facturas SET monto_pagado = $1, saldo_pendiente = $2, estado = $3 WHERE id_factura = $4`,
                        [nuevoPagado, nuevoSaldo, nuevoEstado, factura.id_factura]
                    );

                    await queryRunner.manager.query(
                        `INSERT INTO cobranza_facturas (id_cobranza, id_factura, monto_aplicado, saldo_anterior, saldo_nuevo)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [idCobranzaGuardada, factura.id_factura, montoAAplicar, deuda, nuevoSaldo]
                    );

                    montoDisponible -= montoAAplicar;
                }
            }
        }

        await queryRunner.commitTransaction();
        return { success: true, id_cobranza: idCobranzaGuardada };

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