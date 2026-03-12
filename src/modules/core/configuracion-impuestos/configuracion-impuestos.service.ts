import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfiguracionImpuesto, TipoImpuesto } from './entities/configuracion-impuesto.entity';
import { UpdateImpuestoDto } from './dto/update-impuesto.dto';

// Valores por defecto Venezuela
const DEFAULTS_VE = [
  { tipo: TipoImpuesto.IVA,  nombre: 'Impuesto al Valor Agregado',          porcentaje: 16, activo: true },
  { tipo: TipoImpuesto.ISLR, nombre: 'Impuesto sobre la Renta',              porcentaje: 34, activo: false },
  { tipo: TipoImpuesto.IGTF, nombre: 'Impuesto a las Grandes Transacciones', porcentaje: 3,  activo: false },
];

@Injectable()
export class ConfiguracionImpuestosService {
  constructor(
    @InjectRepository(ConfiguracionImpuesto)
    private readonly repo: Repository<ConfiguracionImpuesto>,
  ) {}

  // Seed automático al crear empresa
  async seedEmpresa(idEmpresa: string) {
    const existentes = await this.repo.find({ where: { id_empresa: idEmpresa } });
    if (existentes.length > 0) return; // Ya tiene configuración

    const registros = DEFAULTS_VE.map(d =>
      this.repo.create({ ...d, id_empresa: idEmpresa })
    );
    await this.repo.save(registros);
  }

  async findAll(idEmpresa: string) {
    return this.repo.find({
      where: { id_empresa: idEmpresa },
      order: { tipo: 'ASC' },
    });
  }

  // Para uso interno en facturas (solo trae el % del IVA activo)
  async getIva(idEmpresa: string): Promise<number> {
    const iva = await this.repo.findOne({
      where: { id_empresa: idEmpresa, tipo: TipoImpuesto.IVA, activo: true },
    });
    return iva ? Number(iva.porcentaje) / 100 : 0.16; // fallback 16%
  }

  async update(id: string, idEmpresa: string, dto: UpdateImpuestoDto) {
    const impuesto = await this.repo.findOne({ where: { id, id_empresa: idEmpresa } });
    if (!impuesto) throw new NotFoundException('Impuesto no encontrado');

    Object.assign(impuesto, dto);
    return this.repo.save(impuesto);
  }
}