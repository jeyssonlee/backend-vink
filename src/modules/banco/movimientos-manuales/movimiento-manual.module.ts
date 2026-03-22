import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimientoManualController } from './movimiento-manual.controller';
import { MovimientoManualService } from './movimiento-manual.service';
import { TenantResolverModule } from '../tenant-resolver/tenant-resolver.module';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Rol } from '../../auth/roles/entities/rol.entity';

/**
 * Ubicación: src/modules/banco/movimientos-manuales/
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Rol]),
    TenantResolverModule,
  ],
  controllers: [MovimientoManualController],
  providers: [MovimientoManualService, PermisosGuard],
  exports: [MovimientoManualService],
})
export class MovimientoManualModule {}