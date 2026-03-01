import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
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
@Permisos(Permiso.EDITAR_EMPRESA)
async getResumenRoot() {
  return await this.dashboardService.obtenerResumenRoot();
}
}