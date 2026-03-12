import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuentasPagarService } from './cuentas-pagar.service';
import { CuentasPagarController } from './cuentas-pagar.controller';
import { CuentaPorPagar } from './entities/cuenta-pagar.entity';
import { PagoCxP } from './entities/pago-cxp.entity';
import {Proveedor} from '../inventario/proveedores/entities/proveedor.entity';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';

@Module({
  imports: [TypeOrmModule.forFeature([CuentaPorPagar, PagoCxP, Proveedor, Rol])],
  controllers: [CuentasPagarController],
  providers: [CuentasPagarService, PermisosGuard],
  exports: [CuentasPagarService], // exportamos para usarlo en ComprasModule
})
export class CuentasPagarModule {}