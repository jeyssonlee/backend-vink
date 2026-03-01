import { Module } from '@nestjs/common';
import { MonitorDolarController } from './monitor-dolar.controller';
import { MonitorDolarService } from './monitor-dolar.service';

@Module({
  controllers: [MonitorDolarController],
  providers: [MonitorDolarService],
  exports: [MonitorDolarService],
})
export class MonitorDolarModule {}