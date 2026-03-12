import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empresa } from '../../core/empresa/entities/empresa.entity';

@Injectable()
export class TenantResolverService {
  constructor(
    @InjectRepository(Empresa)
    private readonly empresaRepo: Repository<Empresa>,
  ) {}

  /**
   * Dado un id_empresa (del JWT), devuelve el nombre del schema del tenant.
   * - Empresa con holding  → tenant_h{id_holding}
   * - Empresa sin holding  → tenant_e{id_empresa}
   */
  async resolverSchema(id_empresa: string): Promise<string> {
    const empresa = await this.empresaRepo.findOne({
      where: { id: id_empresa },
      select: ['id', 'id_holding'],
    });

    if (!empresa) {
      throw new NotFoundException(`Empresa ${id_empresa} no encontrada`);
    }

    if (empresa.id_holding) {
      return `tenant_h${empresa.id_holding}`;
    }

    return `tenant_e${empresa.id}`;
  }
}