import { Controller, Post, Get, Body, Patch, Param, UseGuards, Req, UnauthorizedException, Query } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('pedidos')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Post()
  @Permisos(Permiso.CREAR_PEDIDOS)
  async crear(@Body() dto: CreatePedidoDto, @Req() req) {
    dto.id_empresa = req.user.id_empresa;
    dto.id_vendedor = req.user.id;
    return await this.pedidosService.crearPedidoLocal(dto);
  }

  @Get()
  @Permisos(Permiso.VER_PEDIDOS)
  async listar(@Req() req, @Query('estado') estado?: string) {
    return await this.pedidosService.obtenerTodos(req.user.id_empresa, estado);
  }

  @Get(':id')
  @Permisos(Permiso.VER_PEDIDOS)
  async obtenerPorId(@Param('id') id: string, @Req() req) {
    return await this.pedidosService.obtenerUnPedido(id, req.user.id_empresa);
  }

  @Patch(':id_local/anular')
  @Permisos(Permiso.VER_PEDIDOS)
  async anular(@Param('id_local') idPedidoLocal: string, @Req() req) {
    if (!req.user.id_empresa) throw new UnauthorizedException('No tienes empresa asignada');
    return await this.pedidosService.anularPedido(idPedidoLocal);
  }

  @Patch(':id_local/completar')
  @Permisos(Permiso.CREAR_VENTAS)
  async completar(@Param('id_local') idPedidoLocal: string, @Req() req) {
    if (!req.user.id_empresa) throw new UnauthorizedException('No tienes empresa asignada');
    return await this.pedidosService.completarVenta(idPedidoLocal, req.user.id_empresa);
  }

  @Patch(':id')
  @Permisos(Permiso.VER_PEDIDOS)
  async actualizar(@Param('id') id: string, @Body() dto: CreatePedidoDto) {
    return await this.pedidosService.actualizarPedido(id, dto);
  }
}