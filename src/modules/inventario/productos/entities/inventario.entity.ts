import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, UpdateDateColumn, Unique } from 'typeorm';
import { Producto } from './producto.entity';
import { Almacen } from '../../almacenes/entities/almacen.entity';

@Entity('inventarios')
@Unique(['producto', 'almacen']) // Evita duplicados lógicos
export class Inventario {
  @PrimaryGeneratedColumn('uuid') // CAMBIO: UUID
  id_inventario: string;

  @Column({ type: 'int', default: 0 })
  cantidad: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  costo_unitario: number;

  // Relaciones corregidas a UUID
  @ManyToOne(() => Producto, (producto) => producto.inventarios)
  @JoinColumn({ name: 'id_producto' })
  producto: Producto;

  @Column({ type: 'uuid' })
  id_producto: string;

  @ManyToOne(() => Almacen)
  @JoinColumn({ name: 'id_almacen' })
  almacen: Almacen;

  @Column({ type: 'uuid' })
  id_almacen: string;

  @Column({ type: 'uuid' }) // CAMBIO: Asegurar tipo UUID
  id_empresa: string;

  @UpdateDateColumn({ type: 'timestamp', nullable: true }) 
  updated_at: Date;
}