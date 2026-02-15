import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Holding } from './entities/holding.entity';
// Si vas a crear controlador y servicio luego, los agregas aquí.
// Por ahora, registramos la entidad para que se cree la tabla.

@Module({
  imports: [TypeOrmModule.forFeature([Holding])],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule] // Exportamos para que otros módulos puedan usar el repositorio
})
export class HoldingModule {}