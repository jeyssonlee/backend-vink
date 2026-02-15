import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid'; 

// Entidades
import { Pedido } from './entities/pedido.entity';
import { PedidoDetalle } from './entities/pedido-detalle.entity';

// DTOs
import { SyncPedidoDto } from '../../sync/dtos/sync-pedido.dto';
import { CreatePedidoDto } from './dto/create-pedido.dto'; 

// Servicios
import { ProductosService } from '../../inventario/productos/productos.service';

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    @InjectRepository(Pedido)
    private readonly pedidoRepo: Repository<Pedido>,
    
    @InjectRepository(PedidoDetalle)
    private readonly detalleRepo: Repository<PedidoDetalle>,

    private readonly dataSource: DataSource,
    private readonly productosService: ProductosService,
  ) {}

  // ======================================================
  // 1. MÉTODOS PARA EL FRONTEND LOCAL
  // ======================================================

  async crearPedidoLocal(createDto: CreatePedidoDto) {
    const syncDto: SyncPedidoDto = {
      id_pedido_local: createDto.id_pedido_local || uuidv4(), 
      id_empresa: createDto.id_empresa,
      cliente_id: createDto.id_cliente,   
      vendedor_id: createDto.id_vendedor, 
      fecha: new Date().toISOString(),    
      items: createDto.detalles.map(d => ({
        id_producto: d.id_producto,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario
      }))
    };

    return await this.crearPedido(syncDto);
  }

  async obtenerTodos() {
    return await this.pedidoRepo.find({
      relations: ['detalles', 'cliente', 'vendedor'], 
      order: { fecha: 'DESC' },
    });
  }

  // ======================================================
  // 2. LÓGICA CORE
  // ======================================================

  async crearPedido(dto: SyncPedidoDto) {
    const existe = await this.pedidoRepo.findOne({ 
      where: { id_pedido_local: dto.id_pedido_local } 
    });

    if (existe) {
      this.logger.warn(`⚠️ Pedido ${dto.id_pedido_local} ya existe. Ignorando.`);
      return existe; 
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const nuevoPedido = this.pedidoRepo.create({
        id_pedido_local: dto.id_pedido_local,
        id_empresa: dto.id_empresa,
        id_cliente: dto.cliente_id,     
        id_vendedor: dto.vendedor_id,   
        fecha: new Date(dto.fecha),
        estado: 'APARTADO',             
        total: 0, 
      });

      const pedidoGuardado = await queryRunner.manager.save(nuevoPedido);

      let totalCalculado = 0;
      const detallesEntities: PedidoDetalle[] = [];

      for (const item of dto.items) {
        const detalle = this.detalleRepo.create({
          pedido: pedidoGuardado,
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
        });

        totalCalculado += Number(item.cantidad) * Number(item.precio_unitario);
        detallesEntities.push(detalle);

        await this.productosService.apartarStock(
            item.id_producto,
            Number(item.cantidad),
            dto.id_empresa,
            queryRunner 
        );
      }

      await queryRunner.manager.save(detallesEntities);

      pedidoGuardado.total = totalCalculado;
      await queryRunner.manager.save(pedidoGuardado);

      await queryRunner.commitTransaction();
      this.logger.log(`✅ Pedido ${dto.id_pedido_local} guardado.`);
      
      return pedidoGuardado;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Error al guardar pedido: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // 👇 LÓGICA DE ANULACIÓN (Mueve stock de Apartados a General)
  async anularPedido(idPedidoLocal: string, idEmpresa: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Buscamos el pedido
      const pedido = await queryRunner.manager.findOne(Pedido, {
        where: { id_pedido_local: idPedidoLocal, id_empresa: idEmpresa },
        relations: ['detalles', 'detalles.producto'],
      });

      if (!pedido) throw new Error(`Pedido no encontrado.`);
      if (pedido.estado === 'ANULADO') throw new Error(`El pedido ya estaba anulado.`);

      // 2. DETECTAR ALMACENES AUTOMÁTICAMENTE
      const almacenApartados = await queryRunner.manager.query(`
        SELECT id_almacen FROM almacenes 
        WHERE id_empresa = $1 AND (nombre ILIKE '%APARTADO%' OR es_venta = false) 
        LIMIT 1
      `, [idEmpresa]);

      const almacenGeneral = await queryRunner.manager.query(`
        SELECT id_almacen FROM almacenes 
        WHERE id_empresa = $1 AND es_venta = true 
        LIMIT 1
      `, [idEmpresa]);

      if (!almacenApartados.length || !almacenGeneral.length) {
        throw new Error('Configuración de almacenes incorrecta.');
      }

      const idOrigen = almacenApartados[0].id_almacen; // Sale de Apartados
      const idDestino = almacenGeneral[0].id_almacen;  // Entra a Venta

      // 3. TRANSFERENCIA DE STOCK 🔄
      for (const detalle of pedido.detalles) {
        // A. RESTAR del Almacén de Apartados
        await queryRunner.manager.query(`
          UPDATE inventarios 
          SET cantidad = cantidad - $1, updated_at = NOW()
          WHERE id_producto = $2 AND id_almacen = $3 AND id_empresa = $4
        `, [detalle.cantidad, detalle.id_producto, idOrigen, idEmpresa]);

        // B. SUMAR al Almacén General (Upsert)
        const existeEnDestino = await queryRunner.manager.query(`
           SELECT 1 FROM inventarios WHERE id_producto = $1 AND id_almacen = $2 LIMIT 1
        `, [detalle.id_producto, idDestino]);

        if (existeEnDestino.length > 0) {
           await queryRunner.manager.query(`
             UPDATE inventarios 
             SET cantidad = cantidad + $1, updated_at = NOW()
             WHERE id_producto = $2 AND id_almacen = $3 AND id_empresa = $4
           `, [detalle.cantidad, detalle.id_producto, idDestino, idEmpresa]);
        } else {
           await queryRunner.manager.query(`
             INSERT INTO inventarios (id_producto, id_almacen, id_empresa, cantidad, costo_unitario, created_at, updated_at)
             SELECT $2, $3, $4, $1, costo_unitario, NOW(), NOW()
             FROM inventarios WHERE id_producto = $2 AND id_almacen = $5 LIMIT 1
           `, [detalle.cantidad, detalle.id_producto, idDestino, idEmpresa, idOrigen]);
        }
      }

      // 4. CAMBIAR ESTADO
      pedido.estado = 'ANULADO';
      await queryRunner.manager.save(pedido);

      await queryRunner.commitTransaction();
      return { success: true, message: `Anulado: Stock movido de APARTADOS a GENERAL.` };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error anulando pedido: ${error.message}`);
      return { success: false, message: error.message };
    } finally {
      await queryRunner.release();
    }
  }

  async completarVenta(idPedidoLocal: string, idEmpresa: string) {
    try {
      const pedido = await this.pedidoRepo.findOne({
        where: { id_pedido_local: idPedidoLocal, id_empresa: idEmpresa },
      });

      if (!pedido) return { success: false, message: `No encontrado.` };
      if (pedido.estado === 'ANULADO') return { success: false, message: `Está anulado.` };

      pedido.estado = 'COMPLETADO';
      await this.pedidoRepo.save(pedido);

      return { success: true, message: `Finalizado correctamente.` };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}