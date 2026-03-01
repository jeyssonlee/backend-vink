import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SemillaService } from './semilla.service';
import { SemillaController } from './semilla.controller';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { Usuario } from '../modules/core/usuarios/entities/usuarios.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Rol, Usuario])],
  controllers: [SemillaController],
  providers: [SemillaService],
})
export class SemillaModule {}