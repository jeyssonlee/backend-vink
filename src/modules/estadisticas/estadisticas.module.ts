import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Controladores y Servicios de la Ficha Cliente
import { FichaClienteController } from './ficha-cliente/ficha-cliente.controller';
import { FichaClienteService } from './ficha-cliente/ficha-cliente.service';

// Entidades de otros módulos necesarias para las estadísticas
import { Cliente } from '../ventas/clientes/entities/clientes.entity';
import { Factura } from '../ventas/facturas/entities/factura.entity';
import { FacturaDetalle } from '../ventas/facturas/entities/factura-detalle.entity';
import { CobranzaMetodo } from '../cobranzas/entities/cobranza-metodo.entity';
import { Cobranza } from '../cobranzas/entities/cobranza.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cliente, 
      Factura, 
      FacturaDetalle, 
      CobranzaMetodo,
      Cobranza
    ])
  ],
  controllers: [FichaClienteController],
  providers: [FichaClienteService],
})
export class EstadisticasModule {}