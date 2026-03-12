import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracionImpuesto } from './entities/configuracion-impuesto.entity';
import { ConfiguracionImpuestosService } from './configuracion-impuestos.service';
import { ConfiguracionImpuestosController } from './configuracion-impuestos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ConfiguracionImpuesto])],
  providers: [ConfiguracionImpuestosService],
  controllers: [ConfiguracionImpuestosController],
  exports: [ConfiguracionImpuestosService], // Para usarlo en FacturasService
})
export class ConfiguracionImpuestosModule {}