import { Controller, Post, Body, Get, Patch, Delete, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto'; // 👈 Asegúrate de crear este archivo
import { AuthGuard } from '@nestjs/passport';

@Controller('usuarios')
@UseGuards(AuthGuard('jwt'))
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  async crear(@Body() crearUsuarioDto: CrearUsuarioDto) {
    return await this.usuariosService.crear(crearUsuarioDto);
  }

  @Get(':id')
  async obtenerPorId(@Param('id', ParseUUIDPipe) id: string) {
    // Asumiendo que implementes este método en el servicio
    return await this.usuariosService.findOne(id); 
  }

  @Patch(':id')
  async actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() updateUsuarioDto: UpdateUsuarioDto) {
    return await this.usuariosService.update(id, updateUsuarioDto); // ⚠️ Requiere implementar update en service
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usuariosService.remove(id); // ⚠️ Requiere implementar remove en service
  }
}