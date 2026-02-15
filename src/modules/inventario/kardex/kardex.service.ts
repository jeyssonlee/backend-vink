import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm'; // 👈 Importamos QueryRunner
import { MovimientoKardex } from './entities/movimiento-kardex.entity';
import { RegistrarMovimientoDto } from './dto/registrar-movimiento.dto';

@Injectable()
export class KardexService {
  private readonly logger = new Logger(KardexService.name);

  constructor(
    @InjectRepository(MovimientoKardex)
    private readonly repo: Repository<MovimientoKardex>,
  ) {}

  // 👇 Aceptamos queryRunner opcional (?)
  async registrar(dto: RegistrarMovimientoDto, queryRunner?: QueryRunner) {
    try {
      const mov = this.repo.create(dto);

      if (queryRunner) {
        // ✅ Si hay transacción, nos unimos a ella
        await queryRunner.manager.save(mov);
      } else {
        // 🏃 Si no, guardamos normal
        await this.repo.save(mov);
      }
      
      this.logger.log(`📝 Kardex: ${dto.tipo} Prod: ${dto.id_producto} | Cant: ${dto.cantidad}`);
    } catch (error) {
      this.logger.error('❌ Error registrando Kardex', error);
      throw error; 
    }
  }

  async obtenerHistorialProducto(idProducto: string, idEmpresa: string) {
    return await this.repo.find({
      where: { id_producto: idProducto, id_empresa: idEmpresa },
      order: { fecha: 'DESC' },
      relations: ['almacen', 'usuario']
    });
  }

  async obtenerUltimosMovimientos(idEmpresa: string) {
    return await this.repo.find({
      where: { id_empresa: idEmpresa },
      order: { fecha: 'DESC' },
      take: 100, // Trae los últimos 100
      relations: ['producto', 'almacen', 'usuario'] 
    });
  }
}