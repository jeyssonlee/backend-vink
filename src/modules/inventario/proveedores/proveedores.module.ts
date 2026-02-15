import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProveedoresService } from './proveedores.service';
import { ProveedoresController } from './proveedores.controller';
import { Proveedor } from './entities/proveedor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Proveedor])], // 👈 Registramos la entidad aquí
  controllers: [ProveedoresController],
  providers: [ProveedoresService],
  exports: [ProveedoresService] // 👈 Lo exportamos porque Compras lo usará después
})
export class ProveedoresModule {}