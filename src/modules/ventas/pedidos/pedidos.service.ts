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
      relations: ['detalles', 'detalles.producto', 'cliente', 'vendedor'],
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
  async anularPedido(idPedido: string) { // 👈 Usamos el ID estándar (UUID)
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Buscamos el pedido
      // Usamos findOne normal, sin queryRunner.manager para evitar bloqueos innecesarios en lectura
      // o puedes usar queryRunner.manager.findOne si prefieres consistencia total.
      const pedido = await this.pedidoRepo.findOne({
        where: [
            { id_pedido: idPedido },         // Intenta por UUID
            { id_pedido_local: idPedido }    // Intenta por ID Local (por si acaso)
        ],
        relations: ['detalles']
      });

      if (!pedido) throw new NotFoundException(`Pedido no encontrado.`);
      if (pedido.estado === 'ANULADO') throw new Error(`El pedido ya estaba anulado.`);
      if (pedido.estado === 'COMPLETADO') throw new Error(`No se puede anular un pedido completado.`);

      // 2. REVERTIR STOCK (Usando el servicio oficial que conecta con KARDEX)
      // Esto reemplaza todo tu bloque de SQL manual (pasos 2 y 3 anteriores)
      if (pedido.detalles) {
        for (const detalle of pedido.detalles) {
           await this.productosService.revertirApartado(
             detalle.id_producto,
             Number(detalle.cantidad),
             pedido.id_empresa,
             queryRunner // ✅ Pasamos la transacción para que sea seguro
           );
        }
      }

      // 3. CAMBIAR ESTADO (Usando UPDATE directo)
      // Usamos .update() para evitar el error de "id_pedido is null" que nos dio dolor de cabeza antes.
      await queryRunner.manager.update(Pedido, pedido.id_pedido, { 
          estado: 'ANULADO',
          fecha: new Date() // Actualizamos fecha si quieres registrar cuándo se anuló
      });

      await queryRunner.commitTransaction();
      this.logger.log(`🚫 Pedido ${pedido.id_pedido} ANULADO y stock liberado en Kardex.`);
      
      return { success: true, message: `Pedido anulado y registrado en Kardex.` };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error anulando pedido: ${error.message}`);
      // Lanza la excepción para que el Frontend reciba el error 400/500
      throw error; 
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

  // 👇 MÉTODO CORREGIDO Y VERIFICADO
  async actualizarPedido(idPedido: string, updateDto: CreatePedidoDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. LEER DATOS VIEJOS (Solo para saber qué stock devolver)
      // Usamos 'getMany' o 'findOne' pero NO guardaremos este objeto después.
      const pedidoOriginal = await this.pedidoRepo.findOne({
        where: { id_pedido: idPedido },
        relations: ['detalles']
      });

      if (!pedidoOriginal) throw new NotFoundException('Pedido no encontrado');
      if (pedidoOriginal.estado !== 'APARTADO' && pedidoOriginal.estado !== 'PENDIENTE') {
        throw new Error('Solo se pueden editar pedidos en estado APARTADO o PENDIENTE');
      }

      // 2. DEVOLVER STOCK VIEJO
      if (pedidoOriginal.detalles) {
        for (const detalle of pedidoOriginal.detalles) {
          await this.productosService.revertirApartado(
            detalle.id_producto,
            Number(detalle.cantidad),
            pedidoOriginal.id_empresa,
            queryRunner
          ); 
        }
      }

      // 3. BORRAR DETALLES VIEJOS (Usando ID explícito para asegurar borrado)
      // Usamos delete directo sin depender de relaciones de objetos
      await queryRunner.manager.delete(PedidoDetalle, { id_pedido: idPedido });

      // 4. INSERTAR NUEVOS DETALLES
      let total = 0;
      for (const item of updateDto.detalles) {
        // A. Validar
        await this.productosService.validarStock(item.id_producto, item.cantidad);

        // B. Crear objeto (Sin relacionar con 'pedidoOriginal')
        const nuevoDetalle = this.detalleRepo.create({
          id_pedido: idPedido, // 👈 Relación por ID directa
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
        });
        
        // C. Guardar
        await queryRunner.manager.save(nuevoDetalle);
        
        // D. Apartar Stock
        await this.productosService.apartarStock(
             item.id_producto, 
             Number(item.cantidad), 
             updateDto.id_empresa,
             queryRunner
        );

        total += Number(item.cantidad) * Number(item.precio_unitario);
      }

      // 5. ACTUALIZAR CABECERA (Usando UPDATE directo)
      // Esto evita que TypeORM intente guardar relaciones huerfanas
      await queryRunner.manager.update(Pedido, idPedido, {
          total: total,
          fecha: new Date(), // Actualizamos fecha a 'ahora'
          id_cliente: updateDto.id_cliente // Actualizamos cliente
      });

      await queryRunner.commitTransaction();
      this.logger.log(`🔄 Pedido ${idPedido} actualizado correctamente.`);
      
      return { success: true, message: 'Pedido actualizado', id: idPedido };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Error actualizando pedido: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}