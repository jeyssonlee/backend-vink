import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './entities/usuarios.entity';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { Vendedor } from 'src/modules/ventas/vendedores/entities/vendedor.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Rol, Vendedor])],
  controllers: [UsuariosController],
  providers: [UsuariosService, PermisosGuard],
  exports: [UsuariosService],
})
export class UsuariosModule {}