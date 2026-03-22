import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, Query,
    ParseIntPipe, UseGuards, Request,
  } from '@nestjs/common';
  import { MovimientoManualService } from './movimiento-manual.service';
  import {
    CrearMovimientoManualDto,
    EditarMovimientoManualDto,
    FiltrosMovimientoManualDto,
  } from './dto/movimiento-manual.dto';
  import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
  import { PermisosGuard } from '../../auth/guards/permisos.guard';
  import { Permisos } from '../../auth/decorators/permisos.decorator';
  import { Permiso } from '../../auth/permisos.enum';
  
  @Controller('banco/movimientos-manuales')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  export class MovimientoManualController {
    constructor(private readonly service: MovimientoManualService) {}
  
    /**
     * POST /api/banco/movimientos-manuales
     * Registrar un nuevo movimiento manual (ingreso o egreso)
     */
    @Post()
    @Permisos(Permiso.VER_MOVIMIENTOS)
    crear(@Body() dto: CrearMovimientoManualDto, @Request() req: any) {
      return this.service.crear(dto, req.user.id_empresa);
    }
  
    /**
     * GET /api/banco/movimientos-manuales
     * Listar movimientos manuales con filtros
     */
    @Get()
    @Permisos(Permiso.VER_MOVIMIENTOS)
    listar(@Query() filtros: FiltrosMovimientoManualDto, @Request() req: any) {
      return this.service.listar(filtros, req.user.id_empresa);
    }
  
    /**
     * GET /api/banco/movimientos-manuales/resumen
     * Resumen para dashboard — ingresos, egresos operativos, inventario
     */
    @Get('resumen')
    @Permisos(Permiso.VER_MOVIMIENTOS)
    resumen(
      @Query('fecha_desde') fecha_desde: string,
      @Query('fecha_hasta') fecha_hasta: string,
      @Request() req: any,
    ) {
      return this.service.resumen(req.user.id_empresa, fecha_desde, fecha_hasta);
    }
  
    /**
     * GET /api/banco/movimientos-manuales/:id
     * Detalle de un movimiento manual
     */
    @Get(':id')
    @Permisos(Permiso.VER_MOVIMIENTOS)
    obtener(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
      return this.service.obtener(id, req.user.id_empresa);
    }
  
    /**
     * PATCH /api/banco/movimientos-manuales/:id
     * Editar un movimiento manual
     */
    @Patch(':id')
    @Permisos(Permiso.VER_MOVIMIENTOS)
    editar(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: EditarMovimientoManualDto,
      @Request() req: any,
    ) {
      return this.service.editar(id, dto, req.user.id_empresa);
    }
  
    /**
     * DELETE /api/banco/movimientos-manuales/:id
     * Eliminar un movimiento manual
     */
    @Delete(':id')
    @Permisos(Permiso.VER_MOVIMIENTOS)
    eliminar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
      return this.service.eliminar(id, req.user.id_empresa);
    }
  }