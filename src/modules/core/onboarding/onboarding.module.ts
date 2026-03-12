import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { Holding } from '../holding/entities/holding.entity';
import { Empresa } from '../empresa/entities/empresa.entity';
import { Sucursal } from '../sucursal/entities/sucursal.entity';
import { Usuario } from '../usuarios/entities/usuarios.entity';
import { Rol } from '../../auth/roles/entities/rol.entity';
import { Almacen } from '../../inventario/almacenes/entities/almacen.entity';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { SchemaProvisioningModule } from '../../banco/schema-provisioning/schema-provisioning.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Holding, Empresa, Sucursal, Usuario, Rol, Almacen]),
    SchemaProvisioningModule, // ← nuevo
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService, PermisosGuard],
})
export class OnboardingModule {}