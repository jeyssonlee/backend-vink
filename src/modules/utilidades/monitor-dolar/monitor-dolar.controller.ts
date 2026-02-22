import { Controller, Get, UseGuards } from '@nestjs/common';
import { MonitorDolarService } from './monitor-dolar.service';
import { AuthGuard } from '@nestjs/passport'; 

@Controller('monitor-dolar')
@UseGuards(AuthGuard('jwt')) // 🛡️ Lo protegemos para que solo usuarios de Vink-ERP lo usen
export class MonitorDolarController {
  constructor(private readonly monitorDolarService: MonitorDolarService) {}

  @Get('bcv')
  async getTasaBcv() {
    return await this.monitorDolarService.obtenerTasaBcv();
  }
}