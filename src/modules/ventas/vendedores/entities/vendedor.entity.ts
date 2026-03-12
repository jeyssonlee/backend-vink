import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Empresa } from 'src/modules/core/empresa/entities/empresa.entity';
import { Cliente } from '../../clientes/entities/clientes.entity'; 

@Entity('vendedores')
export class Vendedor {
  @PrimaryGeneratedColumn('uuid')
  id_vendedor: string;

  @Column({ type: 'varchar', nullable: false, unique: true })
  cedula: string; 

  @Column({ nullable: false })
  nombre_apellido: string; 

  @Column({ nullable: false })
  telefono: string; 

  @Column({ nullable: false })
  ciudad: string; 

  @Column({ nullable: true }) 
  estado: string;

  @Column({ nullable: true })
  pais: string;

  // --- CREDENCIALES ---
  @Column({ unique: true, nullable: false })
  usuario: string;

  // select: false evita que la contraseña viaje en consultas normales
  @Column({ select: false, nullable: false })
  contrasena: string;

  // --- JERARQUÍA MULTI-EMPRESA ---
  @ManyToOne(() => Empresa, (empresa) => empresa.vendedores)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column({ type: 'uuid' }) 
  id_empresa: string; 

  @OneToMany(() => Cliente, (cliente) => cliente.vendedor)
  clientes: Cliente[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'uuid', nullable: true })
  id_usuario: string;
}