import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sucursal } from './entities/sucursal.entity';
import { SucursalesController } from './sucursales.controller';
import { SucursalesService } from './sucursales.service';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Sucursal, Rol])],
  controllers: [SucursalesController],
  providers: [SucursalesService, PermisosGuard],
  exports: [TypeOrmModule, SucursalesService],
})
export class SucursalModule {}