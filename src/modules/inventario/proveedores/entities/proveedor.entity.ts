import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Compra } from '../../compras/entities/compra.entity';
import { Empresa } from 'src/modules/core/empresa/entities/empresa.entity';// Ajusta la ruta si es necesario

@Entity('proveedores')
@Unique(['nombre_empresa', 'id_empresa']) // ✅ REGLA: Nombre único solo por empresa
export class Proveedor {
  @PrimaryGeneratedColumn('uuid')
  id_proveedor: string;

  @Column('text') // Quitamos el unique: true de aquí
  nombre_empresa: string;

  @Column('text', { nullable: true })
  rif: string; 

  @Column('text', { nullable: true })
  direccion: string;

  @Column('text', { nullable: true })
  nombre_vendedor: string;

  @Column('text', { nullable: true })
  telefono_contacto: string;

  @Column('text', { nullable: true })
  email_pedidos: string;

  @Column('int', { default: 0 })
  dias_credito: number;

  @Column('bool', { default: true })
  activo: boolean;

  // Relación con Empresa (Obligatoria)
  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column({ type: 'uuid' })
  id_empresa: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Compra, (compra) => compra.proveedor)
  compras: Compra[];
}