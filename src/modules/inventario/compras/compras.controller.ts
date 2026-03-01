import { Controller, Get, Post, Body, Patch, Param, ParseUUIDPipe, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { ComprasService } from './compras.service';
import { CrearCompraDto } from './dto/crear-compra.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('compras')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Post()
  @Permisos(Permiso.CREAR_COMPRAS)
  async create(@Body() dto: CrearCompraDto) {
    return await this.comprasService.crear(dto);
  }

  @Get()
  @Permisos(Permiso.VER_COMPRAS)
  async findAll() {
    return await this.comprasService.findAll();
  }

  @Get(':id')
  @Permisos(Permiso.VER_COMPRAS)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.comprasService.findOne(id);
  }

  @Patch(':termino/anular')
  @Permisos(Permiso.CREAR_COMPRAS)
  async anularCompra(@Param('termino') termino: string, @Req() req) {
    const idEmpresa = req.user.id_empresa;
    if (!idEmpresa) throw new UnauthorizedException('Usuario sin empresa asignada');
    return await this.comprasService.anular(termino, idEmpresa);
  }
}