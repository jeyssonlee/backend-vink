import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { PedidosService } from '../ventas/pedidos/pedidos.service'; 
import { ProductosService } from '../inventario/productos/productos.service';
import * as clc from 'cli-color';

@Injectable()
export class SyncService {  
  private readonly logger = new Logger(SyncService.name); 

  constructor(
    private readonly pedidosService: PedidosService,
    private readonly productosService: ProductosService,
  ) {}

  // ======================================================
  // 1. SUSCRIPTORES DE RABBITMQ (Nombres actualizados)
  // ======================================================

  @RabbitSubscribe({
    exchange: 'exchange.sync',
    routingKey: 'sale.placed',
    queue: 'queue.sync.ventas.nuevas',
  })
  async handleRabbitNuevaVenta(msg: any) {
    this.logger.log(`📥 [Sync] Pedido recibido de la nube: ${msg.id_pedido_local}`);
    try {
      await this.pedidosService.crearPedido(msg);
      this.logger.log(`✅ Pedido ${msg.id_pedido_local} registrado y stock APARTADO`);
    } catch (error) {
      this.logger.error(`❌ Error en Sync (Venta): ${error.message}`);
    }
  }

  @RabbitSubscribe({
    exchange: 'exchange.sync',
    routingKey: 'catalogo.update',
    queue: 'queue.sync.catalogo.update',
  })
  async handleRabbitSyncCatalogo(msg: any[]) {
    await this.sincronizarCatalogo(msg);
  }

  @RabbitSubscribe({
    exchange: 'exchange.sync',
    routingKey: 'sale.cancelled',
    queue: 'queue.sync.ventas.anulaciones',
  })
  async handleRabbitAnular(msg: any) {
    await this.anularPedido(msg);
  }

  @RabbitSubscribe({
    exchange: 'exchange.sync',
    routingKey: 'sale.delivered',
    queue: 'queue.sync.ventas.finalizar',
  })
  async handleRabbitFinalizar(msg: any) {
    await this.finalizarVenta(msg);
  }

  // ======================================================
  // 2. MÉTODOS DE LÓGICA (Sin cambios)
  // ======================================================

  async sincronizarCatalogo(msg: any[]) {
    console.log('\n' + clc.yellow('--- 🔄 [Sync] INICIANDO SINCRONIZACIÓN DE CATÁLOGO ---'));

    for (const prod of msg) {
      try {
        const res = await this.productosService.validarYProcesarProducto(prod);
        console.log(clc.cyan('[SYNC]') + ` ${prod.id_producto} - ${prod.nombre}`);
      } catch (error) {
        console.log(clc.red(`❌ Error en ${prod.id_producto || 'ID Desconocido'}: `) + error.message);
      }
    }
    console.log('\n' + clc.green('--- ✅ SINCRONIZACIÓN FINALIZADA --- \n'));
  }

  async anularPedido(msg: any) {
    const id = msg.id_pedido_local || msg;
    const idEmpresa = msg.id_empresa;

    console.log(clc.red(`\n--- ❌ [Sync] PROCESANDO ANULACIÓN: ${id} ---`));
    try {
      if (!idEmpresa) throw new Error('El mensaje de anulación no contiene id_empresa');

      const resultado = await this.pedidosService.anularPedido(id, idEmpresa);
      
      if (resultado.success) {
        console.log(clc.green(`✅ ${resultado.message}`));
      } else {
        console.log(clc.yellow(`${resultado.message}`));
      }
      return resultado;
    } catch (error) {
      console.log(clc.red(`❌ Error al anular: ${error.message}`));
      return { success: false, message: error.message };
    }
  }

  async finalizarVenta(msg: any) {
    const id_pedido_local = msg.id_pedido_local || msg;
    const idEmpresa = msg.id_empresa;

    console.log(clc.blue(`\n--- 📦 [Sync] COMPLETANDO SALIDA FINAL: ${id_pedido_local} ---`));
    
    try {
      if (!idEmpresa) throw new Error('El mensaje de finalización no contiene id_empresa');

      const resultado = await this.pedidosService.completarVenta(id_pedido_local, idEmpresa);
      
      if (resultado.success) {
        console.log(clc.green(`✅ ${resultado.message}`));
      } else {
        console.log(clc.yellow(`⚠️ ${resultado.message}`));
      }
      return resultado;
    } catch (error) {
      console.log(clc.red(`❌ Error al completar venta: ${error.message}`));
      return { success: false, message: error.message };
    }
  }
}