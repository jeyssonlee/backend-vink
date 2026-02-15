import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { Empresa } from '../../empresa/entities/empresa.entity';
import { Almacen } from 'src/modules/inventario/almacenes/entities/almacen.entity';

@Entity('sucursales')
export class Sucursal {
  @PrimaryGeneratedColumn('uuid')
  id_sucursal: string;

  @Column()
  nombre: string; // Ej: "Sede Centro"

  @Column({ nullable: true })
  direccion: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ default: true })
  es_matriz: boolean; // Para identificar la sede principal

  // Una Sucursal pertenece a UNA Empresa
  @ManyToOne(() => Empresa, (empresa) => empresa.sucursales)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column({ type: 'uuid' })
  id_empresa: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Almacen, (almacen) => almacen.sucursal)
  almacenes: Almacen[];
}