import { Injectable, BadRequestException, Logger, } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { UpdateProductoDto } from './dto/update-prodcuto.dto';
import * as XLSX from 'xlsx';

// Entidades
import { Producto } from './entities/producto.entity';
import { Inventario } from './entities/inventario.entity';
import { Precio } from './entities/precio.entity';

// DTOs
import { CreateProductoDto } from './dto/create-producto.dto';
import { SyncProductoDto } from 'src/modules/sync/dtos/sync-producto.dto';

// 👇 KARDEX
import { KardexService } from '../kardex/kardex.service';
import { TipoMovimiento } from '../kardex/entities/movimiento-kardex.entity';

@Injectable()
export class ProductosService {
  private readonly logger = new Logger(ProductosService.name);

  constructor(
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
    
    @InjectRepository(Inventario)
    private readonly inventarioRepo: Repository<Inventario>,

    @InjectRepository(Precio)
    private readonly precioRepo: Repository<Precio>,

    private readonly kardexService: KardexService, 
  ) {}

  // ======================================================
  // 1. CRUD BÁSICO
  // ======================================================

  async crear(dto: CreateProductoDto) {
    const existe = await this.productoRepo.findOne({ where: { codigo: dto.codigo, id_empresa: dto.id_empresa } });
    if (existe) throw new BadRequestException(`El código "${dto.codigo}" ya existe.`);
    
    const nuevo = new Producto();
    nuevo.id_empresa = dto.id_empresa;
    nuevo.codigo = dto.codigo;
    nuevo.nombre = dto.nombre;
    
    nuevo.marca = (dto.marca || null) as any;
    nuevo.rubro = (dto.rubro || null) as any;
    nuevo.categoria = (dto.categoria || null) as any;
    nuevo.proveedor = (dto.proveedor || null) as any;
    nuevo.descripcion = (dto.descripcion || null) as any;
    nuevo.codigo_barras = (dto.codigo_barras || null) as any;
    nuevo.imagen = (dto.imagen || null) as any;

    const productoGuardado = await this.productoRepo.save(nuevo);

    if (dto.precio_base) {
       const nuevoPrecio = this.precioRepo.create({
          id_producto: productoGuardado.id_producto,
          id_empresa: dto.id_empresa,
          nombre_lista: 'GENERAL',
          valor: dto.precio_base,
          moneda: 'USD'
       });
       await this.precioRepo.save(nuevoPrecio);
    }

    return productoGuardado;
  }

  async crearFichaMaestra(dto: CreateProductoDto) {
    return this.crear(dto);
  }

  async listarTodos(idEmpresa: string) {
    if (!idEmpresa) return [];
    
    // 1. Buscamos la data cruda (Entities)
    const productos = await this.productoRepo.find({ 
      where: { id_empresa: idEmpresa },
      relations: ['inventarios', 'inventarios.almacen', 'precios'] 
    });

    // 2. TRANSFORMACIÓN MÁGICA ✨
    // Convertimos la estructura compleja de TypeORM en un JSON plano y fácil de usar
    return productos.map(p => {
      // A. Calcular Stock Total: Sumamos la cantidad de todos los inventarios encontrados
      const stockTotal = p.inventarios?.reduce((sum, inv) => sum + Number(inv.cantidad || 0), 0) || 0;

      // B. Determinar Precio Real: Buscamos precio de lista 'GENERAL' o usamos el base
      const precioVenta = p.precios?.find(pr => pr.nombre_lista === 'GENERAL')?.valor || p.precio_base || 0;

      return {
        ...p,            // Mantenemos todas las propiedades originales (id, nombre, codigo...)
        stock: stockTotal, // <--- ¡AQUÍ ESTÁ LA SOLUCIÓN! Agregamos el campo que faltaba
        precio_venta: Number(precioVenta), // Estandarizamos el precio
        // Opcional: Si quieres enviar la data más limpia, puedes borrar 'inventarios' aquí
        // inventarios: undefined 
      };
    });
  }

  async obtenerStockDisponible(idProducto: string): Promise<number> {
    const inv = await this.inventarioRepo.findOne({
      where: { producto: { id_producto: idProducto }, almacen: { es_venta: true } }
    });
    return inv ? inv.cantidad : 0;
  }

  async findOne(id: string) {
    const producto = await this.productoRepo.findOne({
      where: { id_producto: id },
      relations: ['precios', 'inventarios']
    });
    if (!producto) throw new NotFoundException(`Producto no encontrado`);
    return producto;
  }

  async update(id: string, updateProductoDto: UpdateProductoDto) {
    const resultado = await this.productoRepo.update(id, updateProductoDto);
    if (resultado.affected === 0) throw new NotFoundException(`Producto no encontrado`);
    return await this.findOne(id);
  }

  async remove(id: string) {
    const resultado = await this.productoRepo.delete(id);
    if (resultado.affected === 0) throw new NotFoundException(`Producto no encontrado`);
    return { message: 'Producto eliminado' };
  }

  // ======================================================
  // 2. LOGÍSTICA (Sincronización de Catálogo)
  // ======================================================

  async validarYProcesarProducto(dto: SyncProductoDto) {
    const { id_producto, id_empresa, nombre, precio, stock, codigo_barras } = dto as any;

    if (!id_empresa) throw new Error('ID Empresa es obligatorio para sincronizar productos');

    try {
      let productoEncontrado = await this.productoRepo.findOne({ 
        where: { id_producto } 
      });

      if (!productoEncontrado) {
        productoEncontrado = await this.productoRepo.findOne({ 
          where: { codigo_barras: codigo_barras, id_empresa } 
        });
      }

      let productoAGuardar: Producto;

      if (!productoEncontrado) {
        productoAGuardar = new Producto();
        productoAGuardar.id_producto = id_producto;
        productoAGuardar.id_empresa = id_empresa;
        productoAGuardar.nombre = nombre;
        productoAGuardar.codigo_barras = codigo_barras;
        productoAGuardar.codigo = codigo_barras || 'SIN-CODIGO';
        
        this.logger.log(`✨ Sync: Creando producto ${nombre}`);
      } else {
        productoAGuardar = productoEncontrado;
        productoAGuardar.nombre = nombre;
        productoAGuardar.codigo_barras = codigo_barras;
        this.logger.log(`🔄 Sync: Actualizando producto ${nombre}`);
      }

      const productoGuardado = await this.productoRepo.save(productoAGuardar);

      // --- B. PRECIO ---
      if (typeof precio === 'number') {
        const LISTA_DEFECTO = 'GENERAL';
        const precioExistente = await this.precioRepo.findOne({
          where: { 
            id_producto: productoGuardado.id_producto,
            id_empresa: id_empresa,
            nombre_lista: LISTA_DEFECTO
          }
        });

        if (precioExistente) {
            await this.precioRepo.update(precioExistente.id_precio, { valor: precio });
        } else {
            const nuevoPrecio = this.precioRepo.create({
                id_producto: productoGuardado.id_producto,
                id_empresa: id_empresa,
                nombre_lista: LISTA_DEFECTO,
                valor: precio,
                moneda: 'USD'
            });
            await this.precioRepo.save(nuevoPrecio);
        }
      }

      // --- C. STOCK ---
      if (typeof stock === 'number') {
        await this.actualizarStockVenta(id_producto, id_empresa, stock, precio || 0);
      }

      return { success: true, id: productoGuardado.id_producto };

    } catch (error) {
      this.logger.error(`❌ Error Sync Producto ${nombre}: ${error.message}`);
      throw error;
    }
  }

  private async actualizarStockVenta(idProducto: string, idEmpresa: string, cantidad: number, costo: number) {
    const queryRunner = this.inventarioRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    try {
      const almacenVenta = await queryRunner.query(
        `SELECT id_almacen FROM almacenes WHERE id_empresa = $1 AND es_venta = true LIMIT 1`,
        [idEmpresa]
      );

      if (almacenVenta.length > 0) {
        const idAlmacen = almacenVenta[0].id_almacen;

        const stockActualResult = await queryRunner.query(
          `SELECT cantidad FROM inventarios WHERE id_producto = $1 AND id_almacen = $2`,
          [idProducto, idAlmacen]
        );
        const stockAnterior = stockActualResult.length > 0 ? parseFloat(stockActualResult[0].cantidad) : 0;
        const diferencia = cantidad - stockAnterior;

        await queryRunner.query(`
          INSERT INTO inventarios (id_producto, id_almacen, id_empresa, cantidad, costo_unitario, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (id_producto, id_almacen) 
          DO UPDATE SET cantidad = $4, costo_unitario = $5, updated_at = NOW();
        `, [idProducto, idAlmacen, idEmpresa, cantidad, costo]);

        if (diferencia !== 0) {
          await this.kardexService.registrar({
            id_empresa: idEmpresa,
            id_almacen: idAlmacen,
            id_producto: idProducto,
            tipo: diferencia > 0 ? TipoMovimiento.AJUSTE_POS : TipoMovimiento.AJUSTE_NEG,
            cantidad: Math.abs(diferencia),
            costo_unitario: costo,
            stock_inicial: stockAnterior, 
            stock_final: cantidad,       
            referencia: 'SYNC-EXTERNA',
            observacion: 'Sincronización de inventario'
          });
        }
      }
    } finally {
      await queryRunner.release();
    }
  }

  // ======================================================
  // 3. MOVIMIENTOS DE INVENTARIO
  // ======================================================

  async validarStockDisponible(idProducto: string, cantidadRequerida: number, idEmpresa: string) {
    const inventario = await this.inventarioRepo.createQueryBuilder('inv')
      .innerJoin('inv.almacen', 'alm')
      .where('inv.id_producto = :idProducto', { idProducto })
      .andWhere('inv.id_empresa = :idEmpresa', { idEmpresa })
      .andWhere('alm.es_venta = :esVenta', { esVenta: true }) 
      .getOne();

    const stockActual = inventario ? inventario.cantidad : 0;
    if (stockActual < cantidadRequerida) {
      throw new BadRequestException(`Stock insuficiente. Disponible: ${stockActual}`);
    }
    return true;
  }

  async apartarStock(idProducto: string, cantidad: number, idEmpresa: string, qr: QueryRunner) {
    const datosFuente = await qr.manager.query(`
      SELECT inv.costo_unitario, alm.id_almacen 
      FROM inventarios inv
      JOIN almacenes alm ON inv.id_almacen = alm.id_almacen
      WHERE inv.id_producto = $1 
        AND inv.id_empresa = $2
        AND alm.es_venta = true
      LIMIT 1
    `, [idProducto, idEmpresa]);

    const costoActual = datosFuente.length > 0 ? parseFloat(datosFuente[0].costo_unitario) : 0;
    const idAlmacenVenta = datosFuente.length > 0 ? datosFuente[0].id_almacen : null;

    if (!idAlmacenVenta) throw new BadRequestException('No se encontró almacén de venta');

    const stockAntRes = await qr.manager.query(
      `SELECT cantidad FROM inventarios WHERE id_producto = $1 AND id_almacen = $2`, 
      [idProducto, idAlmacenVenta]
    );
    const stockAnt = stockAntRes.length > 0 ? parseFloat(stockAntRes[0].cantidad) : 0;

    // A. RESTAR del Almacén Venta
    await qr.manager.query(`
      UPDATE inventarios 
      SET cantidad = cantidad - $1, updated_at = NOW()
      WHERE id_producto = $2 AND id_empresa = $3 AND id_almacen = $4
    `, [cantidad, idProducto, idEmpresa, idAlmacenVenta]);

    // B. SUMAR al Almacén Apartados
    await qr.manager.query(`
      INSERT INTO inventarios (id_producto, id_almacen, id_empresa, cantidad, costo_unitario, updated_at)
      SELECT $1, id_almacen, $2, $3, $4, NOW()
      FROM almacenes WHERE es_venta = false AND id_empresa = $2 LIMIT 1
      ON CONFLICT (id_producto, id_almacen) 
      DO UPDATE SET 
        cantidad = inventarios.cantidad + $3, 
        costo_unitario = $4,
        updated_at = NOW();
    `, [idProducto, idEmpresa, cantidad, costoActual]);
    
    // C. KARDEX (Con transacción)
    await this.kardexService.registrar({
      id_empresa: idEmpresa,
      id_almacen: idAlmacenVenta,
      id_producto: idProducto,
      tipo: TipoMovimiento.APARTADO,
      cantidad: cantidad,
      costo_unitario: costoActual,
      stock_inicial: stockAnt,          
      stock_final: stockAnt - cantidad, 
      referencia: 'PUNTO-VENTA', 
      observacion: 'Apartado de mercancía para pedido'
    }, qr); // 👈 Pasamos QR

    return true;
  }

  async revertirApartado(idProducto: string, cantidad: number, idEmpresa: string, qr: QueryRunner) {
    const almRes = await qr.manager.query(
      `SELECT id_almacen FROM almacenes WHERE es_venta = true AND id_empresa = $1 LIMIT 1`, 
      [idEmpresa]
    );
    const idAlmacenVenta = almRes[0].id_almacen;

    const stockAntRes = await qr.manager.query(
      `SELECT cantidad, costo_unitario FROM inventarios WHERE id_producto = $1 AND id_almacen = $2`, 
      [idProducto, idAlmacenVenta]
    );
    const stockAnt = stockAntRes.length > 0 ? parseFloat(stockAntRes[0].cantidad) : 0;
    const costo = stockAntRes.length > 0 ? parseFloat(stockAntRes[0].costo_unitario) : 0;

    // Restar de Apartados
    await qr.manager.query(`
      UPDATE inventarios SET cantidad = cantidad - $1
      WHERE id_producto = $2 AND id_empresa = $3
      AND id_almacen IN (SELECT id_almacen FROM almacenes WHERE es_venta = false AND id_empresa = $3 LIMIT 1)
    `, [cantidad, idProducto, idEmpresa]);

    // Devolver a Venta
    await qr.manager.query(`
      UPDATE inventarios SET cantidad = cantidad + $1
      WHERE id_producto = $2 AND id_empresa = $3
      AND id_almacen = $4
    `, [cantidad, idProducto, idEmpresa, idAlmacenVenta]);

    // Kardex con transacción
    await this.kardexService.registrar({
      id_empresa: idEmpresa,
      id_almacen: idAlmacenVenta,
      id_producto: idProducto,
      tipo: TipoMovimiento.LIBERACION,
      cantidad: cantidad,
      costo_unitario: costo,
      stock_inicial: stockAnt,
      stock_final: stockAnt + cantidad,
      referencia: 'ANULACION-PEDIDO',
      observacion: 'Liberación de stock apartado'
    }, qr); // 👈 Pasamos QR
  }

  /**
   * Venta Directa: Resta stock del almacén de venta (sin pasar por apartados).
   * Usado cuando la factura NO viene de un pedido.
   */
  async registrarSalidaDirecta(
    idProducto: string,
    cantidadInput: number,
    idEmpresa: string,
    observacion: string,
    qr: QueryRunner
  ) {
    const cantidad = Number(cantidadInput);

    const almRes = await qr.manager.query(
      `SELECT id_almacen FROM almacenes WHERE es_venta = true AND id_empresa = $1 LIMIT 1`,
      [idEmpresa]
    );
    if (almRes.length === 0) throw new BadRequestException('No existe almacén de venta configurado');
    const idAlmacenVenta = almRes[0].id_almacen;

    const stockAntRes = await qr.manager.query(
      `SELECT cantidad, costo_unitario FROM inventarios WHERE id_producto = $1 AND id_almacen = $2`,
      [idProducto, idAlmacenVenta]
    );
    const stockAnt = stockAntRes.length > 0 ? parseFloat(stockAntRes[0].cantidad) : 0;
    const costo = stockAntRes.length > 0 ? parseFloat(stockAntRes[0].costo_unitario) : 0;

    if (stockAnt < cantidad) {
      throw new BadRequestException(`Stock insuficiente. Disponible: ${stockAnt}, requerido: ${cantidad}`);
    }

    await qr.manager.query(`
      UPDATE inventarios SET cantidad = cantidad - $1, updated_at = NOW()
      WHERE id_producto = $2 AND id_empresa = $3 AND id_almacen = $4
    `, [cantidad, idProducto, idEmpresa, idAlmacenVenta]);

    await this.kardexService.registrar({
      id_empresa: idEmpresa,
      id_almacen: idAlmacenVenta,
      id_producto: idProducto,
      tipo: TipoMovimiento.VENTA,
      cantidad: cantidad,
      costo_unitario: costo,
      stock_inicial: stockAnt,
      stock_final: stockAnt - cantidad,
      referencia: 'VENTA-DIRECTA',
      observacion: observacion
    }, qr);
  }

  async finalizarSalida(idProducto: string, cantidadInput: number, idEmpresa: string, qr: QueryRunner) {
    const cantidad = Number(cantidadInput);

    const almRes = await qr.manager.query(
      `SELECT id_almacen FROM almacenes WHERE es_venta = false AND id_empresa = $1 LIMIT 1`, 
      [idEmpresa]
    );
    
    if (almRes.length === 0) {
        this.logger.error("No se encontró almacén de apartados para finalizar salida");
        throw new BadRequestException("Configuración de almacenes incompleta");
    }
    const idAlmacenApartado = almRes[0].id_almacen;

    const stockAntRes = await qr.manager.query(
      `SELECT cantidad, costo_unitario FROM inventarios WHERE id_producto = $1 AND id_almacen = $2`, 
      [idProducto, idAlmacenApartado]
    );
    
    const stockAnt = stockAntRes.length > 0 ? parseFloat(stockAntRes[0].cantidad) : 0;
    const costo = stockAntRes.length > 0 ? parseFloat(stockAntRes[0].costo_unitario) : 0;

    await qr.manager.query(`
      UPDATE inventarios SET cantidad = cantidad - $1
      WHERE id_producto = $2 AND id_empresa = $3
      AND id_almacen = $4
    `, [cantidad, idProducto, idEmpresa, idAlmacenApartado]);

    // Kardex con transacción
    this.logger.log(`📝 Registrando VENTA en Kardex: Prod ${idProducto} - Cant ${cantidad}`);
    
    await this.kardexService.registrar({
      id_empresa: idEmpresa,
      id_almacen: idAlmacenApartado,
      id_producto: idProducto,
      tipo: TipoMovimiento.VENTA,
      cantidad: cantidad,
      costo_unitario: costo,
      stock_inicial: stockAnt,
      stock_final: stockAnt - cantidad,
      referencia: 'VENTA-FACTURADA',
      observacion: 'Salida definitiva de almacén de apartados'
    }, qr); // 👈 Pasamos QR
  }

  async revertirVenta(
    idProducto: string, 
    cantidadInput: number, 
    idEmpresa: string, 
    qr: QueryRunner,
    concepto: string = "DEVOLUCION VENTA"
  ) {
    const cantidad = Number(cantidadInput);
    
    const almRes = await qr.manager.query(
      `SELECT id_almacen FROM almacenes WHERE es_venta = true AND id_empresa = $1 LIMIT 1`, 
      [idEmpresa]
    );
    
    if (almRes.length === 0) throw new BadRequestException('No existe almacén de venta configurado');
    const idAlmacenVenta = almRes[0].id_almacen;

    const stockAntRes = await qr.manager.query(
      `SELECT cantidad, costo_unitario FROM inventarios WHERE id_producto = $1 AND id_almacen = $2`, 
      [idProducto, idAlmacenVenta]
    );
    const stockAnt = stockAntRes.length > 0 ? parseFloat(stockAntRes[0].cantidad) : 0;
    const costo = stockAntRes.length > 0 ? parseFloat(stockAntRes[0].costo_unitario) : 0;

    await qr.manager.query(`
      UPDATE inventarios SET cantidad = cantidad + $1
      WHERE id_producto = $2 AND id_empresa = $3
      AND id_almacen = $4
    `, [cantidad, idProducto, idEmpresa, idAlmacenVenta]);

    // Kardex con transacción
    await this.kardexService.registrar({
      id_empresa: idEmpresa,
      id_almacen: idAlmacenVenta,
      id_producto: idProducto,
      tipo: TipoMovimiento.AJUSTE_POS, 
      cantidad: cantidad,
      costo_unitario: costo,
      stock_inicial: stockAnt,
      stock_final: stockAnt + cantidad,
      referencia: 'ANULACION-FACTURA',
      observacion: 'Devolución de mercancía por anulación de venta'
    }, qr); // 👈 Pasamos QR
  }

  // ======================================================
  // 4. IMPORTACIÓN MASIVA (Excel)
  // ======================================================

  async importarProductos(file: Express.Multer.File, idEmpresa: string) {
    // 1. Leer el Buffer del archivo
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // 2. Convertir a JSON
    const datos = XLSX.utils.sheet_to_json(sheet);
    
    let procesados = 0;
    let errores = 0;
    const detallesErrores: any []= [];

    // 3. Recorrer y Guardar
    for (const row of datos as any[]) {
      try {
        // A. Mapeo a tu DTO existente
        const dto = new CreateProductoDto();
        dto.id_empresa = idEmpresa;
        dto.codigo = row['CODIGO'] ? String(row['CODIGO']) : `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        dto.nombre = row['NOMBRE'];
        dto.precio_base = Number(row['PRECIO']) || 0;
        dto.marca = row['MARCA'] || null;
        dto.categoria = row['CATEGORIA'] || null;
        dto.imagen = row['IMAGEN'] || row['Imagen'] || row['imagen'] || null;
        //dto.codigo_barras = row['CODIGO_BARRAS'] ? String(row['CODIGO_BARRAS']) : null;

        // B. Crear Producto (Usamos tu lógica existente para validar duplicados y crear precios)
        // Usamos try-catch interno por si el producto ya existe
        let producto;
        try {
            producto = await this.crear(dto);
        } catch (error) {
            // Si ya existe, buscamos el producto para poder actualizarle el stock si es necesario
            if (error instanceof BadRequestException) {
                producto = await this.productoRepo.findOne({ where: { codigo: dto.codigo, id_empresa: idEmpresa } });
            } else {
                throw error;
            }
        }

        // C. Cargar Stock Inicial (Si el Excel trae columna STOCK)
        const stockInicial = Number(row['STOCK']);
        if (producto && !isNaN(stockInicial) && stockInicial > 0) {
            // Reutilizamos tu lógica de Sync para actualizar inventario y Kardex
            await this.actualizarStockVenta(
                producto.id_producto, 
                idEmpresa, 
                stockInicial, 
                dto.precio_base
            );
        }

        procesados++;

      } catch (error) {
        errores++;
        this.logger.error(`Error importando fila ${row['NOMBRE']}: ${error.message}`);
        detallesErrores.push({ fila: row['NOMBRE'], error: error.message });
      }
    }

    return {
      mensaje: 'Importación finalizada',
      total_filas: datos.length,
      procesados_exitosamente: procesados,
      errores: errores,
      detalles: detallesErrores
    };
  }

  async importarPreciosExcel(file: Express.Multer.File, idEmpresa: string) {
    // 1. Leer el Excel
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const datosExcel = XLSX.utils.sheet_to_json(sheet);

    let actualizados = 0;
    let creados = 0;

    // 2. Procesar fila por fila
    for (const row of datosExcel as any[]) {
      const codigoExcel = row['CODIGO'] ? String(row['CODIGO']).trim() : null;
      // Extraemos tanto el nombre como la descripción por separado
      const nombreExcel = row['NOMBRE'] ? String(row['NOMBRE']).trim() : null; 
      const descripcionExcel = row['DESCRIPCION'] ? String(row['DESCRIPCION']).trim() : null;
      const precioExcel = Number(row['PRECIO']) || 0;

      if (!codigoExcel) continue; // Saltamos si no hay código

      const productoExistente = await this.productoRepo.findOne({
        where: { codigo: codigoExcel, id_empresa: idEmpresa }
      });

      if (productoExistente) {
        // ACTUALIZAR
        let requiereGuardar = false;
        
        if (productoExistente.precio_base !== precioExcel) {
          productoExistente.precio_base = precioExcel;
          requiereGuardar = true;
        }
        
        // Actualizamos el nombre si viene en el Excel y es diferente
        if (nombreExcel && productoExistente.nombre !== nombreExcel) {
          productoExistente.nombre = nombreExcel;
          requiereGuardar = true;
        }

        // Actualizamos la descripción si viene en el Excel y es diferente
        if (descripcionExcel && productoExistente.descripcion !== descripcionExcel) {
          productoExistente.descripcion = descripcionExcel;
          requiereGuardar = true;
        }

        if (requiereGuardar) {
          await this.productoRepo.save(productoExistente);
          actualizados++;
        }
      } else {
        // CREAR NUEVO
        const nuevoProducto = this.productoRepo.create({
          id_empresa: idEmpresa,
          codigo: codigoExcel,
          nombre: nombreExcel || 'Sin nombre', // Usamos el nombre del Excel
          descripcion: descripcionExcel || undefined, // Usamos la descripción (o undefined si está vacía)
          precio_base: precioExcel,
        });
        await this.productoRepo.save(nuevoProducto);
        creados++;
      }
    }

    return { 
      mensaje: 'Proceso completado con éxito', 
      creados, 
      actualizados 
    };
  }

  // ======================================================
  // MÉTODOS PARA GESTIÓN DE PEDIDOS (Validar y Devolver)
  // ======================================================

  // 1. Validar si hay suficiente stock disponible (Sin apartar)
  async validarStock(idProducto: string, cantidadRequerida: number) {
    // Usamos tu repo de inventario para buscar el stock disponible en almacén de venta
    // Ojo: Aquí asumimos que quieres validar stock GLOBAL de venta, si manejas multi-empresa
    // deberías pasar idEmpresa también, pero para mantener la firma simple buscaremos
    // el inventario de venta de ese producto.
    
    // Mejor enfoque: Buscar el inventario de venta del producto. 
    // Como tu entidad Inventario tiene relación con Almacen, filtramos por es_venta = true
    const inventario = await this.inventarioRepo.findOne({
      where: { 
        producto: { id_producto: idProducto },
        almacen: { es_venta: true } 
      },
      relations: ['producto']
    });

    if (!inventario) {
       throw new BadRequestException(`Producto ${idProducto} no tiene inventario configurado o no existe.`);
    }

    if (Number(inventario.cantidad) < cantidadRequerida) {
      throw new BadRequestException(
        `Stock insuficiente para ${inventario.producto.nombre}. Disponible: ${inventario.cantidad}, Solicitado: ${cantidadRequerida}`
      );
    }
    return true;
  }

  // 2. Devolver Stock (Reversa de apartarStock)
  // Devuelve del almacén de "Apartados" al de "Ventas"
  async devolverStock(idProducto: string, cantidad: number, idEmpresa: string, qr: QueryRunner) {
    // Reutilizamos la lógica de revertirApartado que YA TIENES, pero le cambiamos el nombre o la llamamos desde aquí
    // Fíjate que en tu código ya tienes 'revertirApartado'. Es exactamente lo que necesitamos.
    // Así que podemos hacer un alias o simplemente llamar a esa función.
    
    return this.revertirApartado(idProducto, cantidad, idEmpresa, qr);
  }
}