import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrearCompraDto } from './dto/crear-compra.dto';
import { Compra, FormaPago } from './entities/compra.entity';
import { CompraDetalle } from './entities/compra-detalle.entity';
import { Proveedor } from '../proveedores/entities/proveedor.entity';
import { Empresa } from 'src/modules/core/empresa/entities/empresa.entity';
import { Almacen } from '../almacenes/entities/almacen.entity';
import { KardexService } from '../kardex/kardex.service';
import { TipoMovimiento } from '../kardex/entities/movimiento-kardex.entity';
import { CuentasPagarService } from 'src/modules/cuentas-pagar/cuentas-pagar.service';

@Injectable()
export class ComprasService {
  private readonly logger = new Logger(ComprasService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly kardexService: KardexService,
    private readonly cuentasPagarService: CuentasPagarService,
  ) {}

  // =================================================================
  // 1. CREAR COMPRA (CON PROMEDIO PONDERADO 🧠)
  // =================================================================
  async crear(crearCompraDto: CrearCompraDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Separamos datos para crear la cabecera
      const { detalles, num_factura, id_proveedor, id_empresa, id_almacen, ...datosCompra } = crearCompraDto;

      const empresa = await queryRunner.manager.findOne(Empresa, { where: { id: id_empresa } });
      if (!empresa) throw new NotFoundException('Empresa no encontrada');

      const almacen = await queryRunner.manager.findOne(Almacen, { where: { id_almacen: id_almacen } });
      if (!almacen) throw new NotFoundException('Almacén de destino no encontrado');

      const proveedorEntity = await queryRunner.manager.findOne(Proveedor, {
        where: { id_proveedor: id_proveedor, activo: true }
      });
      if (!proveedorEntity) throw new NotFoundException(`Proveedor no existe o inactivo.`);

      // Validar Duplicados
      const existe = await queryRunner.manager.findOne(Compra, {
        where: { 
          num_factura, 
          proveedor: { id_proveedor }, // Busca por relación
          empresa: { id: id_empresa } 
        }
      });
      
      // Nota: Si usas SQL raw o QueryBuilder el 'where' cambia, pero con TypeORM findOne y relaciones esto es correcto.
      if (existe) throw new ConflictException(`La factura ${num_factura} ya está registrada.`);

      // Calculamos total para la cabecera
      const totalCalculado = detalles.reduce((acc, item) => acc + (item.cantidad * item.costo_unitario), 0);

      const nuevaCompra = queryRunner.manager.create(Compra, {
        ...datosCompra,
        num_factura,
        proveedor: proveedorEntity,
        empresa: empresa,
        almacen: almacen,
        // id_almacen: id_almacen, // Si la entidad tiene relación objeto 'almacen', TypeORM ignora id_almacen si pasas el objeto.
        total: totalCalculado, 
        estado: 'ACTIVA',
        forma_pago: crearCompraDto.forma_pago,
      });
      const compraGuardada = await queryRunner.manager.save(nuevaCompra);

      const detallesEntidades: CompraDetalle[] = [];

      for (const item of detalles) {
        // 1. OBTENER STOCK Y COSTO ACTUAL (Vital para Promedio Ponderado)
        const stockResult = await queryRunner.manager.query(
          `SELECT cantidad, costo_unitario FROM inventarios WHERE id_producto = $1 AND id_almacen = $2 AND id_empresa = $3`,
          [item.id_producto, id_almacen, id_empresa]
        );

        let stockActual = 0;
        let costoPromedioActual = 0;

        if (stockResult.length > 0) {
          stockActual = parseFloat(stockResult[0].cantidad);
          costoPromedioActual = parseFloat(stockResult[0].costo_unitario);
        }

        // 2. CÁLCULO MATEMÁTICO DEL PROMEDIO PONDERADO 🧮
        const valorTotalInventario = stockActual * costoPromedioActual;
        const valorTotalIngreso = item.cantidad * item.costo_unitario;
        const nuevoStockTotal = stockActual + item.cantidad;

        let nuevoCostoPromedio = item.costo_unitario; // Por defecto el de entrada (si es stock nuevo)
        
        if (nuevoStockTotal > 0) {
            nuevoCostoPromedio = (valorTotalInventario + valorTotalIngreso) / nuevoStockTotal;
        }

        // 3. CREAR DETALLE
        const detalle = queryRunner.manager.create(CompraDetalle, {
          compra: compraGuardada,
          producto: { id_producto: item.id_producto }, // Asumiendo que producto es relación
          cantidad: item.cantidad,
          costo_unitario: item.costo_unitario, // Precio de factura
          id_almacen: id_almacen, // Generalmente el detalle no lleva almacén si la cabecera ya lo tiene, pero lo dejo si tu entidad lo pide
        });
        detallesEntidades.push(detalle);

        // 4. ACTUALIZAR INVENTARIO
        await queryRunner.manager.query(`
          INSERT INTO inventarios (id_producto, id_almacen, id_empresa, cantidad, costo_unitario, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (id_producto, id_almacen) 
          DO UPDATE SET 
            cantidad = $4,            
            costo_unitario = $5,      
            updated_at = NOW();
        `, [item.id_producto, id_almacen, id_empresa, nuevoStockTotal, nuevoCostoPromedio]);

        // 5. REGISTRAR KARDEX (CORREGIDO 🛠️)
        await this.kardexService.registrar({
          id_empresa: id_empresa,
          id_almacen: id_almacen,
          id_producto: item.id_producto,
          tipo: TipoMovimiento.COMPRA,
          cantidad: item.cantidad,
          costo_unitario: item.costo_unitario, 
          
          // 👇 AQUÍ ESTÁ EL CAMBIO (Renombrado para coincidir con el nuevo DTO)
          stock_inicial: stockActual,     // ANTES: stock_anterior
          stock_final: nuevoStockTotal,   // ANTES: stock_nuevo

          referencia: num_factura,
          observacion: `Ingreso Compra. Nuevo P.P.: ${nuevoCostoPromedio.toFixed(2)}`
        });
      }

      await queryRunner.manager.save(detallesEntidades);
      await queryRunner.commitTransaction();
      this.logger.log(`✅ Compra ${num_factura} registrada con Promedio Ponderado.`);

      if (crearCompraDto.forma_pago === FormaPago.CREDITO) {
        await this.cuentasPagarService.crearDesdeCompra(compraGuardada);
      }
      
      return { success: true, data: compraGuardada };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Error crear compra: ${error.message}`);
      throw error; 
    } finally {
      await queryRunner.release();
    }
  }

  // =================================================================
  // 2. ANULAR COMPRA
  // =================================================================
  async anular(terminoBusqueda: string, idEmpresa: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const esUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(terminoBusqueda);
      let compra: any = null; // Tipado laxo para evitar conflictos de relaciones profundas en findOne
      const relaciones = ['detalles', 'detalles.producto', 'almacen', 'empresa']; 

      if (esUUID) {
        compra = await queryRunner.manager.findOne(Compra, {
          where: { id_compra: terminoBusqueda, empresa: { id: idEmpresa } },
          relations: relaciones,
        });
      } else {
        const compras = await queryRunner.manager.find(Compra, {
          where: { num_factura: terminoBusqueda, empresa: { id: idEmpresa } },
          relations: relaciones,
        });
        if (compras.length > 1) throw new ConflictException(`Múltiples facturas con número ${terminoBusqueda}. Use el ID.`);
        if (compras.length === 0) throw new NotFoundException('Compra no encontrada.');
        compra = compras[0];
      }

      if (!compra) throw new NotFoundException('Compra no encontrada.');
      if (compra.estado === 'ANULADO') throw new ConflictException('Esta compra ya está anulada.');
      if (!compra.almacen) throw new ConflictException('Integridad de datos: La compra no tiene almacén registrado.');

      for (const detalle of compra.detalles) {
         // 1. Obtener Stock Actual
         const stockResult = await queryRunner.manager.query(
            `SELECT cantidad FROM inventarios WHERE id_producto = $1 AND id_almacen = $2 AND id_empresa = $3`,
            [detalle.producto.id_producto, compra.almacen.id_almacen, idEmpresa]
         );
         const stockAnt = stockResult.length > 0 ? parseFloat(stockResult[0].cantidad) : 0;

         // 2. Restar Stock (Revertir ingreso)
         await queryRunner.manager.query(`
          UPDATE inventarios SET cantidad = cantidad - $1 
          WHERE id_producto = $2 
          AND id_almacen = $3
          AND id_empresa = $4
       `, [
          detalle.cantidad, 
          detalle.producto.id_producto, 
          compra.almacen.id_almacen,
          idEmpresa
        ]);

        // 3. Registrar Kardex (CORREGIDO 🛠️)
        await this.kardexService.registrar({
          id_empresa: idEmpresa,
          id_almacen: compra.almacen.id_almacen,
          id_producto: detalle.producto.id_producto,
          tipo: TipoMovimiento.AJUSTE_NEG, // O DEVOLUCION_COMPRA si existe
          cantidad: detalle.cantidad,
          costo_unitario: detalle.costo_unitario,
          
          // 👇 AQUÍ ESTÁ EL CAMBIO
          stock_inicial: stockAnt,                    // ANTES: stock_anterior
          stock_final: stockAnt - detalle.cantidad,   // ANTES: stock_nuevo

          referencia: compra.num_factura,
          observacion: 'Anulación de Factura (Salida de mercadería)'
        });
      }

      compra.estado = 'ANULADO';
      await queryRunner.manager.save(compra);
      await queryRunner.commitTransaction();

      return { success: true, message: 'Compra anulada y stock revertido.' };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    return await this.dataSource.getRepository(Compra).find({
      relations: ['proveedor', 'almacen', 'empresa', 'detalles', 'detalles.producto']
    });
  }

  async findOne(id: string) {
    return await this.dataSource.getRepository(Compra).findOne({
      where: { id_compra: id },
      relations: ['detalles', 'detalles.producto', 'almacen', 'proveedor']
    });
  }
}