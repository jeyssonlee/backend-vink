import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Empresa } from '../../../core/empresa/entities/empresa.entity';
import { Sucursal } from '../../../core/sucursal/entities/sucursal.entity';

@Entity('almacenes')
export class Almacen {
  @PrimaryGeneratedColumn('uuid')
  id_almacen: string;

  // CORRECCIÓN 1: Estandarizamos a 'nombre' para que coincida con el resto del sistema
  @Column()
  nombre: string; 

  @Column({ default: true })
  es_venta: boolean;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column({ type: 'uuid' })
  id_empresa: string;

  // CORRECCIÓN 2: Agregamos la Sucursal. Sin esto, un almacén "flota" en el aire.
  @ManyToOne(() => Sucursal, { nullable: true }) 
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Sucursal;

  @Column({ type: 'uuid', nullable: true })
  id_sucursal: string;
}