import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, UpdateDateColumn } from 'typeorm';
import { Cliente } from '../../clientes/entities/clientes.entity';
import { Empresa } from 'src/modules/core/empresa/entities/empresa.entity'; 
import { Usuario } from '../../../core/usuarios/entities/usuarios.entity';
import { FacturaDetalle } from './factura-detalle.entity';

export enum MetodoPago {
  EFECTIVO = 'EFECTIVO',
  PAGO_MOVIL = 'PAGO_MOVIL',
  TRANSFERENCIA = 'TRANSFERENCIA',
  ZELLE = 'ZELLE',
  PUNTO_VENTA = 'PUNTO_VENTA',
  CREDITO = 'CREDITO', 
  MIXTO = 'MIXTO',
  POR_DEFINIR = 'POR_DEFINIR' // Para borradores
}

export enum EstadoFactura {
  BORRADOR = 'BORRADOR',     // Guardada sin valor fiscal
  PENDIENTE = 'PENDIENTE',   // Crédito / Por Cobrar
  PAGADA = 'PAGADA',         // Cobrada y Cerrada
  ANULADA = 'ANULADA'        // Reversada
}

@Entity('facturas')
export class Factura {
  @PrimaryGeneratedColumn('uuid')
  id_factura: string;

  // --- CONTROL FISCAL ---
  @Column({ default: 'A' })
  serie: string; 

  @Column({ type: 'int', nullable: true }) 
  numero_consecutivo: number; // Solo existe si NO es borrador

  @Column({ nullable: true })
  numero_control: string; // Nro de imprenta (Venezuela)

  // --- DATOS ECONÓMICOS ---
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  subtotal_base: number; 

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  descuento_global_monto: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  monto_iva: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  total_pagar: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  tasa_cambio: number; // Snapshot del dólar al momento

  // --- KPI / PROFIT (Inteligencia de Negocios) ---
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  total_costo: number; // Suma de costos históricos

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  total_ganancia: number; // La utilidad neta real

  // --- ESTADOS Y TIEMPOS ---
  @Column({ type: 'enum', enum: MetodoPago, default: MetodoPago.POR_DEFINIR })
  metodo_pago: MetodoPago;

  @Column({ type: 'enum', enum: EstadoFactura, default: EstadoFactura.BORRADOR }) 
  estado: EstadoFactura;

  @Column({ type: 'int', default: 0 })
  dias_credito: number;

  @Column({ nullable: true })
  fecha_vencimiento: Date;

  @Column({ nullable: true })
  id_pedido_origen: string; 

  @CreateDateColumn()
  fecha_emision: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // --- RELACIONES ---
  @OneToMany(() => FacturaDetalle, (detalle) => detalle.factura, { cascade: true })
  detalles: FacturaDetalle[];

  @ManyToOne(() => Cliente, { nullable: true })
  @JoinColumn({ name: 'id_cliente' })
  cliente: Cliente;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_vendedor' })
  vendedor: Usuario; 
  
  // 🪄 Getter Virtual
  get numero_completo(): string {
    if (this.estado === EstadoFactura.BORRADOR || !this.numero_consecutivo) {
        return 'BORRADOR';
    }
    return `${this.serie}-${String(this.numero_consecutivo).padStart(6, '0')}`;
  }
}