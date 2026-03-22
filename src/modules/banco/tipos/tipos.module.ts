import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TiposController } from './tipos.controller';
import { TiposService } from './tipos.service';
import { TenantResolverModule } from '../tenant-resolver/tenant-resolver.module';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Rol } from '../../auth/roles/entities/rol.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rol]),
    TenantResolverModule,
  ],
  controllers: [TiposController],
  providers: [TiposService, PermisosGuard],
  exports: [TiposService],
})
export class TiposModule {}
