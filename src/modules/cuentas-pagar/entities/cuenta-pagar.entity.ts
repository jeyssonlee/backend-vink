import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Compra } from '../../inventario/compras/entities/compra.entity';
import { Proveedor } from '../../inventario/proveedores/entities/proveedor.entity';
import { Empresa } from '../../core/empresa/entities/empresa.entity';
import { PagoCxP } from './pago-cxp.entity';

export enum EstadoCxP {
  PENDIENTE = 'PENDIENTE',
  PARCIAL   = 'PARCIAL',
  PAGADA    = 'PAGADA',
  ANULADA   = 'ANULADA',
}

@Entity('cuentas_pagar')
export class CuentaPorPagar {
  @PrimaryGeneratedColumn('uuid')
  id_cuenta: string;

  // ── Relación con la compra que la originó ──────────────────────────────────
  @ManyToOne(() => Compra, { nullable: true })
  @JoinColumn({ name: 'id_compra' })
  compra: Compra;

  @Column({ type: 'uuid', nullable: true })
  id_compra: string;

  // ── Proveedor ──────────────────────────────────────────────────────────────
  @ManyToOne(() => Proveedor)
  @JoinColumn({ name: 'id_proveedor' })
  proveedor: Proveedor;

  @Column({ type: 'uuid' })
  id_proveedor: string;

  // ── Empresa ────────────────────────────────────────────────────────────────
  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column({ type: 'uuid' })
  id_empresa: string;

  // ── Montos ─────────────────────────────────────────────────────────────────
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto_original: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  monto_pagado: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  saldo_pendiente: number;

  // ── Metadata ───────────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 100, nullable: true })
  num_factura: string; // copia del num_factura de la compra para búsqueda rápida

  @Column({ type: 'date', nullable: true })
  fecha_vencimiento: Date; // calculado con dias_credito del proveedor

  @Column({ type: 'enum', enum: EstadoCxP, default: EstadoCxP.PENDIENTE })
  estado: EstadoCxP;

  @Column({ type: 'text', nullable: true })
  observacion: string;

  // ── Pagos aplicados ────────────────────────────────────────────────────────
  @OneToMany(() => PagoCxP, (pago) => pago.cuenta, { cascade: true })
  pagos: PagoCxP[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
