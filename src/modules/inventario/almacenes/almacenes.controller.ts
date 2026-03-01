import { Controller, Get, Post, Body, Patch, Delete, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { AlmacenesService } from './almacenes.service';
import { CreateAlmacenDto } from './dto/create-almacen.dto';
import { UpdateAlmacenDto } from './dto/update-almacen.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('almacenes')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class AlmacenesController {
  constructor(private readonly almacenesService: AlmacenesService) {}

  @Post()
  @Permisos(Permiso.EDITAR_INVENTARIO)
  async create(@Body() dto: CreateAlmacenDto) {
    return await this.almacenesService.create(dto);
  }

  @Get()
  @Permisos(Permiso.VER_INVENTARIO)
  async findAll(@Query('id_sucursal') idSucursal: string) {
    return await this.almacenesService.findAll(idSucursal);
  }

  @Get(':id')
  @Permisos(Permiso.VER_INVENTARIO)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.almacenesService.findOne(id);
  }

  @Patch(':id')
  @Permisos(Permiso.EDITAR_INVENTARIO)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAlmacenDto) {
    return await this.almacenesService.update(id, dto);
  }

  @Delete(':id')
  @Permisos(Permiso.EDITAR_INVENTARIO)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.almacenesService.remove(id);
  }
}