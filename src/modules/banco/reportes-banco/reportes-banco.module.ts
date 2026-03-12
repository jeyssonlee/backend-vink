import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportesBancoController } from './reportes-banco.controller';
import { ReportesBancoService } from './reportes-banco.service';
import { TenantResolverModule } from '../tenant-resolver/tenant-resolver.module';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Rol } from '../../auth/roles/entities/rol.entity';

/**
 * Ubicación: src/modules/banco/reportes-banco/
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Rol]),
    TenantResolverModule,
  ],
  controllers: [ReportesBancoController],
  providers: [ReportesBancoService, PermisosGuard],
})
export class ReportesBancoModule {}