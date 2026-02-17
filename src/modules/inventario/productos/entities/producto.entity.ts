import { Entity, Column, PrimaryGeneratedColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Inventario } from './inventario.entity';
import { Precio } from './precio.entity';
import { Empresa } from '../../../core/empresa/entities/empresa.entity';

@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn('uuid') // CAMBIO: ID interno seguro
  id_producto: string; 

  @Column({ unique: true }) // El código manual del usuario ahora es un campo normal
  codigo: string;

  @Column()
  nombre: string;

  @Column({ unique: true, nullable: true })
  codigo_barras: string;

  @Column({ nullable: true })
  marca: string;

  @Column({ nullable: true })
  rubro: string;

  @Column({ nullable: true })
  categoria: string;

  @Column({ nullable: true })
  proveedor: string;

  @Column({ type: 'text', nullable: true })
  imagen: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @OneToMany(() => Inventario, (inventario) => inventario.producto)
  inventarios: Inventario[];

  @OneToMany(() => Precio, (precio) => precio.producto) // Faltaba esta relación
  precios: Precio[];

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  precio_base: number;

  // REGLA: El catálogo base pertenece a la empresa
  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column({ type: 'uuid' })
  id_empresa: string;
}