import { Controller, Get, Patch, Param, Body, UseGuards, ParseUUIDPipe, Query } from '@nestjs/common';
import { ConfiguracionImpuestosService } from './configuracion-impuestos.service';
import { UpdateImpuestoDto } from './dto/update-impuesto.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

@Controller('configuracion/impuestos')
@UseGuards(JwtAuthGuard)
export class ConfiguracionImpuestosController {
  constructor(private readonly service: ConfiguracionImpuestosService) {}

  @Get()
  findAll(@Query('id_empresa') idEmpresa: string) {
    return this.service.findAll(idEmpresa);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('id_empresa') idEmpresa: string,
    @Body() dto: UpdateImpuestoDto,
  ) {
    return this.service.update(id, idEmpresa, dto);
  }
}