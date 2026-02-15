import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sucursal } from './entities/sucursal.entity'; // Asegúrate que la entidad exista
import { CreateSucursalDto } from './dto/create-sucursal.dto';
import { UpdateSucursalDto } from './dto/update-sucursal.dto';

@Injectable()
export class SucursalesService {
  constructor(
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
  ) {}

  async create(createSucursalDto: CreateSucursalDto) {
    const nueva = this.sucursalRepo.create(createSucursalDto);
    return await this.sucursalRepo.save(nueva);
  }

  async findAll() {
    return await this.sucursalRepo.find({
      relations: ['empresa'],
    });
  }

  async findOne(id: string) {
    const sucursal = await this.sucursalRepo.findOne({ 
      where: { id_sucursal: id },
      relations: ['empresa', 'almacenes'] // Útil ver sus almacenes
    });
    if (!sucursal) throw new NotFoundException(`Sucursal con ID ${id} no encontrada`);
    return sucursal;
  }

  async update(id: string, updateSucursalDto: UpdateSucursalDto) {
    // Usamos update directo para eficiencia
    const resultado = await this.sucursalRepo.update(id, updateSucursalDto);
    if (resultado.affected === 0) throw new NotFoundException(`Sucursal con ID ${id} no encontrada`);
    return await this.findOne(id);
  }

  async remove(id: string) {
    const resultado = await this.sucursalRepo.delete(id);
    if (resultado.affected === 0) throw new NotFoundException(`Sucursal con ID ${id} no encontrada`);
    return { message: 'Sucursal eliminada correctamente' };
  }
}