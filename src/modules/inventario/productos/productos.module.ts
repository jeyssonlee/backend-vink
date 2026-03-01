import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Producto } from './entities/producto.entity';
import { Inventario } from './entities/inventario.entity';
import { Almacen } from '../almacenes/entities/almacen.entity';
import { Precio } from './entities/precio.entity';
import { ProductosService } from './productos.service';
import { ProductosController } from './productos.controller';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Producto, Inventario, Almacen, Precio, Rol])],
  controllers: [ProductosController],
  providers: [ProductosService, PermisosGuard],
  exports: [ProductosService, TypeOrmModule, ProductosModule],
})
export class ProductosModule {}