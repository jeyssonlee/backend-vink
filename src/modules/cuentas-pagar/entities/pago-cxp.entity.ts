import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { CuentaPorPagar } from './cuenta-pagar.entity';

export enum MetodoPago {
  EFECTIVO       = 'EFECTIVO',
  TRANSFERENCIA  = 'TRANSFERENCIA',
  PAGO_MOVIL     = 'PAGO MOVIL',
  ZELLE          = 'ZELLE',
}

@Entity('pagos_cxp')
export class PagoCxP {
  @PrimaryGeneratedColumn('uuid')
  id_pago: string;

  @ManyToOne(() => CuentaPorPagar, (cuenta) => cuenta.pagos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cuenta' })
  cuenta: CuentaPorPagar;

  @Column({ type: 'uuid' })
  id_cuenta: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto: number;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  fecha_pago: Date;

  @Column({ type: 'enum', enum: MetodoPago, default: MetodoPago.TRANSFERENCIA })
  metodo_pago: MetodoPago;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referencia: string; // número de transferencia, cheque, etc.

  @Column({ type: 'text', nullable: true })
  observacion: string;

  @CreateDateColumn()
  created_at: Date;
}
