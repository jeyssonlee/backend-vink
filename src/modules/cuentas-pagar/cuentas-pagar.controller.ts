import {
    Controller, Get, Post, Body, Param, ParseUUIDPipe,
    UseGuards, Req, Query,
  } from '@nestjs/common';
  import { CuentasPagarService } from './cuentas-pagar.service';
  import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
  import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
  import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
  import { Permiso } from 'src/modules/auth/permisos.enum';
  import { AplicarPagoDto } from './dto/aplicar-pago.dto';
  
  
  @Controller('cuentas-pagar')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  export class CuentasPagarController {
    constructor(private readonly service: CuentasPagarService) {}
  
    @Get()
    @Permisos(Permiso.VER_COMPRAS)
    async findAll(@Req() req, @Query('soloActivas') soloActivas?: string) {
      return this.service.findAll(req.user.id_empresa, soloActivas === 'true');
    }
  
    @Get('resumen')
    @Permisos(Permiso.VER_COMPRAS)
    async resumen(@Req() req) {
      return this.service.resumen(req.user.id_empresa);
    }
  
    @Get(':id')
    @Permisos(Permiso.VER_COMPRAS)
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
      return this.service.findOne(id);
    }
  
    @Post(':id/pago')
    @Permisos(Permiso.CREAR_COMPRAS)
    async aplicarPago(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AplicarPagoDto) {
      return this.service.aplicarPago(id, dto);
    }
  
    @Get('proveedor/:idProveedor')
    @Permisos(Permiso.VER_COMPRAS)
    async historialProveedor(@Param('idProveedor', ParseUUIDPipe) idProveedor: string, @Req() req) {
      return this.service.historialProveedor(idProveedor, req.user.id_empresa);
    }
  }