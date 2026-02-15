import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendedor } from './entities/vendedor.entity';
import { CreateVendedorDto } from './dto/create-vendedor.dto';
import * as bcrypt from 'bcrypt'; 

@Injectable()
export class VendedoresService {
  constructor(
    @InjectRepository(Vendedor)
    private readonly vendedorRepo: Repository<Vendedor>,
  ) {}

  // 1. Crear
  async crear(data: CreateVendedorDto): Promise<Vendedor> {
    try {
      // Hasheamos la contraseña antes de crear la instancia
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(data.contrasena, salt);

      const nuevoVendedor = this.vendedorRepo.create({
        ...data,
        contrasena: hashedPassword,
      });

      return await this.vendedorRepo.save(nuevoVendedor);
    } catch (error) {
      // Postgres error 23505 = Unique Violation
      if (error.code === '23505') {
        throw new ConflictException('La cédula o el usuario ya existen en el sistema.');
      }
      throw error;
    }
  }

  // 2. Obtener Todos
  async obtenerTodos(idEmpresa?: string): Promise<Vendedor[]> {
    const whereCondition = idEmpresa ? { id_empresa: idEmpresa } : {};
    
    return await this.vendedorRepo.find({
      where: whereCondition, // <--- Filtro de seguridad
      relations: ['empresa'],
      select: [
        'id_vendedor', 
        'nombre_apellido', 
        'cedula',        // <--- AGREGADO: Vital para la tabla
        'usuario', 
        'ciudad', 
        'telefono', 
        'id_empresa'
      ] 
    });
  }

  // 3. Obtener Uno (UUID)
  async obtenerUno(id: string): Promise<Vendedor> {
    const vendedor = await this.vendedorRepo.findOne({ 
      where: { id_vendedor: id } 
    });
    
    if (!vendedor) {
      throw new NotFoundException(`Vendedor con ID ${id} no encontrado`);
    }
    return vendedor;
  }

  // 4. Actualizar
  async actualizar(id: string, data: Partial<CreateVendedorDto>): Promise<Vendedor> {
    const vendedor = await this.obtenerUno(id); // Verifica existencia

    if (data.contrasena) {
      const salt = await bcrypt.genSalt(10);
      data.contrasena = await bcrypt.hash(data.contrasena, salt);
    }

    // Fusionamos los datos nuevos con los existentes
    const actualizado = this.vendedorRepo.merge(vendedor, data);
    return await this.vendedorRepo.save(actualizado);
  }

  // 5. Eliminar
  async eliminar(id: string): Promise<{ mensaje: string }> {
    const vendedor = await this.obtenerUno(id);
    await this.vendedorRepo.remove(vendedor);
    return { mensaje: `Vendedor ${vendedor.nombre_apellido} eliminado con éxito` };
  }
}