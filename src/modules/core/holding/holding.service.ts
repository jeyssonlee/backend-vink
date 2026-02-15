import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Holding } from './entities/holding.entity';
import { CreateHoldingDto } from './dto/create-holding.dto';
import { UpdateHoldingDto } from './dto/update-holding.dto';

@Injectable()
export class HoldingService {
  constructor(
    @InjectRepository(Holding)
    private readonly holdingRepo: Repository<Holding>,
  ) {}

  async create(createHoldingDto: CreateHoldingDto) {
    const nuevo = this.holdingRepo.create(createHoldingDto);
    return await this.holdingRepo.save(nuevo);
  }

  async findAll() {
    return await this.holdingRepo.find({
      relations: ['empresas'], // Opcional: ver sus empresas hijas
    });
  }

  async findOne(id: string) {
    const holding = await this.holdingRepo.findOne({ 
      where: { id_holding: id },
      relations: ['empresas'] 
    });
    if (!holding) throw new NotFoundException(`Holding con ID ${id} no encontrado`);
    return holding;
  }

  async update(id: string, updateHoldingDto: UpdateHoldingDto) {
    const holding = await this.findOne(id); // Valida que exista
    const actualizado = Object.assign(holding, updateHoldingDto);
    return await this.holdingRepo.save(actualizado);
  }

  async remove(id: string) {
    const resultado = await this.holdingRepo.delete(id);
    if (resultado.affected === 0) throw new NotFoundException(`Holding con ID ${id} no encontrado`);
    return { message: 'Holding eliminado correctamente' };
  }
}