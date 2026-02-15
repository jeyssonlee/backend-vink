import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Compra } from './compra.entity';
import { Producto } from '../../productos/entities/producto.entity';

@Entity('compras_detalles')
export class CompraDetalle {
  @PrimaryGeneratedColumn('uuid')
  id_detalle: string;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  costo_unitario: number; 

  @ManyToOne(() => Compra, (compra) => compra.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_compra' })
  compra: Compra;

  @Column({ type: 'uuid' }) // Agregado
  id_compra: string;

  @ManyToOne(() => Producto, { eager: false }) 
  @JoinColumn({ name: 'id_producto' })
  producto: Producto;

  @Column({ type: 'uuid' }) // Agregado
  id_producto: string;

  @Column({ type: 'uuid' })
  id_almacen: string;
}