import { Controller, Post, Body, Get, Patch, Delete, Param, ParseUUIDPipe, UseGuards, Query } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  // Crear usuario
  @Post()
  @Permisos(Permiso.CREAR_USUARIOS)
  async crear(@Body() dto: CrearUsuarioDto) {
    return await this.usuariosService.crear(dto);
  }

  // Listar todos los usuarios de una empresa
  @Get()
  @Permisos(Permiso.VER_USUARIOS)
  async listar(@Query('id_empresa') idEmpresa: string) {
    return await this.usuariosService.listarPorEmpresa(idEmpresa);
  }

  // Ver uno
  @Get(':id')
  @Permisos(Permiso.VER_USUARIOS)
  async obtenerPorId(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usuariosService.findOne(id);
  }

  // Actualizar
  @Patch(':id')
  @Permisos(Permiso.EDITAR_USUARIOS)
  async actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUsuarioDto) {
    return await this.usuariosService.update(id, dto);
  }

  // Activar / Desactivar
  @Patch(':id/toggle-activo')
  @Permisos(Permiso.EDITAR_USUARIOS)
  async toggleActivo(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usuariosService.toggleActivo(id);
  }

  // Migrar vendedores a usuarios
  @Post('migrar-vendedores')
  async migrarVendedores(@Body('id_empresa') idEmpresa: string) {
    return await this.usuariosService.migrarVendedores(idEmpresa);
  }

  // Eliminar
  @Delete(':id')
  @Permisos(Permiso.EDITAR_USUARIOS)
  async eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usuariosService.remove(id);
  }
}