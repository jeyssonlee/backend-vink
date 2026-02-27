import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rol } from './entities/rol.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Rol)
    private readonly rolRepo: Repository<Rol>,
  ) {}

  async findAll() {
    return this.rolRepo.find({ order: { nombre: 'ASC' } });
  }

  async findOne(id: string) {
    const rol = await this.rolRepo.findOne({ where: { id_rol: id } });
    if (!rol) throw new NotFoundException('Rol no encontrado');
    return rol;
  }

  async updatePermisos(id: string, permisos: string[]) {
    const rol = await this.findOne(id);
    rol.permisos = permisos;
    return this.rolRepo.save(rol);
  }

  async crear(data: { nombre: string; descripcion: string; permisos: string[] }) {
    const nuevo = this.rolRepo.create(data);
    return this.rolRepo.save(nuevo);
  }
}