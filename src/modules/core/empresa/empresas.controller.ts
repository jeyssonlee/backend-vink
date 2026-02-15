import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { EmpresasService } from './empresas.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('empresas')
@UseGuards(AuthGuard('jwt'))
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async create(@Body() createEmpresaDto: CreateEmpresaDto) {
    return await this.empresasService.create(createEmpresaDto);
  }

  @Get()
  async findAll() {
    return await this.empresasService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.empresasService.findOne(id);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateEmpresaDto: UpdateEmpresaDto) {
    return await this.empresasService.update(id, updateEmpresaDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.empresasService.remove(id);
  }
}