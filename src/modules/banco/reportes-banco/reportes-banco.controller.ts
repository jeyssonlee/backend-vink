import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ReportesBancoService } from './reportes-banco.service';
import {
  FiltrosReporteDto,
  FiltrosTopGastosDto,
  FiltrosComparativaDto,
} from './dto/reportes-banco.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Permisos } from '../../auth/decorators/permisos.decorator';
import { Permiso } from '../../auth/permisos.enum';

@Controller('banco/reportes')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class ReportesBancoController {
  constructor(private readonly reportesService: ReportesBancoService) {}

  /**
   * GET /api/banco/reportes/flujo-caja
   * Resumen de ingresos vs egresos por mes y semana.
   */
  @Get('flujo-caja')
  @Permisos(Permiso.VER_MOVIMIENTOS)
  flujoCaja(@Query() filtros: FiltrosReporteDto, @Request() req: any) {
    return this.reportesService.flujoDeCaja(req.user.id_empresa, filtros);
  }

  /**
   * GET /api/banco/reportes/top-gastos
   * Top gastos por categoría y tipo destino + 10 movimientos de mayor monto.
   */
  @Get('top-gastos')
  @Permisos(Permiso.VER_MOVIMIENTOS)
  topGastos(@Query() filtros: FiltrosTopGastosDto, @Request() req: any) {
    return this.reportesService.topGastos(req.user.id_empresa, filtros);
  }

  /**
   * GET /api/banco/reportes/sin-clasificar
   * Movimientos sin categoría asignada pendientes de revisión.
   */
  @Get('sin-clasificar')
  @Permisos(Permiso.VER_MOVIMIENTOS)
  sinClasificar(@Query() filtros: FiltrosReporteDto, @Request() req: any) {
    return this.reportesService.sinClasificar(req.user.id_empresa, filtros);
  }

  /**
   * GET /api/banco/reportes/comparativa-empresas
   * KPIs por empresa del grupo. Excluye transferencias internas del P&L.
   * Parámetro opcional: empresas[] para filtrar cuáles incluir.
   */
  @Get('comparativa-empresas')
  @Permisos(Permiso.VER_MOVIMIENTOS)
  comparativaEmpresas(@Query() filtros: FiltrosComparativaDto, @Request() req: any) {
    return this.reportesService.comparativaEmpresas(req.user.id_empresa, filtros);
  }

  /**
   * GET /api/banco/reportes/importaciones
   * Historial de todos los extractos importados con su estado.
   */
  @Get('importaciones')
  @Permisos(Permiso.IMPORTAR_EXTRACTOS)
  historialImportaciones(@Query() filtros: FiltrosReporteDto, @Request() req: any) {
    return this.reportesService.historialImportaciones(req.user.id_empresa, filtros);
  }
}