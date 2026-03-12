import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { Pedido, ESTADOS_EDITABLES, ESTADOS_CON_STOCK } from './entities/pedido.entity';
import { PedidoDetalle } from './entities/pedido-detalle.entity';
import { SyncPedidoDto } from '../../sync/dtos/sync-pedido.dto';
import { CreatePedidoDto, RechazarPedidoDto, FacturarLoteDto } from './dto/create-pedido.dto';
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

  // ================================================================
  // GENERADOR DE NÚMERO CORRELATIVO  (PED-0001, PED-0002 ...)
  // ================================================================
  private async generarNumeroPedido(empresaId: string): Promise<string> {
    const count = await this.pedidoRepo.count({ where: { id_empresa: empresaId } });
    const correlativo = String(count + 1).padStart(4, '0');
    return `PED-${correlativo}`;
  }

  // ================================================================
  // CREACIÓN DESDE WEB (BORRADOR — sin movimiento de stock)
  // ================================================================

  async crearPedidoWeb(dto: CreatePedidoDto, vendedorId: string, empresaId: string): Promise<Pedido> {
    const numeroPedido = await this.generarNumeroPedido(empresaId);
    const pedido = this.pedidoRepo.create({
      id_pedido_local: dto.id_pedido_local || uuidv4(),
      numero_pedido: numeroPedido,
      id_empresa: empresaId,
      id_cliente: dto.id_cliente,
      id_vendedor: vendedorId,
      nota: dto.nota || undefined,
      metodo_pago: dto.metodo_pago || 'CREDITO',
      dias_credito: dto.dias_credito ?? 15,
      estado: 'BORRADOR',
      total: 0,
    });

    const saved = await this.pedidoRepo.save(pedido) as Pedido;

    let total = 0;
    const detalles = dto.detalles.map(d => {
      total += Number(d.cantidad) * Number(d.precio_unitario);
      return this.detalleRepo.create({
        id_pedido: saved.id_pedido,
        id_producto: d.id_producto,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
      });
    });

    await this.detalleRepo.save(detalles);
    await this.pedidoRepo.update(saved.id_pedido, { total });

    this.logger.log(`📝 Pedido BORRADOR creado: ${saved.id_pedido}`);
    return this.obtenerDetalle(saved.id_pedido, empresaId);
  }

  // ================================================================
  // ENVIAR PEDIDO: BORRADOR/RECHAZADO → ENVIADO (aparta stock)
  // ================================================================

  async enviarPedido(idPedido: string, empresaId: string) {
    const pedido = await this.pedidoRepo.findOne({
      where: { id_pedido: idPedido, id_empresa: empresaId },
      relations: ['detalles'],
    });

    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    if (!['BORRADOR', 'RECHAZADO'].includes(pedido.estado)) {
      throw new BadRequestException(`No se puede enviar un pedido en estado ${pedido.estado}`);
    }
    if (!pedido.detalles || pedido.detalles.length === 0) {
      throw new BadRequestException('El pedido no tiene productos. Agrega al menos uno antes de enviar.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const detalle of pedido.detalles) {
        await this.productosService.apartarStock(
          detalle.id_producto,
          Number(detalle.cantidad),
          empresaId,
          queryRunner,
        );
      }

      await queryRunner.manager.update(Pedido, idPedido, { estado: 'ENVIADO' });
      await queryRunner.commitTransaction();

      this.logger.log(`📤 Pedido ${idPedido} ENVIADO a bandeja de revisión`);
      return { success: true, message: 'Pedido enviado para revisión' };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Error enviando pedido: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ================================================================
  // EDITAR PEDIDO (BORRADOR, ENVIADO, REVISADO, RECHAZADO)
  // Si estaba ENVIADO o REVISADO → vuelve a ENVIADO automáticamente
  // ================================================================

  async editarPedido(idPedido: string, dto: CreatePedidoDto, empresaId: string) {
    const pedido = await this.pedidoRepo.findOne({
      where: { id_pedido: idPedido, id_empresa: empresaId },
      relations: ['detalles'],
    });

    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    if (!ESTADOS_EDITABLES.includes(pedido.estado)) {
      throw new BadRequestException(`No se puede editar un pedido en estado ${pedido.estado}`);
    }

    // Solo ENVIADO y REVISADO tienen stock apartado que hay que revertir
    const tieneStockApartado = ESTADOS_CON_STOCK.includes(pedido.estado);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Revertir stock si lo tenía apartado
      if (tieneStockApartado && pedido.detalles) {
        for (const detalle of pedido.detalles) {
          await this.productosService.revertirApartado(
            detalle.id_producto,
            Number(detalle.cantidad),
            empresaId,
            queryRunner,
          );
        }
      }

      // 2. Borrar detalles viejos
      await queryRunner.manager.delete(PedidoDetalle, { id_pedido: idPedido });

      // 3. Insertar nuevos detalles (y apartar stock si aplica)
      let total = 0;
      for (const item of dto.detalles) {
        const nuevoDetalle = this.detalleRepo.create({
          id_pedido: idPedido,
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
        });
        await queryRunner.manager.save(nuevoDetalle);

        if (tieneStockApartado) {
          await this.productosService.apartarStock(
            item.id_producto,
            Number(item.cantidad),
            empresaId,
            queryRunner,
          );
        }

        total += Number(item.cantidad) * Number(item.precio_unitario);
      }

      // 4. Determinar nuevo estado:
      //    Si estaba REVISADO → vuelve a ENVIADO para re-revisión
      //    Si estaba ENVIADO → se queda ENVIADO
      //    Si estaba BORRADOR o RECHAZADO → se queda igual
      let nuevoEstado = pedido.estado;
      if (pedido.estado === 'REVISADO') nuevoEstado = 'ENVIADO';

      // 5. Actualizar cabecera
      await queryRunner.manager.update(Pedido, idPedido, {
        total,
        estado: nuevoEstado,
        nota: dto.nota !== undefined ? dto.nota : pedido.nota,
        metodo_pago: dto.metodo_pago || pedido.metodo_pago,
        dias_credito: dto.dias_credito !== undefined ? dto.dias_credito : pedido.dias_credito,
        id_cliente: dto.id_cliente || pedido.id_cliente,
        // Limpiar datos de revisión si volvió a ENVIADO
        ...(nuevoEstado === 'ENVIADO' && pedido.estado === 'REVISADO'
          ? { revisado_por: undefined, fecha_revision: undefined }
          : {}),
      });

      await queryRunner.commitTransaction();

      this.logger.log(`🔄 Pedido ${idPedido} editado → estado: ${nuevoEstado}`);
      return {
        success: true,
        message: nuevoEstado === 'ENVIADO' && pedido.estado === 'REVISADO'
          ? 'Pedido actualizado y enviado nuevamente a revisión'
          : 'Pedido actualizado correctamente',
        estado: nuevoEstado,
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Error editando pedido: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ================================================================
  // BANDEJA DE REVISIÓN: pedidos ENVIADOS
  // ================================================================

  async obtenerBandeja(empresaId: string, filtros: { vendedorId?: string; ciudad?: string }) {
    const query = this.pedidoRepo
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.cliente', 'cliente')
      .leftJoinAndSelect('pedido.vendedor', 'vendedor')
      .leftJoinAndSelect('pedido.detalles', 'detalles')
      .leftJoinAndSelect('detalles.producto', 'producto')
      .where('pedido.id_empresa = :empresaId', { empresaId })
      .andWhere('pedido.estado IN (:...estados)', { estados: ['ENVIADO', 'APARTADO'] })
      .orderBy('pedido.fecha', 'DESC');

    if (filtros.vendedorId) {
      query.andWhere('pedido.id_vendedor = :vendedorId', { vendedorId: filtros.vendedorId });
    }
    if (filtros.ciudad) {
      query.andWhere('LOWER(cliente.ciudad) LIKE LOWER(:ciudad)', { ciudad: `%${filtros.ciudad}%` });
    }

    return await query.getMany();
  }

  // ================================================================
  // REVISAR PEDIDO: ENVIADO → REVISADO
  // ================================================================

  async revisarPedido(idPedido: string, userId: string, empresaId: string) {
    const pedido = await this.pedidoRepo.findOne({
      where: { id_pedido: idPedido, id_empresa: empresaId },
    });

    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    if (!['ENVIADO', 'APARTADO'].includes(pedido.estado)) {
      throw new BadRequestException(`Solo se pueden revisar pedidos en estado ENVIADO. Estado actual: ${pedido.estado}`);
    }

    await this.pedidoRepo.update(idPedido, {
      estado: 'REVISADO',
      revisado_por: userId,
      fecha_revision: new Date(),
    });

    this.logger.log(`✅ Pedido ${idPedido} marcado como REVISADO por usuario ${userId}`);
    return { success: true, message: 'Pedido marcado como revisado' };
  }

  // ================================================================
  // RECHAZAR PEDIDO: ENVIADO/REVISADO → RECHAZADO (libera stock)
  // ================================================================

  async rechazarPedido(idPedido: string, dto: RechazarPedidoDto, userId: string, empresaId: string) {
    const pedido = await this.pedidoRepo.findOne({
      where: { id_pedido: idPedido, id_empresa: empresaId },
      relations: ['detalles'],
    });

    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    if (!['ENVIADO', 'REVISADO', 'APARTADO'].includes(pedido.estado)) {
      throw new BadRequestException(`No se puede rechazar un pedido en estado ${pedido.estado}`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Liberar stock
      if (pedido.detalles) {
        for (const detalle of pedido.detalles) {
          await this.productosService.revertirApartado(
            detalle.id_producto,
            Number(detalle.cantidad),
            empresaId,
            queryRunner,
          );
        }
      }

      await queryRunner.manager.update(Pedido, idPedido, {
        estado: 'RECHAZADO',
        nota_rechazo: dto.nota_rechazo,
        revisado_por: userId,
        fecha_revision: new Date(),
      });

      await queryRunner.commitTransaction();
      this.logger.log(`🚫 Pedido ${idPedido} RECHAZADO por usuario ${userId}`);
      return { success: true, message: 'Pedido rechazado y stock liberado' };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Error rechazando pedido: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ================================================================
  // PEDIDOS REVISADOS — para pantalla de facturación
  // ================================================================

  async obtenerPedidosRevisados(
    empresaId: string,
    filtros: { vendedorId?: string; ciudad?: string; clienteId?: string },
  ) {
    const query = this.pedidoRepo
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.cliente', 'cliente')
      .leftJoinAndSelect('pedido.vendedor', 'vendedor')
      .leftJoinAndSelect('pedido.detalles', 'detalles')
      .leftJoinAndSelect('detalles.producto', 'producto')
      .where('pedido.id_empresa = :empresaId', { empresaId })
      .andWhere('pedido.estado = :estado', { estado: 'REVISADO' })
      .orderBy('pedido.fecha', 'DESC');

    if (filtros.vendedorId) {
      query.andWhere('pedido.id_vendedor = :vendedorId', { vendedorId: filtros.vendedorId });
    }
    if (filtros.ciudad) {
      query.andWhere('LOWER(cliente.ciudad) LIKE LOWER(:ciudad)', { ciudad: `%${filtros.ciudad}%` });
    }
    if (filtros.clienteId) {
      query.andWhere('pedido.id_cliente = :clienteId', { clienteId: filtros.clienteId });
    }

    return await query.getMany();
  }

  // ================================================================
  // MARCAR COMO FACTURADO (lote) — llamado por módulo de facturación
  // ================================================================

  async marcarComoFacturado(dto: FacturarLoteDto, empresaId: string) {
    // Dejar solo esto — sin queryRunner ni confirmarVenta
    const pedidos = await this.pedidoRepo.find({
      where: {
        id_pedido: In(dto.ids_pedidos),
        id_empresa: empresaId,
        estado: 'REVISADO',
      },
    });
  
    if (pedidos.length === 0) {
      throw new BadRequestException('No se encontraron pedidos REVISADOS');
    }
  
    await this.pedidoRepo.update(
      { id_pedido: In(pedidos.map(p => p.id_pedido)) },
      { estado: 'FACTURADO' },
    );
  
    return { success: true, message: `${pedidos.length} pedido(s) marcados como facturados` };
  }
  // ================================================================
  // MIS PEDIDOS (vendedor ve solo los suyos)
  // ================================================================

  async obtenerMisPedidos(vendedorId: string, empresaId: string, estado?: string) {
    const where: any = { id_vendedor: vendedorId, id_empresa: empresaId };
    if (estado) where.estado = estado;

    return await this.pedidoRepo.find({
      where,
      relations: ['cliente', 'detalles'],
      order: { fecha: 'DESC' },
    });
  }

  // ================================================================
  // LISTADO GENERAL (admin/encargado ve todos)
  // ================================================================

  async obtenerTodos(empresaId: string, estado?: string) {
    const query = this.pedidoRepo
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.cliente', 'cliente')
      .leftJoinAndSelect('pedido.vendedor', 'vendedor')
      .where('pedido.id_empresa = :empresaId', { empresaId })
      .orderBy('pedido.fecha', 'DESC');

    if (estado) {
      query.andWhere('pedido.estado = :estado', { estado });
    }

    return await query.getMany();
  }

  // ================================================================
  // DETALLE DE UN PEDIDO
  // ================================================================

  async obtenerDetalle(idPedido: string, empresaId: string) {
    const pedido = await this.pedidoRepo.findOne({
      where: { id_pedido: idPedido, id_empresa: empresaId },
      relations: ['cliente', 'vendedor', 'detalles', 'detalles.producto'],
    });

    if (!pedido) throw new NotFoundException(`Pedido ${idPedido} no encontrado`);
    return pedido;
  }

  // ================================================================
  // ANULAR PEDIDO (libera stock si lo tenía)
  // ================================================================

  async anularPedido(idPedido: string, empresaId?: string) {
    const whereClause: any = { id_pedido: idPedido };
    if (empresaId) whereClause.id_empresa = empresaId;

    const pedido = await this.pedidoRepo.findOne({
      where: whereClause,
      relations: ['detalles'],
    });

    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    if (pedido.estado === 'ANULADO') throw new BadRequestException('El pedido ya está anulado');
    if (pedido.estado === 'FACTURADO') throw new BadRequestException('No se puede anular un pedido ya facturado');

    const tieneStock = ESTADOS_CON_STOCK.includes(pedido.estado);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (tieneStock && pedido.detalles) {
        const idEmpresaFinal = empresaId ?? pedido.id_empresa;
        for (const detalle of pedido.detalles) {
          await this.productosService.revertirApartado(
            detalle.id_producto,
            Number(detalle.cantidad),
            idEmpresaFinal,
            queryRunner,
          );
        }
      }

      await queryRunner.manager.update(Pedido, idPedido, { estado: 'ANULADO' });
      await queryRunner.commitTransaction();

      this.logger.log(`🚫 Pedido ${idPedido} ANULADO`);
      return { success: true, message: 'Pedido anulado correctamente' };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Error anulando pedido: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ================================================================
  // SYNC APP MÓVIL (llega directo como ENVIADO — backward compat)
  // ================================================================

  async crearPedido(dto: SyncPedidoDto) {
    const existe = await this.pedidoRepo.findOne({
      where: { id_pedido_local: dto.id_pedido_local },
    });

    if (existe) {
      this.logger.warn(`⚠️ Pedido ${dto.id_pedido_local} ya existe. Ignorando.`);
      return existe;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const numeroPedido = await this.generarNumeroPedido(dto.id_empresa);
      const nuevoPedido = this.pedidoRepo.create({
        id_pedido_local: dto.id_pedido_local,
        numero_pedido: numeroPedido,
        id_empresa: dto.id_empresa,
        id_cliente: dto.cliente_id,
        id_vendedor: dto.vendedor_id,
        fecha: new Date(dto.fecha),
        estado: 'ENVIADO', // App móvil llega directo a bandeja
        metodo_pago: 'CREDITO',
        dias_credito: 15,
        total: 0,
      });

      const pedidoGuardado = await queryRunner.manager.save(nuevoPedido);

      let totalCalculado = 0;
      const detalles: PedidoDetalle[] = [];

      for (const item of dto.items) {
        const detalle = this.detalleRepo.create({
          pedido: pedidoGuardado,
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
        });

        totalCalculado += Number(item.cantidad) * Number(item.precio_unitario);
        detalles.push(detalle);

        await this.productosService.apartarStock(
          item.id_producto,
          Number(item.cantidad),
          dto.id_empresa,
          queryRunner,
        );
      }

      await queryRunner.manager.save(detalles);
      pedidoGuardado.total = totalCalculado;
      await queryRunner.manager.save(pedidoGuardado);

      await queryRunner.commitTransaction();
      this.logger.log(`✅ Pedido app ${dto.id_pedido_local} guardado como ENVIADO`);

      return pedidoGuardado;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Error sync pedido: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Backward compat — usado por el sync service
  async crearPedidoLocal(createDto: CreatePedidoDto) {
    return await this.crearPedidoWeb(
      createDto,
      createDto.id_vendedor!,
      createDto.id_empresa!,
    );
  }

  async completarVenta(idPedidoLocal: string, idEmpresa: string) {
    const pedido = await this.pedidoRepo.findOne({
      where: { id_pedido_local: idPedidoLocal, id_empresa: idEmpresa },
    });

    if (!pedido) return { success: false, message: 'No encontrado' };
    if (pedido.estado === 'ANULADO') return { success: false, message: 'Está anulado' };

    pedido.estado = 'COMPLETADO';
    await this.pedidoRepo.save(pedido);

    return { success: true, message: 'Finalizado correctamente' };
  }
}