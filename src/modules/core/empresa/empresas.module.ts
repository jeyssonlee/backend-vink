import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Empresa } from './entities/empresa.entity';
import { EmpresasService } from './empresas.service';
import { EmpresasController } from './empresas.controller';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Empresa, Rol])],
  controllers: [EmpresasController],
  providers: [EmpresasService, PermisosGuard],
  exports: [EmpresasService, TypeOrmModule],
})
export class EmpresasModule {}