import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PedidosService } from './pedidos.service';
import { PedidosController } from './pedidos.controller';
import { Pedido } from './entities/pedido.entity';
import { PedidoDetalle } from './entities/pedido-detalle.entity';
import { ProductosModule } from '../../inventario/productos/productos.module';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pedido, PedidoDetalle, Rol]),
    ProductosModule,
  ],
  providers: [PedidosService, PermisosGuard],
  controllers: [PedidosController],
  exports: [PedidosService],
})
export class PedidosModule {}