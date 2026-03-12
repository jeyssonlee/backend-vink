import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantResolverService } from './tenant-resolver.service';
import { Empresa } from '../../core/empresa/entities/empresa.entity';

/**
 * Ubicación: src/modules/banco/tenant-resolver/
 * Importar en cualquier módulo del banco que necesite operar sobre el schema correcto.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Empresa])],
  providers: [TenantResolverService],
  exports: [TenantResolverService],
})
export class TenantResolverModule {}