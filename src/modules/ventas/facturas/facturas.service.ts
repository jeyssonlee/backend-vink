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

@Injectable()
export class FacturasService {
  private readonly logger = new Logger(FacturasService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly productosService: ProductosService, 
  ) {}

  // ==========================================================
  // 1. CREAR FACTURA
  // ==========================================================
  async crear(dto: CrearFacturaDto) {
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
          relations: ['detalles', 'detalles.producto', 'cliente']
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
        
        // 1. Validar Cliente (Obligatorio para facturar)
        if (!dto.id_cliente) throw new BadRequestException("El cliente es obligatorio para venta directa");
        
        cliente = await queryRunner.manager.findOne(Cliente, { 
            where: { id_cliente: dto.id_cliente, empresa: { id: idEmpresa } } 
        });
        if (!cliente) throw new NotFoundException("Cliente no encontrado");

        // 2. Preparar Items
        for (const itemDto of dto.items) {
            const producto = await queryRunner.manager.findOne(Producto, { 
                where: { id_producto: itemDto.id_producto, empresa: { id: idEmpresa } } 
            });
            
            if (!producto) throw new NotFoundException(`Producto ${itemDto.id_producto} no encontrado`);

            // Usar precio personalizado SI existe, sino el precio base del producto
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
        
        // 🛡️ CORRECCIÓN 1: Validar Costo (parseFloat puede dar NaN si viene basura)
        let costoUnitario = 0;
        if (costoData.length > 0 && costoData[0].costo_unitario != null) {
            costoUnitario = parseFloat(costoData[0].costo_unitario);
            if (isNaN(costoUnitario)) costoUnitario = 0; // Protección extra
        }

        // 🛡️ CORRECCIÓN 2: Validar Precio Venta y Cantidad
        // Usamos ( || 0) para que si es undefined o null, se convierta en 0 antes de Number()
        const precioVenta = Number(item.precio || 0); 
        const cantidad = Number(item.cantidad || 0);
        
        // Ahora los cálculos son seguros
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
            ganancia_neta: (precioVenta - costoUnitario) * cantidad, // Seguro
            total_linea: totalLinea // Seguro
        });
        detallesFactura.push(detalle);
      }

      // Totales
      const descuentoGlobal = dto.descuento_global_monto || 0;
      const baseImponible = subtotalBase - descuentoGlobal;
      const montoIva = baseImponible * 0.16;
      const totalPagar = baseImponible + montoIva;

      // --- 🛡️ CONTROL DE NUMERACIÓN Y ESTADO ---
      const esBorrador = dto.estado === EstadoFactura.BORRADOR;
      let numeroConsecutivo: number | null = null; 
      let serie = 'A'; 

      if (!esBorrador) {
        // 1. Obtener último número
        const ultima = await queryRunner.manager.findOne(Factura, {
            where: { empresa: { id: idEmpresa }, serie: serie },
            order: { numero_consecutivo: 'DESC' },
            lock: { mode: 'pessimistic_write' } 
        });
        numeroConsecutivo = ultima ? ultima.numero_consecutivo + 1 : 1;

        // 2. Doble Check de Seguridad
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
        vendedor: { id_usuario: dto.id_usuario } as import('typeorm').DeepPartial<Factura>['vendedor'],
        detalles: detallesFactura
      };

      const nuevaFactura = queryRunner.manager.create(Factura, datosFactura);
      const facturaGuardada = await queryRunner.manager.save(nuevaFactura);

      // --- MOVIMIENTO DE INVENTARIO ---
      if (!esBorrador) {
        if (dto.id_pedido) {
            // CASO A: Venimos de un Pedido (Stock estaba 'Apartado', lo sacamos definitivamente)
            for (const det of detallesFactura) {
                await this.productosService.finalizarSalida(
                    det.producto.id_producto,
                    det.cantidad,
                    idEmpresa,
                    queryRunner
                );
            }
            await queryRunner.manager.update(Pedido, dto.id_pedido, { estado: 'FACTURADO' as any });

        } else {
            // CASO B: Venta Directa (Stock está 'Disponible', lo restamos del Almacén General)
            const almacenVenta = await queryRunner.manager.findOne(Almacen, {
                where: { empresa: { id: idEmpresa }, es_venta: true }
            });
            if (!almacenVenta) throw new ConflictException("No se encontró un Almacén de Venta configurado para descontar stock.");

            for (const det of detallesFactura) {
                // Restamos directamente de inventarios
                await queryRunner.manager.query(`
                    UPDATE inventarios 
                    SET cantidad = cantidad - $1, updated_at = NOW()
                    WHERE id_producto = $2 AND id_almacen = $3 AND id_empresa = $4
                `, [det.cantidad, det.producto.id_producto, almacenVenta.id_almacen, idEmpresa]);
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
  // 2. ANULAR FACTURA 🛡️
  // ==========================================================
  async anular(idFactura: string, motivo: string, idUsuario: string, idEmpresa: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Obtener Factura con Detalles
      const factura = await queryRunner.manager.findOne(Factura, {
        where: { id_factura: idFactura, empresa: { id: idEmpresa } },
        relations: ['detalles', 'detalles.producto']
      });

      if (!factura) throw new NotFoundException('Factura no encontrada');

      // 2. Validaciones de Seguridad 🔒
      if (factura.estado === EstadoFactura.ANULADA) {
        throw new BadRequestException('Esta factura ya está anulada. No se puede anular dos veces.');
      }
      if (factura.estado === EstadoFactura.BORRADOR) {
        throw new BadRequestException('Los borradores se eliminan, no se anulan.');
      }

      // 3. Revertir Stock (Devolver al Almacén de Venta) 📦
      for (const det of factura.detalles) {
        if (det.producto) { 
            // 🛑 CORREGIDO: Eliminamos el 5to argumento que causaba el error
            // Se usarán solo 4 argumentos que es lo que acepta tu ProductosService actual.
            await this.productosService.revertirVenta(
                det.producto.id_producto, 
                Number(det.cantidad), 
                idEmpresa, 
                queryRunner
            );
        }
      }

      // 4. Actualizar Estado de Factura
      factura.estado = EstadoFactura.ANULADA;
      
      this.logger.warn(`Factura ${factura.numero_completo} anulada por usuario ${idUsuario}. Motivo: ${motivo}`);

      await queryRunner.manager.save(factura);

      // 5. Liberar Pedido (Opcional)
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
  // 3. CONFIRMAR BORRADOR
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
  
        // Check Concurrencia
        const ultima = await queryRunner.manager.findOne(Factura, {
          where: { empresa: { id: idEmpresa }, serie: factura.serie },
          order: { numero_consecutivo: 'DESC' },
          lock: { mode: 'pessimistic_write' }
        });
        const nuevoNumero = ultima ? ultima.numero_consecutivo + 1 : 1;

        // Doble Check
        const duplicada = await queryRunner.manager.findOne(Factura, {
            where: { empresa: { id: idEmpresa }, serie: factura.serie, numero_consecutivo: nuevoNumero }
        });
        if (duplicada) throw new ConflictException(`Error de concurrencia al confirmar. Intente de nuevo.`);
  
        // Finalizar Salida de Stock
        for (const det of factura.detalles) {
          if (factura.id_pedido_origen) {
               await this.productosService.finalizarSalida(
                 det.producto.id_producto,
                 det.cantidad,
                 idEmpresa,
                 queryRunner
               );
          }
        }
  
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
        return { success: true, numero: factura.numero_completo };
  
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

    for (const idPedido of dto.ids_pedidos) {
        try {
            const respuesta = await this.crear({
                id_pedido: idPedido,
                id_empresa: idEmpresa,
                id_usuario: idUsuario,
                metodo_pago: dto.metodo_pago_defecto || MetodoPago.CREDITO, 
                estado: EstadoFactura.PENDIENTE 
            });

            const facturaData = (respuesta.data as any);

            resultados.procesados++;
            resultados.detalles_exito.push({
                pedido: idPedido,
                factura: facturaData.numero_completo || facturaData.numero_consecutivo
            });

        } catch (error) {
            resultados.fallidos++;
            resultados.detalles_error.push({
                pedido: idPedido,
                motivo: error.message
            });
        }
    }

    return {
        success: true,
        mensaje: `Lote finalizado. Éxito: ${resultados.procesados}/${resultados.total}`,
        data: resultados
    };
  }

  // ==========================================================
  // 5. LISTAR Y BUSCAR
  // ==========================================================
  async findAll(idEmpresa: string) {
    return await this.dataSource.getRepository(Factura).find({
        where: { empresa: { id: idEmpresa } },
        order: { fecha_emision: 'DESC' }, // Mejor ordenar por fecha para reportes
        relations: [
          'cliente',
          'vendedor',           // 👈 Necesario para filtrar por vendedor
          'detalles',           // 👈 Vital: Las líneas de la factura
          'detalles.producto'   // 👈 Vital: Para saber Marca y Categoría
        ]
    });
}

  async findOne(id: string) {
      return await this.dataSource.getRepository(Factura).findOne({
          where: { id_factura: id },
          relations: ['detalles', 'detalles.producto', 'cliente', 'vendedor']
      });
  }
}