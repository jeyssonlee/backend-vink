import { Controller, Post, Get, Body, Patch, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { AuthGuard } from '@nestjs/passport'; 

@Controller('pedidos')
@UseGuards(AuthGuard('jwt')) 
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Post()
  async crear(@Body() createPedidoDto: CreatePedidoDto, @Req() req) {
    const idEmpresa = req.user.id_empresa;
    
    // Inyectamos empresa si falta
    if (!createPedidoDto.id_empresa) {
        createPedidoDto.id_empresa = idEmpresa;
    }
    
    // CORRECCIÓN: Usamos el método 'Local' que sabe leer este DTO
    return await this.pedidosService.crearPedidoLocal(createPedidoDto);
  }

  @Get()
  async listar(@Req() req) {
    // CORRECCIÓN: Ahora este método existe en el servicio
    return await this.pedidosService.obtenerTodos();
  }

  @Patch(':id_local/anular')
  async anular(@Param('id_local') idPedidoLocal: string, @Req() req) {
    const idEmpresa = req.user.id_empresa;
    if (!idEmpresa) throw new UnauthorizedException('No tienes empresa asignada');
    return await this.pedidosService.anularPedido(idPedidoLocal, idEmpresa);
  }

  @Patch(':id_local/completar')
  async completar(@Param('id_local') idPedidoLocal: string, @Req() req) {
    const idEmpresa = req.user.id_empresa;
    if (!idEmpresa) throw new UnauthorizedException('No tienes empresa asignada');
    return await this.pedidosService.completarVenta(idPedidoLocal, idEmpresa);
  }
}