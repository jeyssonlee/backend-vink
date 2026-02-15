import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Pedido } from './pedido.entity';
import { Producto } from '../../../inventario/productos/entities/producto.entity';

@Entity('pedido_detalles')
export class PedidoDetalle {
  @PrimaryGeneratedColumn('uuid') // CAMBIO: UUID
  id_detalle: string;

  @ManyToOne(() => Pedido, (pedido) => pedido.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_pedido' })
  pedido: Pedido;

  @Column({ type: 'uuid' })
  id_pedido: string;

  @ManyToOne(() => Producto)
  @JoinColumn({ name: 'id_producto' })
  producto: Producto;

  @Column({ type: 'uuid' }) // Antes era Varchar, ahora es UUID
  id_producto: string;

  @Column({ type: 'int' })
  cantidad: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  precio_unitario: number;
}