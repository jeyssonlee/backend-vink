import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Factura } from './entities/factura.entity';
import { FacturaDetalle } from './entities/factura-detalle.entity';
import { FacturasService } from './facturas.service';
import { FacturasController } from './facturas.controller';
import { ProductosModule } from 'src/modules/inventario/productos/productos.module';
import { PedidosModule } from '../pedidos/pedidos.module'; // Para acceder a la entidad Pedido si es necesario

@Module({
  imports: [
    TypeOrmModule.forFeature([Factura, FacturaDetalle]),
    ProductosModule, // 👈 Vital para descontar inventario (Kardex)
    PedidosModule    // 👈 Para leer los pedidos origen
  ],
  controllers: [FacturasController],
  providers: [FacturasService],
  exports: [FacturasService] // Por si otro módulo necesita facturar
})
export class FacturasModule {}