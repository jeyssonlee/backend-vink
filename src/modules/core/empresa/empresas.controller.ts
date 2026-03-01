import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { EmpresasService } from './empresas.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('empresas')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Post()
  @Permisos(Permiso.EDITAR_EMPRESA)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async create(@Body() dto: CreateEmpresaDto) {
    return await this.empresasService.create(dto);
  }

  @Get()
  @Permisos(Permiso.VER_EMPRESA)
  async findAll() {
    return await this.empresasService.findAll();
  }

  @Get(':id')
  @Permisos(Permiso.VER_EMPRESA)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.empresasService.findOne(id);
  }

  @Patch(':id')
  @Permisos(Permiso.EDITAR_EMPRESA)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmpresaDto) {
    return await this.empresasService.update(id, dto);
  }

  @Delete(':id')
  @Permisos(Permiso.EDITAR_EMPRESA)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.empresasService.remove(id);
  }
}