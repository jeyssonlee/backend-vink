import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComprasService } from './compras.service';
import { ComprasController } from './compras.controller';
import { Compra } from './entities/compra.entity';
import { CompraDetalle } from './entities/compra-detalle.entity';

@Module({
  imports: [
    // Registramos las entidades para que TypeORM las reconozca en este ámbito
    TypeOrmModule.forFeature([Compra, CompraDetalle]),
  ],
  controllers: [ComprasController],
  providers: [ComprasService],
})
export class ComprasModule {}