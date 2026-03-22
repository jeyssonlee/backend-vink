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
  import { CuentasBancariasService } from './cuentas-bancarias.service';
  import { CrearCuentaBancariaDto, ActualizarCuentaBancariaDto } from './dto/cuenta-bancaria.dto';
  import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
  import { PermisosGuard } from '../../auth/guards/permisos.guard';
  import { Permisos } from '../../auth/decorators/permisos.decorator';
  import { Permiso } from '../../auth/permisos.enum';
  
  @Controller('banco/cuentas')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  export class CuentasBancariasController {
    constructor(private readonly cuentasService: CuentasBancariasService) {}
  
    /**
     * GET /api/banco/cuentas
     * Lista las cuentas de la empresa del usuario autenticado.
     */
    @Get()
    @Permisos(Permiso.VER_CUENTAS_BANCARIAS)
    listar(@Request() req: any) {
      return this.cuentasService.listar(req.user.id_empresa);
    }
  
    /**
     * GET /api/banco/cuentas/:id
     */
    @Get(':id')
    @Permisos(Permiso.VER_CUENTAS_BANCARIAS)
    obtener(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
      return this.cuentasService.obtener(id, req.user.id_empresa);
    }

    /**
 * GET /api/banco/cuentas/empresa/:id_empresa
 * Lista las cuentas de una empresa específica del holding.
 * Solo SUPER_ADMIN y ROOT.
 */
    @Get('empresa/:id_empresa')
    @Permisos(Permiso.VER_CUENTAS_BANCARIAS)
    listarPorEmpresa(
    @Param('id_empresa') id_empresa_destino: string,
    @Request() req: any,
    ) {
      return this.cuentasService.listarPorEmpresa(id_empresa_destino, req.user.id_empresa);
    }
  
    /**
     * POST /api/banco/cuentas
     * ROOT y SUPER_ADMIN pueden crear cuentas.
     */
    @Post()
    @Permisos(Permiso.CREAR_CUENTAS_BANCARIAS)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    crear(@Body() dto: CrearCuentaBancariaDto, @Request() req: any) {
      return this.cuentasService.crear(dto, req.user.id_empresa);
    }
  
    /**
     * PATCH /api/banco/cuentas/:id
     * ROOT y SUPER_ADMIN pueden editar (nombre, banco_key, activa).
     */
    @Patch(':id')
    @Permisos(Permiso.EDITAR_CUENTAS_BANCARIAS)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    actualizar(
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: ActualizarCuentaBancariaDto,
      @Request() req: any,
    ) {
      return this.cuentasService.actualizar(id, dto, req.user.id_empresa);
    }
  
    /**
     * DELETE /api/banco/cuentas/:id
     * Si tiene movimientos → desactiva. Si no → elimina físicamente.
     */
    @Delete(':id')
    @Permisos(Permiso.ELIMINAR_CUENTAS_BANCARIAS)
    desactivar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
      return this.cuentasService.desactivar(id, req.user.id_empresa);
    }
  }