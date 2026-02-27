import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendedoresService } from './vendedores.service';
import { VendedoresController } from './vendedores.controller';
import { Vendedor } from './entities/vendedor.entity';
import { UsuariosModule } from 'src/modules/core/usuarios/usuarios.module';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Vendedor, Rol]), UsuariosModule],
  controllers: [VendedoresController],
  providers: [VendedoresService, PermisosGuard],
  exports: [VendedoresService],
})
export class VendedoresModule {}