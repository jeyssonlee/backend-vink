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
  import { CategoriasService } from './categorias.service';
  import {
    CrearCategoriaDto,
    ActualizarCategoriaDto,
    AgregarPalabrasClaveDto,
  } from './dto/categoria.dto';
  import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
  import { PermisosGuard } from '../../auth/guards/permisos.guard';
  import { Permisos } from '../../auth/decorators/permisos.decorator';
  import { Permiso } from '../../auth/permisos.enum';
  
  @Controller('banco/categorias')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  export class CategoriasController {
    constructor(private readonly categoriasService: CategoriasService) {}
  
    // ── CATEGORÍAS ────────────────────────────────
  
    @Get()
    @Permisos(Permiso.VER_MOVIMIENTOS)
    listar(@Request() req: any) {
      return this.categoriasService.listar(req.user.id_empresa);
    }
  
    @Get(':id')
    @Permisos(Permiso.VER_MOVIMIENTOS)
    obtener(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
      return this.categoriasService.obtener(id, req.user.id_empresa);
    }
  
    @Post()
    @Permisos(Permiso.CREAR_CUENTAS_BANCARIAS)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    crear(@Body() dto: CrearCategoriaDto, @Request() req: any) {
      return this.categoriasService.crear(dto, req.user.id_empresa);
    }
  
    @Patch(':id')
    @Permisos(Permiso.EDITAR_CUENTAS_BANCARIAS)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    actualizar(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: ActualizarCategoriaDto,
      @Request() req: any,
    ) {
      return this.categoriasService.actualizar(id, dto, req.user.id_empresa);
    }
  
    @Delete(':id')
    @Permisos(Permiso.ELIMINAR_CUENTAS_BANCARIAS)
    eliminar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
      return this.categoriasService.eliminar(id, req.user.id_empresa);
    }
  
    // ── PALABRAS CLAVE ────────────────────────────
  
    /**
     * POST /api/banco/categorias/:id/palabras
     * Agrega una o varias palabras clave a la categoría.
     */
    @Post(':id/palabras')
    @Permisos(Permiso.EDITAR_CUENTAS_BANCARIAS)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    agregarPalabras(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: AgregarPalabrasClaveDto,
      @Request() req: any,
    ) {
      return this.categoriasService.agregarPalabras(id, dto, req.user.id_empresa);
    }
  
    /**
     * DELETE /api/banco/categorias/:id/palabras/:id_regla
     * Elimina una palabra clave específica de la categoría.
     */
    @Delete(':id/palabras/:id_regla')
    @Permisos(Permiso.EDITAR_CUENTAS_BANCARIAS)
    eliminarPalabra(
      @Param('id', ParseIntPipe) id: number,
      @Param('id_regla', ParseIntPipe) id_regla: number,
      @Request() req: any,
    ) {
      return this.categoriasService.eliminarPalabra(id, id_regla, req.user.id_empresa);
    }
  }