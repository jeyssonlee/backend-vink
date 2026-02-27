import { Controller, Post, Body, Get, Param, Patch, UseGuards, Req, ParseUUIDPipe, Query } from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { CrearFacturaLoteDto } from './dto/crear-factura-lote.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('facturas')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  @Post()
  @Permisos(Permiso.CREAR_VENTAS)
  create(@Body() dto: CrearFacturaDto, @Req() req: any) {
    return this.facturasService.crear(dto, req.user);
  }

  @Post('masivo')
  @Permisos(Permiso.CREAR_VENTAS)
  async crearMasivo(@Body() dto: CrearFacturaLoteDto, @Req() req: any) {
    return await this.facturasService.crearLote(dto, req.user.id_empresa, req.user.id_usuario);
  }

  @Patch(':id/confirmar')
  @Permisos(Permiso.CREAR_VENTAS)
  async confirmarBorrador(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return await this.facturasService.confirmarBorrador(id, req.user.id_empresa);
  }

  @Patch(':id/anular')
  @Permisos(Permiso.ANULAR_VENTAS)
  async anular(@Param('id', ParseUUIDPipe) id: string, @Body() body: { motivo?: string }, @Req() req: any) {
    return await this.facturasService.anular(id, body?.motivo || 'Sin motivo', req.user.id_usuario, req.user.id_empresa);
  }

  @Get()
  @Permisos(Permiso.VER_VENTAS)
  findAll(@Query('id_empresa') idEmpresa: string, @Query('id_cliente') idCliente?: string) {
    return this.facturasService.findAll(idEmpresa, idCliente);
  }

  @Get(':id')
  @Permisos(Permiso.VER_VENTAS)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.facturasService.findOne(id);
  }
}