import { Module } from '@nestjs/common';
import { SchemaProvisioningService } from './schema-provisioning.service';

/**
 * Módulo standalone que exporta SchemaProvisioningService.
 * Importarlo en cualquier módulo que necesite crear o referenciar schemas de tenant.
 *
 * Uso:
 *   imports: [SchemaProvisioningModule]
 *   // luego inyectar SchemaProvisioningService normalmente
 */
@Module({
  providers: [SchemaProvisioningService],
  exports: [SchemaProvisioningService],
})
export class SchemaProvisioningModule {}