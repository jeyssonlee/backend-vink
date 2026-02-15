import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PedidosService } from './pedidos.service';
import { PedidosController } from './pedidos.controller';
import { Pedido } from './entities/pedido.entity';
import { PedidoDetalle } from './entities/pedido-detalle.entity';
import { ProductosModule } from '../../inventario/productos/productos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pedido, PedidoDetalle]),
    ProductosModule, // Fundamental para el apartarStock
  ],
  providers: [PedidosService],
  controllers: [PedidosController],
  exports: [PedidosService],
})
export class PedidosModule {}