import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Request,
} from '@nestjs/common';
import { TiposService } from './tipos.service';
import {
  CrearTipoDto,
  ActualizarTipoDto,
  CrearSubtipoDto,
  ActualizarSubtipoDto,
} from './dto/tipo.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Permisos } from '../../auth/decorators/permisos.decorator';
import { Permiso } from '../../auth/permisos.enum';

@Controller('banco/tipos')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class TiposController {
  constructor(private readonly tiposService: TiposService) {}

  // ── TIPOS ─────────────────────────────────────

  /**
   * GET /api/banco/tipos
   * Lista todos los tipos con sus subtipos anidados.
   * INGRESO y EGRESO aparecen primero (es_sistema = true).
   */
  @Get()
  @Permisos(Permiso.VER_MOVIMIENTOS)
  listarTipos(@Request() req: any) {
    return this.tiposService.listarTipos(req.user.id_empresa);
  }

  /**
   * GET /api/banco/tipos/:id
   */
  @Get(':id')
  @Permisos(Permiso.VER_MOVIMIENTOS)
  obtenerTipo(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.tiposService.obtenerTipo(id, req.user.id_empresa);
  }

  /**
   * POST /api/banco/tipos
   * Crea un tipo personalizado (adicional a INGRESO/EGRESO).
   */
  @Post()
  @Permisos(Permiso.CREAR_CUENTAS_BANCARIAS)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  crearTipo(@Body() dto: CrearTipoDto, @Request() req: any) {
    return this.tiposService.crearTipo(dto, req.user.id_empresa);
  }

  /**
   * PATCH /api/banco/tipos/:id
   * No permite cambiar el nombre de INGRESO/EGRESO.
   */
  @Patch(':id')
  @Permisos(Permiso.EDITAR_CUENTAS_BANCARIAS)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  actualizarTipo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarTipoDto,
    @Request() req: any,
  ) {
    return this.tiposService.actualizarTipo(id, dto, req.user.id_empresa);
  }

  /**
   * DELETE /api/banco/tipos/:id
   * INGRESO/EGRESO no pueden eliminarse.
   */
  @Delete(':id')
  @Permisos(Permiso.ELIMINAR_CUENTAS_BANCARIAS)
  eliminarTipo(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.tiposService.eliminarTipo(id, req.user.id_empresa);
  }

  // ── SUBTIPOS ──────────────────────────────────

  /**
   * POST /api/banco/tipos/:id/subtipos
   * Crea un subtipo dentro del tipo especificado.
   * Ej: POST /banco/tipos/2/subtipos  { "nombre": "Gastos" }
   */
  @Post(':id/subtipos')
  @Permisos(Permiso.CREAR_CUENTAS_BANCARIAS)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  crearSubtipo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearSubtipoDto,
    @Request() req: any,
  ) {
    return this.tiposService.crearSubtipo(id, dto, req.user.id_empresa);
  }

  /**
   * PATCH /api/banco/tipos/:id/subtipos/:id_subtipo
   */
  @Patch(':id/subtipos/:id_subtipo')
  @Permisos(Permiso.EDITAR_CUENTAS_BANCARIAS)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  actualizarSubtipo(
    @Param('id', ParseIntPipe) id: number,
    @Param('id_subtipo', ParseIntPipe) idSubtipo: number,
    @Body() dto: ActualizarSubtipoDto,
    @Request() req: any,
  ) {
    return this.tiposService.actualizarSubtipo(id, idSubtipo, dto, req.user.id_empresa);
  }

  /**
   * DELETE /api/banco/tipos/:id/subtipos/:id_subtipo
   * Si tiene categorías asociadas lo desactiva en vez de eliminar.
   */
  @Delete(':id/subtipos/:id_subtipo')
  @Permisos(Permiso.ELIMINAR_CUENTAS_BANCARIAS)
  eliminarSubtipo(
    @Param('id', ParseIntPipe) id: number,
    @Param('id_subtipo', ParseIntPipe) idSubtipo: number,
    @Request() req: any,
  ) {
    return this.tiposService.eliminarSubtipo(id, idSubtipo, req.user.id_empresa);
  }
}
