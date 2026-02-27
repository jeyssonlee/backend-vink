import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './entities/clientes.entity';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente, Rol])],
  controllers: [ClientesController],
  providers: [ClientesService, PermisosGuard],
  exports: [ClientesService],
})
export class ClientesModule {}