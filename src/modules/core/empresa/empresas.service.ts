import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empresa } from './entities/empresa.entity';
// Importa tus DTOs si los tienes, o usa Partial<Empresa> temporalmente

@Injectable()
export class EmpresasService {
  constructor(
    @InjectRepository(Empresa)
    private readonly empresaRepo: Repository<Empresa>,
  ) {}

  async create(data: Partial<Empresa>) {
    const nueva = this.empresaRepo.create(data);
    return await this.empresaRepo.save(nueva);
  }

  async findAll() {
    return await this.empresaRepo.find({ relations: ['vendedores', 'usuarios'] });
  }

  // ❌ ANTES: async findOne(id: number)
  // ✅ AHORA:
  async findOne(id: string) { 
    const empresa = await this.empresaRepo.findOne({ 
      where: { id: id }, // Ahora sí coinciden (String con String)
      relations: ['vendedores', 'usuarios']
    });
    
    if (!empresa) throw new NotFoundException(`Empresa con ID ${id} no encontrada`);
    return empresa;
  }

  // ❌ ANTES: async update(id: number, ...)
  // ✅ AHORA:
  async update(id: string, data: Partial<Empresa>) {
    const empresa = await this.findOne(id); // Reutilizamos findOne que ya verifica existencia
    this.empresaRepo.merge(empresa, data);
    return await this.empresaRepo.save(empresa);
  }

  // ❌ ANTES: async remove(id: number)
  // ✅ AHORA:
  async remove(id: string) {
    const empresa = await this.findOne(id);
    await this.empresaRepo.remove(empresa);
    return { message: 'Empresa eliminada correctamente' };
  }
}