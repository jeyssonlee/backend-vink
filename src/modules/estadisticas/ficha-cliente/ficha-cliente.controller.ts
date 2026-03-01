import { Controller, Get, Param, Req, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { FichaClienteService } from './ficha-cliente.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';
import { FichaClienteResponseDto } from './dto/ficha-cliente-response.dto';

@Controller('estadisticas/ficha-cliente')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class FichaClienteController {
  constructor(private readonly fichaClienteService: FichaClienteService) {}

  @Get(':id')
  @Permisos(Permiso.VER_CXC)
  async obtenerFichaCliente(@Param('id', ParseUUIDPipe) idCliente: string, @Req() req: any): Promise<FichaClienteResponseDto> {
    return this.fichaClienteService.obtenerDatosFicha(idCliente, req.user.id_empresa);
  }
}