import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, UseGuards, Req } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('clientes')
@UseGuards(AuthGuard('jwt'))
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post('sync')
  async buscarOCrear(@Body() data: CreateClienteDto) {
    return await this.clientesService.buscarOCrear(data);
  }

  @Post()
  async create(@Body() data: CreateClienteDto) {
    return await this.clientesService.crear(data);
  }

  @Get()
  async findAll(@Req() req) { // Inyectamos Req
    const idEmpresa = req.user.id_empresa;
    return await this.clientesService.obtenerTodos(idEmpresa);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.clientesService.obtenerUno(id);
  }

  @Patch(':id') // ✅ Cambiado a Patch
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateClienteDto: UpdateClienteDto) {
    return await this.clientesService.actualizar(id, updateClienteDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.clientesService.eliminar(id);
  }
}