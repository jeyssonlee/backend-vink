import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Empresa } from '../../empresa/entities/empresa.entity';

export enum TipoImpuesto {
  IVA  = 'IVA',
  ISLR = 'ISLR',
  IGTF = 'IGTF',
}

@Entity('configuracion_impuestos')
export class ConfiguracionImpuesto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TipoImpuesto })
  tipo: TipoImpuesto;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column('decimal', { precision: 5, scale: 2 })
  porcentaje: number;

  @Column({ default: true })
  activo: boolean;

  @Column({ type: 'date', nullable: true })
  fecha_vigencia: Date;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column({ type: 'uuid' })
  id_empresa: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}