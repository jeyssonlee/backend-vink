import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { HoldingService } from './holding.service';
import { CreateHoldingDto } from './dto/create-holding.dto';
import { UpdateHoldingDto } from './dto/update-holding.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('holding')
@UseGuards(AuthGuard('jwt'))
export class HoldingController {
  constructor(private readonly holdingService: HoldingService) {}

  @Post()
  async create(@Body() createHoldingDto: CreateHoldingDto) {
    return await this.holdingService.create(createHoldingDto);
  }

  @Get()
  async findAll() {
    return await this.holdingService.findAll();
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateHoldingDto: UpdateHoldingDto) {
    return await this.holdingService.update(id, updateHoldingDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.holdingService.remove(id);
  }
}