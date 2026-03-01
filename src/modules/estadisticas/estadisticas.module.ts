import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FichaClienteController } from './ficha-cliente/ficha-cliente.controller';
import { FichaClienteService } from './ficha-cliente/ficha-cliente.service';
import { Cliente } from '../ventas/clientes/entities/clientes.entity';
import { Factura } from '../ventas/facturas/entities/factura.entity';
import { FacturaDetalle } from '../ventas/facturas/entities/factura-detalle.entity';
import { CobranzaMetodo } from '../cobranzas/entities/cobranza-metodo.entity';
import { Cobranza } from '../cobranzas/entities/cobranza.entity';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cliente, Factura, FacturaDetalle, CobranzaMetodo, Cobranza, Rol])
  ],
  controllers: [FichaClienteController],
  providers: [FichaClienteService, PermisosGuard],
})
export class EstadisticasModule {}