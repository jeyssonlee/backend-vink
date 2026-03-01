import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rol } from './entities/rol.entity';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Rol])],
  controllers: [RolesController],
  providers: [RolesService, PermisosGuard],
  exports: [TypeOrmModule, RolesService],
})
export class RolesModule {}