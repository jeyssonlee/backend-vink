import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Cobranza } from './cobranza.entity';
import { Factura } from '../../ventas/facturas/entities/factura.entity'; // ⚠️ Ajusta ruta

@Entity('cobranza_facturas')
export class CobranzaFactura {
  @PrimaryGeneratedColumn('uuid')
  id_detalle: string;

  @ManyToOne(() => Cobranza, c => c.facturas_afectadas)
  @JoinColumn({ name: 'id_cobranza' })
  cobranza: Cobranza;

  @ManyToOne(() => Factura, f => f.pagos_aplicados)
  @JoinColumn({ name: 'id_factura' })
  factura: Factura;

  @Column('decimal', { precision: 12, scale: 2 })
  monto_aplicado: number; // Cuánto se abonó a esta factura específica

  // 👇 AUDITORÍA: Foto de la deuda antes y después del pago
  @Column('decimal', { precision: 12, scale: 2 })
  saldo_anterior: number;

  @Column('decimal', { precision: 12, scale: 2 })
  saldo_nuevo: number;

  @CreateDateColumn()
  created_at: Date;
}