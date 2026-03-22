import {
    Controller, Get, Param, Query,
    ParseIntPipe, UseGuards, Request,
    Patch,Body
  } from '@nestjs/common';
  import { MovimientosService } from './movimientos.service';
  import { FiltrosMovimientosDto } from './dto/movimientos.dto';
  import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
  import { PermisosGuard } from '../../auth/guards/permisos.guard';
  import { Permisos } from '../../auth/decorators/permisos.decorator';
  import { Permiso } from '../../auth/permisos.enum';
  import { EditarMovimientoDto } from './dto/movimientos.dto';
  
  @Controller('banco/movimientos')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  export class MovimientosController {
    constructor(private readonly movimientosService: MovimientosService) {}
  
    /**
     * GET /api/banco/movimientos
     * Listado paginado con filtros: fecha, categoría, tipo_destino, ingreso/egreso
     */
    @Get()
    @Permisos(Permiso.VER_MOVIMIENTOS)
    listar(@Query() filtros: FiltrosMovimientosDto, @Request() req: any) {
      return this.movimientosService.listar(filtros, req.user.id_empresa);
    }
  
    /**
     * GET /api/banco/movimientos/:id
     * Detalle de un movimiento con sus distribuciones
     */
    @Get(':id')
    @Permisos(Permiso.VER_MOVIMIENTOS)
    obtener(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
      return this.movimientosService.obtener(id, req.user.id_empresa);
    }

    @Patch(':id')
    @Permisos(Permiso.VER_MOVIMIENTOS)
    editar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarMovimientoDto,
    @Request() req: any,
    ) {
      return this.movimientosService.editar(id, req.user.id_empresa, dto);
    } 
  }