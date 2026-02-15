import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './entities/usuarios.entity';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Rol])],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService], // ¡Importante! Lo necesitaremos para el Login (Auth)
})
export class UsuariosModule {}