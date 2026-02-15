import { Controller, Get, Param, ParseUUIDPipe, UseGuards, Req, Query } from '@nestjs/common';
import { KardexService } from './kardex.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('kardex')
@UseGuards(AuthGuard('jwt')) // 🔒 Seguridad ante todo
export class KardexController {
  constructor(private readonly kardexService: KardexService) {}

  // 1. Ver historial completo de un producto específico
  // Uso: GET /kardex/producto/UUID-DEL-PRODUCTO
  @Get('producto/:id')
  async verHistorialProducto(
    @Param('id', ParseUUIDPipe) idProducto: string, 
    @Req() req
  ) {
    const idEmpresa = req.user.id_empresa;
    return await this.kardexService.obtenerHistorialProducto(idProducto, idEmpresa);
  }

  // 2. (Opcional) Ver movimientos recientes globales de la empresa
  // Uso: GET /kardex/recientes
     @Get('recientes')
  async verRecientes(@Req() req) {
    // 1. Obtenemos el ID de la empresa del usuario logueado
    const idEmpresa = req.user.id_empresa;

    // 2. Llamamos al nuevo método público del servicio (NO al repo directo)
    return await this.kardexService.obtenerUltimosMovimientos(idEmpresa);
  }
  }
