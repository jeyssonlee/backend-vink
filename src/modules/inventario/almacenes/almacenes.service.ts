import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Almacen } from './entities/almacen.entity';
import { CreateAlmacenDto } from './dto/create-almacen.dto';
import { UpdateAlmacenDto } from './dto/update-almacen.dto';

@Injectable()
export class AlmacenesService {
  constructor(
    @InjectRepository(Almacen)
    private readonly almacenRepo: Repository<Almacen>,
  ) {}

  async create(data: CreateAlmacenDto) {
    const nuevo = this.almacenRepo.create(data);
    return await this.almacenRepo.save(nuevo);
  }

  async findAll(idSucursal?: string) {
    const whereCondition = idSucursal ? { sucursal: { id_sucursal: idSucursal } } : {};
    return await this.almacenRepo.find({
      where: whereCondition,
      relations: ['sucursal']
    });
  }

  async findOne(id: string) {
    const almacen = await this.almacenRepo.findOne({ 
        where: { id_almacen: id },
        relations: ['sucursal']
    });
    if (!almacen) throw new NotFoundException('Almacén no encontrado');
    return almacen;
  }

  async update(id: string, updateAlmacenDto: UpdateAlmacenDto) {
    const resultado = await this.almacenRepo.update(id, updateAlmacenDto);
    if (resultado.affected === 0) throw new NotFoundException('Almacén no encontrado');
    return await this.findOne(id);
  }

  async remove(id: string) {
    const resultado = await this.almacenRepo.delete(id);
    if (resultado.affected === 0) throw new NotFoundException('Almacén no encontrado');
    return { message: 'Almacén eliminado correctamente' };
  }
}