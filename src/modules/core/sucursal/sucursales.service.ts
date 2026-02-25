import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sucursal } from './entities/sucursal.entity';
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

  // 👇 Modificamos la búsqueda para filtrar por empresa
  async findAll(idEmpresa?: string) {
    const opcionesBusqueda: any = {
      relations: ['empresa'],
    };

    // Si nos pasan un ID de empresa, filtramos. Si no, devuelve todas.
    if (idEmpresa) {
      opcionesBusqueda.where = { empresa: { id: idEmpresa } }; 
      // Nota: Si la PK de empresa en tu empresa.entity.ts se llama solo 'id', 
      // cambia la línea de arriba a: { empresa: { id: idEmpresa } }
    }

    return await this.sucursalRepo.find(opcionesBusqueda);
  }

  async findOne(id: string) {
    const sucursal = await this.sucursalRepo.findOne({ 
      where: { id_sucursal: id },
      relations: ['empresa', 'almacenes'] 
    });
    if (!sucursal) throw new NotFoundException(`Sucursal con ID ${id} no encontrada`);
    return sucursal;
  }

  async update(id: string, updateSucursalDto: UpdateSucursalDto) {
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