import { Module } from '@nestjs/common';
import { MonitorDolarController } from './monitor-dolar.controller';
import { MonitorDolarService } from './monitor-dolar.service';

@Module({
  controllers: [MonitorDolarController],
  providers: [MonitorDolarService],
  exports: [MonitorDolarService], // Lo exportamos por si tu módulo de Ventas necesita consultar la tasa por debajo de la mesa
})
export class MonitorDolarModule {}