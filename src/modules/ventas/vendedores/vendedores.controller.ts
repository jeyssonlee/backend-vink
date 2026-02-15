import { Controller, Get, Post, Put, Delete, Body, Param, ParseUUIDPipe, UseGuards, Query, Req } from '@nestjs/common';
import { VendedoresService } from './vendedores.service';
import { CreateVendedorDto } from './dto/create-vendedor.dto';
import { UpdateVendedorDto } from './dto/update-vendedor.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('vendedores')
@UseGuards(AuthGuard('jwt'))
export class VendedoresController {
  constructor(private readonly vendedoresService: VendedoresService) {}

  @Post()
  async crear(@Body() data: CreateVendedorDto) { // Validación estricta
    return await this.vendedoresService.crear(data);
  }

  @Get()
  async listar(@Query('id_empresa') idEmpresaQuery: string, @Req() req) {
    // Prioridad: Query Param (Frontend) o Token (Backend)
    const idEmpresa = idEmpresaQuery || req.user?.id_empresa;
    return await this.vendedoresService.obtenerTodos(idEmpresa);
  }

  @Get(':id')
  async obtenerUno(@Param('id', ParseUUIDPipe) id: string) { // Validar UUID en URL
    return await this.vendedoresService.obtenerUno(id);
  }

  @Put(':id')
  async actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() UpdateVendedorDto: UpdateVendedorDto) {
    return await this.vendedoresService.actualizar(id, UpdateVendedorDto);
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return await this.vendedoresService.eliminar(id);
  }
}