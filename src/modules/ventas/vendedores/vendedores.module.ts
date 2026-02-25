import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendedoresService } from './vendedores.service';
import { VendedoresController } from './vendedores.controller';
import { Vendedor } from "./entities/vendedor.entity";
import { UsuariosModule } from 'src/modules/core/usuarios/usuarios.module';

@Module({
  // Importamos la entidad para que TypeORM cree la tabla y el repositorio
  imports: [TypeOrmModule.forFeature([Vendedor]), UsuariosModule],
  controllers: [VendedoresController],
  providers: [VendedoresService],
  // Exportamos el servicio por si el SyncService (Cron) necesita validar vendedores luego
  exports: [VendedoresService], 
})
export class VendedoresModule {}