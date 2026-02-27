import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, UseGuards, Req } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('clientes')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post('sync')
  @Permisos(Permiso.CREAR_CLIENTES)
  async buscarOCrear(@Body() data: CreateClienteDto) {
    return await this.clientesService.buscarOCrear(data);
  }

  @Post()
  @Permisos(Permiso.CREAR_CLIENTES)
  async create(@Body() data: CreateClienteDto) {
    return await this.clientesService.crear(data);
  }

  @Get()
  @Permisos(Permiso.VER_CLIENTES)
  async findAll(@Req() req) {
    return await this.clientesService.obtenerTodos(req.user.id_empresa);
  }

  @Get(':id')
  @Permisos(Permiso.VER_CLIENTES)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.clientesService.obtenerUno(id);
  }

  @Patch(':id')
  @Permisos(Permiso.EDITAR_CLIENTES)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClienteDto) {
    return await this.clientesService.actualizar(id, dto);
  }

  @Delete(':id')
  @Permisos(Permiso.EDITAR_CLIENTES)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.clientesService.eliminar(id);
  }
}