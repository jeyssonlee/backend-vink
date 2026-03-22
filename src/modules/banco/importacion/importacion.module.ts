import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportacionController } from './importacion.controller';
import { ImportacionService } from './importacion.service';
import { TenantResolverModule } from '../tenant-resolver/tenant-resolver.module';
import { ParsersModule } from '../parsers/parsers.module';
import { CategoriasModule } from '../categorias/categorias.module';
import { TasaBcvModule } from '../tasa-bcv/tasa-bcv.module';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Rol } from '../../auth/roles/entities/rol.entity';
import { TiposModule } from '../tipos/tipos.module';

/**
 * Ubicación: src/modules/banco/importacion/
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Rol]),
    TenantResolverModule,
    ParsersModule,
    CategoriasModule,
    TiposModule,
    TasaBcvModule,
  ],
  controllers: [ImportacionController],
  providers: [ImportacionService, PermisosGuard],
  exports: [ImportacionService],
})
export class ImportacionModule {}