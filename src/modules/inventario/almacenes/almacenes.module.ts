import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlmacenesService } from './almacenes.service';
import { AlmacenesController } from './almacenes.controller';
import { Almacen } from './entities/almacen.entity';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Almacen, Rol])],
  controllers: [AlmacenesController],
  providers: [AlmacenesService, PermisosGuard],
  exports: [AlmacenesService, TypeOrmModule],
})
export class AlmacenesModule {}