import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, UseGuards, Query } from '@nestjs/common';
import { SucursalesService } from './sucursales.service';
import { CreateSucursalDto } from './dto/create-sucursal.dto';
import { UpdateSucursalDto } from './dto/update-sucursal.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('sucursales')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class SucursalesController {
  constructor(private readonly sucursalesService: SucursalesService) {}

  @Post()
  @Permisos(Permiso.EDITAR_EMPRESA)
  async create(@Body() dto: CreateSucursalDto) {
    return await this.sucursalesService.create(dto);
  }

  @Get()
  @Permisos(Permiso.VER_EMPRESA)
  async findAll(@Query('id_empresa') idEmpresa: string) {
    return await this.sucursalesService.findAll(idEmpresa);
  }

  @Get(':id')
  @Permisos(Permiso.VER_EMPRESA)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.sucursalesService.findOne(id);
  }

  @Patch(':id')
  @Permisos(Permiso.EDITAR_EMPRESA)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSucursalDto) {
    return await this.sucursalesService.update(id, dto);
  }

  @Delete(':id')
  @Permisos(Permiso.EDITAR_EMPRESA)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.sucursalesService.remove(id);
  }
}