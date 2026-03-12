import { Controller, Get, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('resumen')
  async getResumen(@Req() req: any) {
    return await this.dashboardService.obtenerResumenKpis(req.user.id_empresa);
  }

  @Get('root')
  async getResumenRoot(@Req() req: any) {
    if (req.user.rol !== 'ROOT') {
      throw new ForbiddenException('Acceso restringido al panel ROOT');
    }
    return await this.dashboardService.obtenerResumenRoot();
  }
}