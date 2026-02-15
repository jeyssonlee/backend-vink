import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from './entities/clientes.entity';
import { CreateClienteDto } from './dto/create-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
  ) {}

  // 1. Crear o Buscar (Lógica de Sync)
  async buscarOCrear(datos: CreateClienteDto): Promise<Cliente> {
    // Buscamos por RIF
    let cliente = await this.clienteRepo.findOne({
      where: { rif: datos.rif }
    });

    if (!cliente) {
      // Si no existe, creamos
      const nuevoCliente = this.clienteRepo.create(datos);
      cliente = await this.clienteRepo.save(nuevoCliente);
      console.log(`✅ Nuevo cliente registrado: ${cliente.razon_social}`);
    } else {
      console.log(`ℹ️ Cliente ya existente (RIF: ${datos.rif})`);
    }

    return cliente;
  }

 // 2. Crear Directo (Corregido mapeo telefono)
 async crear(data: CreateClienteDto): Promise<Cliente> {
  const nuevo = this.clienteRepo.create({
    ...data,
    numero_telefonico: data.telefono, // Mapeamos DTO -> Entity
  });
  return await this.clienteRepo.save(nuevo);
}

// 3. Obtener Todos (Filtrado por empresa)
async obtenerTodos(idEmpresa: string): Promise<Cliente[]> {
  return await this.clienteRepo.find({
    where: { id_empresa: idEmpresa }, // <--- Filtro de seguridad
    relations: ['vendedor']
  });
}

  // 4. Obtener Uno (Por UUID)
  async obtenerUno(id: string): Promise<Cliente> { // CAMBIO: id es string
    const cliente = await this.clienteRepo.findOne({ 
      where: { id_cliente: id },
      relations: ['vendedor'] 
    });
  
    if (!cliente) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }
  
    return cliente;
  }

  // 5. Actualizar
  async actualizar(id: string, data: Partial<CreateClienteDto>) {
    const cliente = await this.obtenerUno(id); // Verifica que exista
    const actualizado = Object.assign(cliente, data);
    return await this.clienteRepo.save(actualizado);
  }

  // 6. Eliminar
  async eliminar(id: string) {
    const resultado = await this.clienteRepo.delete(id);
    if (resultado.affected === 0) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado para eliminar`);
    }
    return { mensaje: 'Cliente eliminado correctamente' };
  }
}