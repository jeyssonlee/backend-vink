import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Producto } from './producto.entity';
import { Empresa } from '../../../core/empresa/entities/empresa.entity';

@Entity('precios')
export class Precio {
  @PrimaryGeneratedColumn('uuid')
  id_precio: string;

  @Column()
  nombre_lista: string; 

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  valor: number;

  @Column({ default: 'USD' })
  moneda: string;

  @ManyToOne(() => Producto, (producto) => producto.precios)
  @JoinColumn({ name: 'id_producto' })
  producto: Producto;

  @Column({ type: 'uuid' })
  id_producto: string;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column({ type: 'uuid' })
  id_empresa: string;
}