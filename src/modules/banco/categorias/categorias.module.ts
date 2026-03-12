import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';
import { TenantResolverModule } from '../tenant-resolver/tenant-resolver.module';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Rol } from '../../auth/roles/entities/rol.entity';

/**
 * Ubicación: src/modules/banco/categorias/
 *
 * Exporta CategoriasService para que el wizard de importación (Sprint 2)
 * pueda usar resolverCategoria() durante la validación automática.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Rol]),
    TenantResolverModule,
  ],
  controllers: [CategoriasController],
  providers: [CategoriasService, PermisosGuard],
  exports: [CategoriasService],
})
export class CategoriasModule {}