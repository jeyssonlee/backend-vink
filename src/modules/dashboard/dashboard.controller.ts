import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt')) 
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // 👇 ESTO ES LO QUE NO ESTÁ LEYENDO NESTJS
  @Get('resumen')
  async getResumen() {
    return await this.dashboardService.obtenerResumenKpis();
  }
}