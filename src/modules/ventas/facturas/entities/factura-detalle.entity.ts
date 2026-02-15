import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Factura } from './factura.entity';
import { Producto } from '../../../inventario/productos/entities/producto.entity'; // Ajusta la ruta

@Entity('facturas_detalles')
export class FacturaDetalle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Factura, (factura) => factura.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_factura' })
  factura: Factura;

  @ManyToOne(() => Producto, { nullable: true }) // Nullable por si se borra el producto físico, queda la data histórica
  @JoinColumn({ name: 'id_producto' })
  producto: Producto;

  // --- SNAPSHOTS (Foto del producto en el momento de la venta) ---
  @Column()
  nombre_producto: string;

  @Column()
  codigo_producto: string;

  // --- MÉTRICAS DE VENTA ---
  @Column('decimal', { precision: 12, scale: 3 })
  cantidad: number;

  @Column('decimal', { precision: 12, scale: 2 })
  precio_unitario: number; // Precio de lista al momento

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  descuento_monto: number; // Dinero descontado

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  descuento_porcentaje: number; // % aplicado

  @Column('decimal', { precision: 12, scale: 2 })
  total_linea: number; // (Precio - Descuento) * Cantidad

  // --- MÉTRICAS DE PROFIT (COSTOS) ---
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  costo_historico: number; // Costo Promedio Ponderado al instante de vender

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  ganancia_neta: number; // Profit real de esta línea
}