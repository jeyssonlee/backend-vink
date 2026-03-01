import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Factura } from '../ventas/facturas/entities/factura.entity';
import { Cliente } from '../ventas/clientes/entities/clientes.entity';
import { Producto } from '../inventario/productos/entities/producto.entity';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Factura, Cliente, Producto, Rol])],
  controllers: [DashboardController],
  providers: [DashboardService, PermisosGuard],
})
export class DashboardModule {}