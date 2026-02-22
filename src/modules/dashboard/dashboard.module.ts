import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

// 🚀 Importa tus entidades reales
import { Factura } from '../ventas/facturas/entities/factura.entity';
import { Cliente } from '../ventas/clientes/entities/clientes.entity';
import { Producto } from '../inventario/productos/entities/producto.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Factura, Cliente, Producto]) // 👈 Le damos acceso a las tablas
  ],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}