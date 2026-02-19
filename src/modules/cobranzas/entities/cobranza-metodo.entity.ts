import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Cobranza } from './cobranza.entity';
import { Empresa } from '../../core/empresa/entities/empresa.entity';
// 👇 Importamos desde el archivo común
import { MetodoPagoDetalle } from '../dto/cobranza.enums';

@Entity('cobranza_metodos')
@Index(['referencia', 'banco', 'empresa'], { unique: true, where: "referencia IS NOT NULL" }) 
export class CobranzaMetodo {
  @PrimaryGeneratedColumn('uuid')
  id_metodo: string;

  @ManyToOne(() => Cobranza, c => c.metodos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cobranza' })
  cobranza: Cobranza;

  @Column({ type: 'enum', enum: MetodoPagoDetalle })
  metodo: MetodoPagoDetalle;

  @Column('decimal', { precision: 12, scale: 2 })
  monto: number;

  @Column({ nullable: true })
  referencia: string;

  @Column({ nullable: true })
  banco: string;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;
}