import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ProveedoresService } from './proveedores.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('proveedores')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Post()
  @Permisos(Permiso.CREAR_COMPRAS)
  create(@Body() dto: CreateProveedorDto) {
    return this.proveedoresService.create(dto);
  }

  @Get()
  @Permisos(Permiso.VER_COMPRAS)
  findAll(@Query('id_empresa', ParseUUIDPipe) idEmpresa: string) {
    return this.proveedoresService.findAll(idEmpresa);
  }

  @Get(':id')
  @Permisos(Permiso.VER_COMPRAS)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.proveedoresService.findOne(id);
  }

  @Patch(':id')
  @Permisos(Permiso.CREAR_COMPRAS)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProveedorDto) {
    return this.proveedoresService.update(id, dto);
  }

  @Delete(':id')
  @Permisos(Permiso.CREAR_COMPRAS)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.proveedoresService.remove(id);
  }
}