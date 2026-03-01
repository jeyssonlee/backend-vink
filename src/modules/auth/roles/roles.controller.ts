import { Controller, Get, Patch, Post, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permisos(Permiso.VER_ROLES)
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Permisos(Permiso.VER_ROLES)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id/permisos')
  @Permisos(Permiso.EDITAR_ROLES)
  updatePermisos(@Param('id', ParseUUIDPipe) id: string, @Body('permisos') permisos: string[]) {
    return this.rolesService.updatePermisos(id, permisos);
  }

  @Post()
  @Permisos(Permiso.CREAR_ROLES)
  crear(@Body() body: { nombre: string; descripcion: string; permisos: string[] }) {
    return this.rolesService.crear(body);
  }
}