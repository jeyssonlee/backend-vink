import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { HoldingService } from './holding.service';
import { CreateHoldingDto } from './dto/create-holding.dto';
import { UpdateHoldingDto } from './dto/update-holding.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('holding')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class HoldingController {
  constructor(private readonly holdingService: HoldingService) {}

  @Post()
  @Permisos(Permiso.EDITAR_EMPRESA)
  async create(@Body() dto: CreateHoldingDto) {
    return await this.holdingService.create(dto);
  }

  @Get()
  @Permisos(Permiso.VER_EMPRESA)
  async findAll() {
    return await this.holdingService.findAll();
  }

  @Patch(':id')
  @Permisos(Permiso.EDITAR_EMPRESA)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHoldingDto) {
    return await this.holdingService.update(id, dto);
  }

  @Delete(':id')
  @Permisos(Permiso.EDITAR_EMPRESA)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.holdingService.remove(id);
  }
}