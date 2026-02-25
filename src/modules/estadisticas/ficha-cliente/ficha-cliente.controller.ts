import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { FichaClienteService } from './ficha-cliente.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard'; // ⚠️ Ajusta la ruta a tu carpeta auth
import { FichaClienteResponseDto } from './dto/ficha-cliente-response.dto';

@UseGuards(JwtAuthGuard)
@Controller('estadisticas/ficha-cliente')
export class FichaClienteController {
  
  constructor(private readonly fichaClienteService: FichaClienteService) {}

  @Get(':id')
  async obtenerFichaCliente(@Param('id') idCliente: string, @Req() req: any): Promise<FichaClienteResponseDto> {
    const idEmpresa = req.user.id_empresa; 
    return this.fichaClienteService.obtenerDatosFicha(idCliente, idEmpresa);
  }
}