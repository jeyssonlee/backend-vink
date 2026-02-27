import { Controller, Get, Post, Put, Delete, Body, Param, ParseUUIDPipe, UseGuards, Query, Req } from '@nestjs/common';
import { VendedoresService } from './vendedores.service';
import { CreateVendedorDto } from './dto/create-vendedor.dto';
import { UpdateVendedorDto } from './dto/update-vendedor.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('vendedores')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class VendedoresController {
  constructor(private readonly vendedoresService: VendedoresService) {}

  @Post()
  @Permisos(Permiso.CREAR_USUARIOS)
  async crear(@Body() data: CreateVendedorDto) {
    return await this.vendedoresService.crear(data);
  }

  @Get()
  @Permisos(Permiso.VER_USUARIOS)
  async listar(@Query('id_empresa') idEmpresaQuery: string, @Req() req) {
    const idEmpresa = idEmpresaQuery || req.user?.id_empresa;
    return await this.vendedoresService.obtenerTodos(idEmpresa);
  }

  @Get(':id')
  @Permisos(Permiso.VER_USUARIOS)
  async obtenerUno(@Param('id', ParseUUIDPipe) id: string) {
    return await this.vendedoresService.obtenerUno(id);
  }

  @Put(':id')
  @Permisos(Permiso.EDITAR_USUARIOS)
  async actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVendedorDto) {
    return await this.vendedoresService.actualizar(id, dto);
  }

  @Delete(':id')
  @Permisos(Permiso.EDITAR_USUARIOS)
  async eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return await this.vendedoresService.eliminar(id);
  }
}