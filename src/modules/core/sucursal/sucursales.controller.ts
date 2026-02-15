import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { SucursalesService } from './sucursales.service';
import { CreateSucursalDto } from './dto/create-sucursal.dto';
import { UpdateSucursalDto } from './dto/update-sucursal.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('sucursales')
@UseGuards(AuthGuard('jwt'))
export class SucursalesController {
  constructor(private readonly sucursalesService: SucursalesService) {}

  @Post()
  async create(@Body() createSucursalDto: CreateSucursalDto) {
    return await this.sucursalesService.create(createSucursalDto);
  }

  @Get()
  async findAll() {
    return await this.sucursalesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.sucursalesService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateSucursalDto: UpdateSucursalDto) {
    return await this.sucursalesService.update(id, updateSucursalDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.sucursalesService.remove(id);
  }
}