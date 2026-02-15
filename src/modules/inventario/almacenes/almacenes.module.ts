import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlmacenesService } from './almacenes.service';
import { AlmacenesController } from './almacenes.controller';
import { Almacen } from './entities/almacen.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Almacen])],
  controllers: [AlmacenesController],
  providers: [AlmacenesService],
  exports: [AlmacenesService, TypeOrmModule] // Exportamos para que Semilla u otros lo usen
})
export class AlmacenesModule {}