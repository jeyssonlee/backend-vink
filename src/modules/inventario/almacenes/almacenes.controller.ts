import { Controller, Get, Post, Body, Patch, Delete, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { AlmacenesService } from './almacenes.service';
import { CreateAlmacenDto } from './dto/create-almacen.dto';
import { UpdateAlmacenDto } from './dto/update-almacen.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('almacenes')
@UseGuards(AuthGuard('jwt'))
export class AlmacenesController {
  constructor(private readonly almacenesService: AlmacenesService) {}

  @Post()
  async create(@Body() createAlmacenDto: CreateAlmacenDto) {
    return await this.almacenesService.create(createAlmacenDto);
  }

  @Get()
  async findAll(@Query('id_sucursal') idSucursal: string) {
    return await this.almacenesService.findAll(idSucursal);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.almacenesService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateAlmacenDto: UpdateAlmacenDto) {
    return await this.almacenesService.update(id, updateAlmacenDto); // ⚠️ Pendiente en Service
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.almacenesService.remove(id); // ⚠️ Pendiente en Service
  }
}