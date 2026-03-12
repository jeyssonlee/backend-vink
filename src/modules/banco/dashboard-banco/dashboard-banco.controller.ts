import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { DashboardBancoService } from './dashboard-banco.service';
import { FiltrosDashboardDto } from '../movimientos/dto/movimientos.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Permisos } from '../../auth/decorators/permisos.decorator';
import { Permiso } from '../../auth/permisos.enum';

@Controller('banco/dashboard')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class DashboardBancoController {
  constructor(private readonly dashboardService: DashboardBancoService) {}

  /**
   * GET /api/banco/dashboard/individual
   * KPIs, evolución mensual y desglose por categoría de una empresa.
   * Parámetros opcionales: fecha_desde, fecha_hasta
   */
  @Get('individual')
  @Permisos(Permiso.VER_MOVIMIENTOS)
  individual(@Query() filtros: FiltrosDashboardDto, @Request() req: any) {
    return this.dashboardService.dashboardIndividual(req.user.id_empresa, filtros);
  }

  /**
   * GET /api/banco/dashboard/consolidado
   * Vista del holding: todas las empresas juntas o filtradas.
   * Parámetros opcionales: fecha_desde, fecha_hasta, empresas[]
   * Excluye transferencias internas del P&L consolidado.
   */
  @Get('consolidado')
  @Permisos(Permiso.VER_MOVIMIENTOS)
  consolidado(@Query() filtros: FiltrosDashboardDto, @Request() req: any) {
    return this.dashboardService.dashboardConsolidado(req.user.id_empresa, filtros);
  }
}