import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { Proveedor } from './entities/proveedor.entity';

@Injectable()
export class ProveedoresService {
  private readonly logger = new Logger(ProveedoresService.name);

  constructor(
    @InjectRepository(Proveedor)
    private readonly proveedorRepo: Repository<Proveedor>,
  ) {}

  async create(createProveedorDto: CreateProveedorDto) {
    try {
      // Creamos usando el DTO que ya trae id_empresa
      const nuevoProveedor = this.proveedorRepo.create(createProveedorDto);
      await this.proveedorRepo.save(nuevoProveedor);
      this.logger.log(`Proveedor creado: ${nuevoProveedor.nombre_empresa}`);
      return nuevoProveedor;
    } catch (error) {
      // Manejo de error para la restricción única compuesta
      if (error.code === '23505') {
        throw new BadRequestException('Ya existe un proveedor con este nombre en tu empresa.');
      }
      throw error;
    }
  }

  // ✅ CORRECCIÓN: Pedimos idEmpresa para no mostrar proveedores ajenos
  async findAll(idEmpresa: string) {
    return this.proveedorRepo.find({ 
      where: { 
        activo: true,
        id_empresa: idEmpresa // Filtro de seguridad
      },
      order: { nombre_empresa: 'ASC' }
    });
  }

  async findOne(id: string) {
    const proveedor = await this.proveedorRepo.findOneBy({ id_proveedor: id });
    if (!proveedor) throw new NotFoundException(`Proveedor con ID ${id} no encontrado`);
    return proveedor;
  }

  async update(id: string, updateProveedorDto: UpdateProveedorDto) {
    const proveedor = await this.findOne(id); // Primero verificamos existencia
    this.proveedorRepo.merge(proveedor, updateProveedorDto);
    return this.proveedorRepo.save(proveedor);
  }

  async remove(id: string) {
    const proveedor = await this.findOne(id);
    proveedor.activo = false; // Soft Delete
    await this.proveedorRepo.save(proveedor);
    return { message: `Proveedor ${proveedor.nombre_empresa} desactivado correctamente.` };
  }
}