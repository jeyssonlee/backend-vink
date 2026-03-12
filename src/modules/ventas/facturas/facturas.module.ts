import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Factura } from './entities/factura.entity';
import { FacturaDetalle } from './entities/factura-detalle.entity';
import { FacturasService } from './facturas.service';
import { FacturasController } from './facturas.controller';
import { ProductosModule } from 'src/modules/inventario/productos/productos.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { ConfiguracionImpuestosModule } from 'src/modules/core/configuracion-impuestos/configuracion-impuestos.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([Factura, FacturaDetalle, Rol]),
    ProductosModule,
    PedidosModule,
    ConfiguracionImpuestosModule
  ],
  controllers: [FacturasController],
  providers: [FacturasService, PermisosGuard],
  exports: [FacturasService],
})
export class FacturasModule {}