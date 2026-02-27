import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CobranzasService } from './cobranzas.service';
import { CobranzasController } from './cobranzas.controller';
import { Cobranza } from './entities/cobranza.entity';
import { CobranzaMetodo } from './entities/cobranza-metodo.entity';
import { CobranzaFactura } from './entities/cobranza-factura.entity';
import { Factura } from '../ventas/facturas/entities/factura.entity';
import { Usuario } from '../core/usuarios/entities/usuarios.entity';
import { Rol } from '../auth/roles/entities/rol.entity';
import { PermisosGuard } from '../auth/guards/permisos.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cobranza, CobranzaMetodo, CobranzaFactura, Factura, Usuario, Rol
    ])
  ],
  controllers: [CobranzasController],
  providers: [CobranzasService, PermisosGuard],
  exports: [CobranzasService],
})
export class CobranzasModule {}