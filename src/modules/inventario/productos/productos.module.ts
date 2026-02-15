import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from './entities/producto.entity';
import { Inventario } from './entities/inventario.entity';
import { Almacen } from '../almacenes/entities/almacen.entity';
import { Precio } from './entities/precio.entity';
import { ProductosService } from './productos.service';
import { ProductosController } from './productos.controller';

@Module({
  imports: [
    // Registramos todas las entidades del dominio de productos
    TypeOrmModule.forFeature([Producto, Inventario, Almacen, Precio])
  ],
  controllers: [ProductosController],
  providers: [ProductosService],
  // Exportamos el Service y el TypeOrmModule para que el módulo de Pedidos pueda usarlos
  exports: [ProductosService, TypeOrmModule, ProductosModule],
})
export class ProductosModule {}