import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, UpdateDateColumn, JoinColumn, ManyToOne } from 'typeorm';
import { CompraDetalle } from './compra-detalle.entity';
import { Proveedor } from '../../proveedores/entities/proveedor.entity';
import { Empresa } from '../../../core/empresa/entities/empresa.entity';
import { Almacen } from 'src/modules/inventario/almacenes/entities/almacen.entity';

export enum FormaPago {
  CONTADO = 'CONTADO',
  CREDITO = 'CREDITO',
}

@Entity('compras')
export class Compra {
  @PrimaryGeneratedColumn('uuid')
  id_compra: string;

  @Column({ type: 'varchar', length: 50 })
  num_factura: string; 

  @ManyToOne(() => Proveedor, (proveedor) => proveedor.compras)
  @JoinColumn({ name: 'id_proveedor' }) 
  proveedor: Proveedor;

  @Column({ type: 'uuid' }) // Agregado explícito
  id_proveedor: string;

  // Agregamos Empresa para consistencia
  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column({ type: 'uuid' })
  id_empresa: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  fecha_compra: Date;

  @Column({
    type: 'enum',
    enum: FormaPago,
    default: FormaPago.CREDITO
  })
  forma_pago: FormaPago;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total: number;

  @Column({ default: 'ACTIVA' }) // Para manejar la anulación
  estado: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => CompraDetalle, (detalle) => detalle.compra, {
    cascade: true, 
  })
  detalles: CompraDetalle[];

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at: Date;

  @ManyToOne(() => Almacen)
  @JoinColumn({ name: 'id_almacen' })
  almacen: Almacen;

  @Column({ type: 'uuid' })
  id_almacen: string;
}