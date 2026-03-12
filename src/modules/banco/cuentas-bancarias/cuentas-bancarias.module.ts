import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuentasBancariasController } from './cuentas-bancarias.controller';
import { CuentasBancariasService } from './cuentas-bancarias.service';
import { TenantResolverModule } from '../tenant-resolver/tenant-resolver.module';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Rol } from '../../auth/roles/entities/rol.entity';

/**
 * Ubicación: src/modules/banco/cuentas-bancarias/
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Rol]),
    TenantResolverModule,
  ],
  controllers: [CuentasBancariasController],
  providers: [CuentasBancariasService, PermisosGuard],
  exports: [CuentasBancariasService],
})
export class CuentasBancariasModule {}