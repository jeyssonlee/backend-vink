import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sucursal } from './entities/sucursal.entity';
// 👇 Importamos el controlador y el servicio
import { SucursalesController } from './sucursales.controller';
import { SucursalesService } from './sucursales.service';

@Module({
  imports: [TypeOrmModule.forFeature([Sucursal])],
  // 👇 Registramos el controlador para quitar el Error 404
  controllers: [SucursalesController],
  // 👇 Registramos el servicio para que el controlador pueda usarlo
  providers: [SucursalesService],
  exports: [TypeOrmModule, SucursalesService] // Exportamos el servicio por si otro módulo lo necesita
})
export class SucursalModule {}