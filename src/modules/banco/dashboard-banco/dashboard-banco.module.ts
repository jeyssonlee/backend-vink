import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardBancoController } from './dashboard-banco.controller';
import { DashboardBancoService } from './dashboard-banco.service';
import { TenantResolverModule } from '../tenant-resolver/tenant-resolver.module';
import { MovimientosModule } from '../movimientos/movimientos.module';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Rol } from '../../auth/roles/entities/rol.entity';

/**
 * Ubicación: src/modules/banco/dashboard-banco/
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Rol]),
    TenantResolverModule,
    MovimientosModule,
  ],
  controllers: [DashboardBancoController],
  providers: [DashboardBancoService, PermisosGuard],
})
export class DashboardBancoModule {}