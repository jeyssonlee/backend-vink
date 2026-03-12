import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComprasService } from './compras.service';
import { ComprasController } from './compras.controller';
import { Compra } from './entities/compra.entity';
import { CompraDetalle } from './entities/compra-detalle.entity';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { CuentasPagarModule } from 'src/modules/cuentas-pagar/cuentas-pagar.module';

@Module({
  imports: [TypeOrmModule.forFeature([Compra, CompraDetalle, Rol]), CuentasPagarModule],
  controllers: [ComprasController],
  providers: [ComprasService, PermisosGuard],
})
export class ComprasModule {}