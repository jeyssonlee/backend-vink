import { Controller, Get, Param, ParseUUIDPipe, UseGuards, Req } from '@nestjs/common';
import { KardexService } from './kardex.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('kardex')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class KardexController {
  constructor(private readonly kardexService: KardexService) {}

  @Get('producto/:id')
  @Permisos(Permiso.VER_KARDEX)
  async verHistorialProducto(@Param('id', ParseUUIDPipe) idProducto: string, @Req() req) {
    return await this.kardexService.obtenerHistorialProducto(idProducto, req.user.id_empresa);
  }

  @Get('recientes')
  @Permisos(Permiso.VER_KARDEX)
  async verRecientes(@Req() req) {
    return await this.kardexService.obtenerUltimosMovimientos(req.user.id_empresa);
  }
}