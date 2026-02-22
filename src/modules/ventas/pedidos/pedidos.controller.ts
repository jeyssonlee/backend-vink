import { Controller, Post, Get, Body, Patch, Param, UseGuards, Req, UnauthorizedException, Query } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { AuthGuard } from '@nestjs/passport'; 

@Controller('pedidos')
@UseGuards(AuthGuard('jwt')) 
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Post()
  async crear(@Body() createPedidoDto: CreatePedidoDto, @Req() req) {
    const usuarioLogueado = req.user;
    createPedidoDto.id_empresa = usuarioLogueado.id_empresa;
    createPedidoDto.id_vendedor = usuarioLogueado.id;
    
     // CORRECCIÓN: Usamos el método 'Local' que sabe leer este DTO
    return await this.pedidosService.crearPedidoLocal(createPedidoDto);
  }

  @Get()
  async listar(@Req() req, @Query('estado') estado?: string) { // 🚀 Agregamos @Query
    const idEmpresa = req.user.id_empresa;
    
    // Le pasamos el estado (si existe) y el id_empresa al servicio
    return await this.pedidosService.obtenerTodos(idEmpresa, estado);
  }

  @Get(':id')
  async obtenerPorId(@Param('id') id: string, @Req() req) {
    const idEmpresa = req.user.id_empresa;
    return await this.pedidosService.obtenerUnPedido(id, idEmpresa);
  }

  @Patch(':id_local/anular')
  async anular(@Param('id_local') idPedidoLocal: string, @Req() req) {
    const idEmpresa = req.user.id_empresa;
    if (!idEmpresa) throw new UnauthorizedException('No tienes empresa asignada');
    return await this.pedidosService.anularPedido(idPedidoLocal);
  }

  @Patch(':id_local/completar')
  async completar(@Param('id_local') idPedidoLocal: string, @Req() req) {
    const idEmpresa = req.user.id_empresa;
    if (!idEmpresa) throw new UnauthorizedException('No tienes empresa asignada');
    return await this.pedidosService.completarVenta(idPedidoLocal, idEmpresa);
  }

  @Patch(':id')
  async actualizar(@Param('id') id: string, @Body() updateDto: CreatePedidoDto) {
    return await this.pedidosService.actualizarPedido(id, updateDto);
  }
}