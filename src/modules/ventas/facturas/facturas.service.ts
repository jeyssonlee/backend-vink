import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Factura, MetodoPago, EstadoFactura } from './entities/factura.entity';
import { FacturaDetalle } from './entities/factura-detalle.entity';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { CrearFacturaLoteDto } from './dto/crear-factura-lote.dto';
import { Pedido } from '../pedidos/entities/pedido.entity';
import { ProductosService } from 'src/modules/inventario/productos/productos.service';
import { Cliente } from '../clientes/entities/clientes.entity';
import { Producto } from 'src/modules/inventario/productos/entities/producto.entity';
import { Almacen } from 'src/modules/inventario/almacenes/entities/almacen.entity';
import { AgingQueryDto } from './dto/aging-query.dto';
import { ReporteVentasQueryDto } from './dto/reporte-ventas-query.dto';
import { ConfiguracionImpuestosService } from 'src/modules/core/configuracion-impuestos/configuracion-impuestos.service';



@Injectable()
export class FacturasService {
  private readonly logger = new Logger(FacturasService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly productosService: ProductosService,
    private readonly impuestosService: ConfiguracionImpuestosService,
  ) {}

  // ==========================================================
  // 1. CREAR FACTURA
  // ==========================================================
  async crear(dto: CrearFacturaDto, usuario: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const idEmpresa = dto.id_empresa;
      if (!idEmpresa) throw new BadRequestException('ID de empresa no proporcionado');

      let itemsProcesar: any[] = [];
      let cliente: Cliente | null = null; 

      // --- CASO A: FACTURAR DESDE PEDIDO ---
      if (dto.id_pedido) {
        const pedido = await queryRunner.manager.findOne(Pedido, {
          where: { id_pedido: dto.id_pedido, id_empresa: idEmpresa },
          relations: ['detalles', 'detalles.producto', 'cliente', 'cliente.vendedor']
        });
        if (!pedido) throw new NotFoundException('Pedido no encontrado');
        if (pedido.estado === 'FACTURADO') throw new ConflictException('Pedido ya facturado');
        
        cliente = pedido.cliente;
        itemsProcesar = pedido.detalles.map(d => ({
          producto: d.producto,
          cantidad: d.cantidad,
          precio: d.precio_unitario, 
        }));

      // --- CASO B: VENTA DIRECTA ---
      } else if (dto.items && dto.items.length > 0) {
        if (!dto.id_cliente) throw new BadRequestException("El cliente es obligatorio para venta directa");
        
        cliente = await queryRunner.manager.findOne(Cliente, { 
            where: { id_cliente: dto.id_cliente, empresa: { id: idEmpresa } },
            relations: ['vendedor'] 
        });
        if (!cliente) throw new NotFoundException("Cliente no encontrado");

        for (const itemDto of dto.items) {
            const producto = await queryRunner.manager.findOne(Producto, { 
                where: { id_producto: itemDto.id_producto, empresa: { id: idEmpresa } } 
            });
            if (!producto) throw new NotFoundException(`Producto ${itemDto.id_producto} no encontrado`);

            const precioFinal = itemDto.precio_personalizado ?? producto.precio_base;
            itemsProcesar.push({
                producto: producto,
                cantidad: itemDto.cantidad,
                precio: precioFinal
            });
        }
      } else {
        throw new BadRequestException("Datos insuficientes: Debe enviar id_pedido o una lista de items.");
      }

      // Procesar Detalle
      const detallesFactura: FacturaDetalle[] = [];
      let subtotalBase = 0;
      let totalCosto = 0;
      let totalGanancia = 0;

      for (const item of itemsProcesar) {
        const prod = item.producto;
        const costoData = await queryRunner.manager.query(
            `SELECT costo_unitario FROM inventarios WHERE id_producto = $1 AND id_empresa = $2 LIMIT 1`, 
            [prod.id_producto, idEmpresa]
        );
        
        let costoUnitario = 0;
        if (costoData.length > 0 && costoData[0].costo_unitario != null) {
            costoUnitario = parseFloat(costoData[0].costo_unitario);
            if (isNaN(costoUnitario)) costoUnitario = 0;
        }

        const precioVenta = Number(item.precio || 0); 
        const cantidad = Number(item.cantidad || 0);

        if (costoUnitario > 0 && precioVenta < costoUnitario) {
          throw new BadRequestException(
              `El precio de "${prod.nombre}" ($${precioVenta}) es menor al costo ($${costoUnitario.toFixed(2)}). No se puede procesar la venta.`
          );
      }

        const totalLinea = precioVenta * cantidad;

        subtotalBase += totalLinea;
        totalCosto += (costoUnitario * cantidad);
        totalGanancia += (precioVenta - costoUnitario) * cantidad;

        const detalle = queryRunner.manager.create(FacturaDetalle, {
            producto: prod,
            nombre_producto: prod.nombre, 
            codigo_producto: prod.codigo, 
            cantidad: cantidad,
            precio_unitario: precioVenta,
            costo_historico: costoUnitario,
            ganancia_neta: (precioVenta - costoUnitario) * cantidad,
            total_linea: totalLinea
        });
        detallesFactura.push(detalle);
      }

      // Totales
      const descuentoGlobal = dto.descuento_global_monto || 0;
      const baseImponible = subtotalBase - descuentoGlobal;
      const tasaIva = await this.impuestosService.getIva(dto.id_empresa!);
      const montoIva = baseImponible * tasaIva;
      const totalPagar = baseImponible + montoIva;

      // Numeración
      const esBorrador = dto.estado === EstadoFactura.BORRADOR;
      let numeroConsecutivo: number | null = null; 
      let serie = 'A'; 

      if (!esBorrador) {
        const ultima = await queryRunner.manager.findOne(Factura, {
            where: { empresa: { id: idEmpresa }, serie: serie },
            order: { numero_consecutivo: 'DESC' },
            lock: { mode: 'pessimistic_write' } 
        });
        numeroConsecutivo = ultima ? ultima.numero_consecutivo + 1 : 1;

        const duplicada = await queryRunner.manager.findOne(Factura, {
            where: { empresa: { id: idEmpresa }, serie: serie, numero_consecutivo: numeroConsecutivo }
        });
        if (duplicada) throw new ConflictException(`Error de concurrencia: El número ${serie}-${numeroConsecutivo} ya fue asignado.`);
      }

      let diasCredito = 0;
      let fechaVencimiento = new Date();
      let estadoFinal = esBorrador ? EstadoFactura.BORRADOR : EstadoFactura.PAGADA;

      if (!esBorrador && dto.metodo_pago === MetodoPago.CREDITO) {
          diasCredito = dto.dias_credito || 15;
          fechaVencimiento.setDate(fechaVencimiento.getDate() + diasCredito);
          estadoFinal = EstadoFactura.PENDIENTE;
      }

      const saldoInicial = estadoFinal === EstadoFactura.PENDIENTE ? totalPagar : 0;
      const pagadoInicial = estadoFinal === EstadoFactura.PAGADA ? totalPagar : 0;

      const datosFactura: import('typeorm').DeepPartial<Factura> = {
        serie,
        numero_consecutivo: numeroConsecutivo ?? undefined,
        subtotal_base: subtotalBase,
        descuento_global_monto: descuentoGlobal,
        monto_iva: montoIva,
        total_pagar: totalPagar,
        monto_pagado: pagadoInicial,
        saldo_pendiente: saldoInicial,
        total_costo: totalCosto,
        total_ganancia: totalGanancia - descuentoGlobal,
        metodo_pago: dto.metodo_pago,
        estado: estadoFinal,
        dias_credito: diasCredito,
        fecha_vencimiento: esBorrador ? undefined : fechaVencimiento,
        id_pedido_origen: dto.id_pedido,
        cliente: cliente as import('typeorm').DeepPartial<Factura>['cliente'],
        empresa: { id: idEmpresa } as import('typeorm').DeepPartial<Factura>['empresa'],
        vendedor: cliente?.vendedor ? { id_vendedor: cliente.vendedor.id_vendedor } : undefined,
        detalles: detallesFactura
      };

      const nuevaFactura = queryRunner.manager.create(Factura, datosFactura);
      const facturaGuardada = await queryRunner.manager.save(nuevaFactura);

      // Movimientos de Inventario
      if (!esBorrador) {
        if (dto.id_pedido) {
            for (const det of detallesFactura) {
                await this.productosService.finalizarSalida(
                    det.producto.id_producto, det.cantidad, idEmpresa, queryRunner
                );
            }
            await queryRunner.manager.update(Pedido, dto.id_pedido, { estado: 'FACTURADO' as any });
        } else {
            const almacenVenta = await queryRunner.manager.findOne(Almacen, {
                where: { empresa: { id: idEmpresa }, es_venta: true }
            });
            if (!almacenVenta) throw new ConflictException("No se encontró un Almacén de Venta configurado.");

            for (const det of detallesFactura) {
              await this.productosService.registrarSalidaDirecta(
                  det.producto.id_producto,
                  det.cantidad,
                  idEmpresa,
                  `Venta Directa: ${serie}-${String(numeroConsecutivo).padStart(6, '0')}`,
                  queryRunner
              );
          }
      }
      }

      await queryRunner.commitTransaction();
      return { success: true, data: facturaGuardada };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ==========================================================
  // 2. ANULAR FACTURA
  // ==========================================================
  async anular(idFactura: string, motivo: string, idUsuario: string, idEmpresa: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const factura = await queryRunner.manager.findOne(Factura, {
        where: { id_factura: idFactura, empresa: { id: idEmpresa } },
        relations: ['detalles', 'detalles.producto']
      });

      if (!factura) throw new NotFoundException('Factura no encontrada');

      if (factura.estado === EstadoFactura.ANULADA) throw new BadRequestException('Esta factura ya está anulada.');
      if (factura.estado === EstadoFactura.BORRADOR) throw new BadRequestException('Los borradores se eliminan, no se anulan.');

      // Revertir Stock
      for (const det of factura.detalles) {
        if (det.producto) { 
            await this.productosService.revertirVenta(
                det.producto.id_producto, 
                Number(det.cantidad), 
                idEmpresa, 
                queryRunner
            );
        }
      }

      factura.estado = EstadoFactura.ANULADA;
      this.logger.warn(`Factura ${factura.numero_completo} anulada por usuario ${idUsuario}. Motivo: ${motivo}`);
      await queryRunner.manager.save(factura);

      if (factura.id_pedido_origen) {
         await queryRunner.manager.update(Pedido, factura.id_pedido_origen, { estado: 'ANULADO' as any });
      }

      await queryRunner.commitTransaction();
      return { success: true, message: `Factura ${factura.numero_completo} anulada correctamente.` };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error anulando factura: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ==========================================================
  // 3. CONFIRMAR BORRADOR (CORREGIDO - Hallazgo #12)
  // ==========================================================
  async confirmarBorrador(idFactura: string, idEmpresa: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const factura = await queryRunner.manager.findOne(Factura, {
        where: { id_factura: idFactura, empresa: { id: idEmpresa } },
        relations: ['detalles', 'detalles.producto']
      });

      if (!factura) throw new NotFoundException('Factura no encontrada');
      if (factura.estado !== EstadoFactura.BORRADOR) throw new BadRequestException('Esta factura ya fue procesada');

      // 1. Consecutivo con bloqueo para evitar saltos o duplicados
      const ultima = await queryRunner.manager.findOne(Factura, {
        where: { empresa: { id: idEmpresa }, serie: factura.serie },
        order: { numero_consecutivo: 'DESC' },
        lock: { mode: 'pessimistic_write' }
      });
      const nuevoNumero = ultima ? ultima.numero_consecutivo + 1 : 1;

      // 2. MANEJO DE INVENTARIO (Blindado)
      for (const det of factura.detalles) {
        if (factura.id_pedido_origen) {
          // Caso A: Viene de pedido (Stock ya estaba comprometido)
          await this.productosService.finalizarSalida(
            det.producto.id_producto, det.cantidad, idEmpresa, queryRunner
          );
        } else {
          // Caso B: Venta Directa (Hallazgo #12)
          // Registramos una salida directa en el Kardex y restamos stock actual
          await this.productosService.registrarSalidaDirecta(
            det.producto.id_producto, 
            det.cantidad, 
            idEmpresa, 
            `Venta Directa: ${factura.serie}-${nuevoNumero}`,
            queryRunner
          );
        }
      }

      // 3. Actualización de datos de la factura
      factura.numero_consecutivo = nuevoNumero;
      factura.estado = factura.metodo_pago === MetodoPago.CREDITO ? EstadoFactura.PENDIENTE : EstadoFactura.PAGADA;
      factura.fecha_emision = new Date();

      if (factura.dias_credito > 0) {
        const v = new Date();
        v.setDate(v.getDate() + factura.dias_credito);
        factura.fecha_vencimiento = v;
      }

      await queryRunner.manager.save(factura);
      
      if (factura.id_pedido_origen) {
        await queryRunner.manager.update(Pedido, factura.id_pedido_origen, { estado: 'FACTURADO' as any });
      }

      await queryRunner.commitTransaction();
      return { success: true, numero: `${factura.serie}-${factura.numero_consecutivo}` };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ==========================================================
  // 4. CREAR LOTE MASIVO
  // ==========================================================
  async crearLote(dto: CrearFacturaLoteDto, idEmpresa: string, idUsuario: string) {
    const resultados = {
        total: dto.ids_pedidos.length,
        procesados: 0,
        fallidos: 0,
        detalles_exito: [] as any[],
        detalles_error: [] as any[],
    };

    // ✅ CORRECCIÓN IMPORTANTE: Usamos id_usuario para la llave
    const usuarioSimulado = { id_usuario: idUsuario }; 

    for (const idPedido of dto.ids_pedidos) {
        try {
            const respuesta = await this.crear({
                id_pedido: idPedido,
                id_empresa: idEmpresa,
                id_cliente: '', 
                items: [], 
                metodo_pago: dto.metodo_pago_defecto || MetodoPago.CREDITO, 
                estado: EstadoFactura.PENDIENTE 
            } as any, usuarioSimulado); 

            const facturaData = (respuesta.data as any);
            resultados.procesados++;
            resultados.detalles_exito.push({
                pedido: idPedido,
                factura: facturaData.numero_completo || facturaData.numero_consecutivo
            });
        } catch (error) {
            resultados.fallidos++;
            resultados.detalles_error.push({ pedido: idPedido, motivo: error.message });
        }
    }

    return { success: true, mensaje: `Lote finalizado: ${resultados.procesados}/${resultados.total}`, data: resultados };
  }

  // ==========================================================
  // 5. LISTAR Y BUSCAR
  // ==========================================================
  async findAll(idEmpresa: string, idCliente?: string, soloPendientes?: boolean) {
    const opcionesBusqueda: any = {
      where: { empresa: { id: idEmpresa } },
      order: { fecha_emision: 'DESC' },
      relations: ['detalles', 'detalles.producto', 'vendedor', 'cliente'],
    };
  
    if (idCliente) {
      opcionesBusqueda.where.cliente = { id_cliente: idCliente };
    }
  
    if (soloPendientes) {
      opcionesBusqueda.where.estado = EstadoFactura.PENDIENTE;
    }
  
    try {
      return await this.dataSource.getRepository(Factura).find(opcionesBusqueda);
    } catch (error) {
      this.logger.error(`Error buscando facturas: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAging(query: AgingQueryDto) {
    const { id_empresa, vendedor } = query;
  
    const qb = this.dataSource.getRepository(Factura)
      .createQueryBuilder('f')
      .innerJoin('f.cliente', 'cli')
      .leftJoin('f.vendedor', 'ven')
      .where('f.id_empresa = :id_empresa', { id_empresa })
      .andWhere('f.estado != :anulada',    { anulada: 'ANULADA' })
      .andWhere('f.saldo_pendiente > 0.01')
      .select([
        'f.id_factura                                         AS id_factura',
        'f.serie                                              AS serie',
        'f.numero_consecutivo                                 AS numero_consecutivo',
        'cli.razon_social                                     AS cliente_razon_social',
        'cli.rif                                              AS cliente_rif',
        'ven.nombre_apellido                                  AS vendedor',
        'f.fecha_emision                                      AS fecha_emision',
        'f.fecha_vencimiento                                  AS fecha_vencimiento',
        'f.total_pagar                                        AS total_pagar',
        'f.saldo_pendiente                                    AS saldo_pendiente',
  
        // Días vencidos (negativo = aún no vence)
        `GREATEST(0, CURRENT_DATE - f.fecha_vencimiento::date)
                                                              AS dias_vencidos`,
  
        // Clasificación aging por tramos
        `CASE WHEN CURRENT_DATE <= f.fecha_vencimiento::date
              THEN f.saldo_pendiente ELSE 0 END               AS no_vencido`,
  
        `CASE WHEN CURRENT_DATE - f.fecha_vencimiento::date BETWEEN 1  AND 30
              THEN f.saldo_pendiente ELSE 0 END               AS d0_30`,
  
        `CASE WHEN CURRENT_DATE - f.fecha_vencimiento::date BETWEEN 31 AND 60
              THEN f.saldo_pendiente ELSE 0 END               AS d30_60`,
  
        `CASE WHEN CURRENT_DATE - f.fecha_vencimiento::date BETWEEN 61 AND 90
              THEN f.saldo_pendiente ELSE 0 END               AS d60_90`,
  
        `CASE WHEN CURRENT_DATE - f.fecha_vencimiento::date > 90
              THEN f.saldo_pendiente ELSE 0 END               AS d_mas_90`,
      ]);
  
    // Filtro opcional por vendedor
    if (vendedor) {
      qb.andWhere('f.id_vendedor = :vendedor', { vendedor });
    }
  
    const rows = await qb.getRawMany();
  
    // Castear + construir KPIs en el service (no en el frontend)
    const facturas = rows.map((r) => ({
      id_factura:          r.id_factura,
      serie:               r.serie,
      numero_consecutivo:  Number(r.numero_consecutivo),
      cliente: {
        razon_social:      r.cliente_razon_social,
        rif:               r.cliente_rif,
      },
      vendedor:            r.vendedor ?? null,
      fecha_emision:       r.fecha_emision,
      fecha_vencimiento:   r.fecha_vencimiento,
      total_pagar:         Number(r.total_pagar),
      saldo_pendiente:     Number(r.saldo_pendiente),
      dias_vencidos:       Number(r.dias_vencidos),
      no_vencido:          Number(r.no_vencido),
      d0_30:               Number(r.d0_30),
      d30_60:              Number(r.d30_60),
      d60_90:              Number(r.d60_90),
      d_mas_90:            Number(r.d_mas_90),
    }));
  
    const kpis = {
      total_deuda:     facturas.reduce((s, f) => s + f.saldo_pendiente, 0),
      total_vencido:   facturas.reduce((s, f) => s + f.d0_30 + f.d30_60 + f.d60_90 + f.d_mas_90, 0),
      clientes_activos: new Set(facturas.map((f) => f.cliente.rif)).size,
    };
  
    return { kpis, facturas };
  }

  async getReporteVentas(query: ReporteVentasQueryDto) {
    const { id_empresa, fecha_inicio, fecha_fin, vendedor, marca, categoria } = query;
  
    const qb = this.dataSource.getRepository(FacturaDetalle)
      .createQueryBuilder('d')
      .innerJoin('d.factura',   'f')
      .innerJoin('d.producto',  'p')
      .leftJoin('f.vendedor',   'ven')
      // Solo facturas de la empresa y que NO estén anuladas
      .where('f.id_empresa = :id_empresa', { id_empresa })
      .andWhere("f.estado != 'ANULADA'")
      .select([
        'd.id                                                  AS id_detalle',
        'f.fecha_emision                                       AS fecha',
        `CONCAT(f.serie, '-', LPAD(f.numero_consecutivo::text, 6, '0'))       AS nro_factura`,
        'ven.nombre_apellido                                   AS vendedor',
        'p.codigo                                              AS codigo',
        'p.nombre                                              AS producto',
        'p.marca                                               AS marca',
        'p.categoria                                            AS categoria',
        'd.cantidad                                            AS cantidad',
  
        // Costo histórico: guardado en el detalle al momento de facturar.
        // Si tu entidad lo llama costo_unitario, ajusta aquí.
        'd.costo_historico                                     AS costo_unitario',
        'd.precio_unitario                                     AS precio_venta',
        'd.total_linea                                         AS total_venta',
  
        // Ganancia y margen calculados en SQL (los costos NUNCA salen al frontend)
        '(d.total_linea - d.costo_historico * d.cantidad)       AS ganancia',
        `CASE
           WHEN d.total_linea = 0 THEN 0
           ELSE ROUND(
             (d.total_linea - d.costo_historico * d.cantidad)
             / d.total_linea * 100
           , 2)
         END                                                   AS margen_porcentaje`,
  
        'f.estado                                              AS estado',
      ]);
  
    // ── Filtros opcionales ──────────────────────────────────────
    if (fecha_inicio) {
      qb.andWhere('f.fecha_emision >= :fecha_inicio', { fecha_inicio });
    }
    if (fecha_fin) {
      // Incluir todo el día final
      qb.andWhere('f.fecha_emision < :fecha_fin_excl', {
        fecha_fin_excl: new Date(
          new Date(fecha_fin).setDate(new Date(fecha_fin).getDate() + 1),
        ).toISOString().split('T')[0],
      });
    }
    if (vendedor) {
      qb.andWhere('f.id_vendedor = :vendedor', { vendedor });
    }
    if (marca) {
      qb.andWhere('p.marca = :marca', { marca });
    }
    if (categoria) {
      qb.andWhere('p.categoria = :categoria', { categoria });;
    }
  
    qb.orderBy('f.fecha_emision', 'DESC').addOrderBy('d.id', 'ASC')
  
    const rows = await qb.getRawMany();
  
    const lineas = rows.map((r) => ({
      id_detalle:        r.id_detalle,
      fecha:             r.fecha,
      nro_factura:       r.nro_factura,
      vendedor:          r.vendedor    ?? null,
      codigo:            r.codigo,
      producto:          r.producto,
      marca:             r.marca       ?? null,
      categoria:         r.categoria   ?? null,
      cantidad:          Number(r.cantidad),
      costo_total:       Number(r.costo_unitario) * Number(r.cantidad),
      precio_venta:      Number(r.precio_venta),
      total_venta:       Number(r.total_venta),
      ganancia:          Number(r.ganancia),
      margen_porcentaje: Number(r.margen_porcentaje),
      estado:            r.estado,
    }));
  
    // KPIs agregados en el service — el frontend solo renderiza
    const kpis = {
      total_venta:    lineas.reduce((s, l) => s + l.total_venta,   0),
      total_costo:    lineas.reduce((s, l) => s + l.costo_total,   0),
      total_ganancia: lineas.reduce((s, l) => s + l.ganancia,      0),
      margen_global:
        lineas.reduce((s, l) => s + l.total_venta, 0) === 0
          ? 0
          : Math.round(
              (lineas.reduce((s, l) => s + l.ganancia,    0) /
               lineas.reduce((s, l) => s + l.total_venta, 0)) * 10000,
            ) / 100,
    };
  
    return { kpis, lineas };
  }

  async findOne(id: string) {
      return await this.dataSource.getRepository(Factura).findOne({
          where: { id_factura: id },
          relations: ['detalles', 'detalles.producto', 'cliente', 'vendedor']
      });
  }
}