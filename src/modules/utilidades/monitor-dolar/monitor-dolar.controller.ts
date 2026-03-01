import { Controller, Get, UseGuards } from '@nestjs/common';
import { MonitorDolarService } from './monitor-dolar.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

@Controller('monitor-dolar')
@UseGuards(JwtAuthGuard)
export class MonitorDolarController {
  constructor(private readonly monitorDolarService: MonitorDolarService) {}

  @Get('bcv')
  async getTasaBcv() {
    return await this.monitorDolarService.obtenerTasaBcv();
  }
}