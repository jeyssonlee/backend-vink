import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Cobranza } from './cobranza.entity';
import { Empresa } from '../../core/empresa/entities/empresa.entity';

export enum MetodoPagoDetalle {
  EFECTIVO_USD = 'EFECTIVO_USD',
  EFECTIVO_BSD = 'EFECTIVO_BSD',
  ZELLE = 'ZELLE',
  PAGO_MOVIL = 'PAGO_MOVIL',
  TRANSFERENCIA = 'TRANSFERENCIA',
  PUNTO_VENTA = 'PUNTO_VENTA',
  BINANCE = 'BINANCE'
}

@Entity('cobranza_metodos')
// 👇 CANDADO DE SEGURIDAD 🔐
// No permite insertar la misma referencia del mismo banco en la misma empresa.
// "referencia IS NOT NULL" permite que el EFECTIVO (que no tiene ref) sí se repita.
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
  referencia: string; // Nro de operación bancaria

  @Column({ nullable: true })
  banco: string; // Banco emisor o receptor

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;
}