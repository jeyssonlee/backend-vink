import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sucursal } from './entities/sucursal.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sucursal])],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule]
})
export class SucursalModule {}