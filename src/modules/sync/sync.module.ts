import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { PedidosModule } from '../ventas/pedidos/pedidos.module';
import { RabbitConfigModule } from 'src/infrastructure/rabbitmq/rabbit.module';
import { ProductosModule } from '../inventario/productos/productos.module';

@Module({
  imports: [PedidosModule, ProductosModule, RabbitConfigModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}