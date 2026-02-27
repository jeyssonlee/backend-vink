import { Controller, Get, Patch, Post, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id/permisos')
  updatePermisos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('permisos') permisos: string[]
  ) {
    return this.rolesService.updatePermisos(id, permisos);
  }

  @Post()
  crear(@Body() body: { nombre: string; descripcion: string; permisos: string[] }) {
    return this.rolesService.crear(body);
  }
}