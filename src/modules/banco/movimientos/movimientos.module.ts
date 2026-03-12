import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';
import { TenantResolverModule } from '../tenant-resolver/tenant-resolver.module';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Rol } from '../../auth/roles/entities/rol.entity';

/**
 * Ubicación: src/modules/banco/movimientos/
 * Exporta MovimientosService para uso en DashboardBancoModule.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Rol]),
    TenantResolverModule,
  ],
  controllers: [MovimientosController],
  providers: [MovimientosService, PermisosGuard],
  exports: [MovimientosService],
})
export class MovimientosModule {}