import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Empresa } from '../../empresa/entities/empresa.entity'; 
import { Sucursal } from '../../sucursal/entities/sucursal.entity';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  nombre_completo: string;

  @Column({ type: 'varchar', unique: true })
  correo: string;

  // Select: false para seguridad, alineado con "Seguridad por Diseño"
  @Column({ type: 'varchar', select: false }) 
  clave: string; 

  @ManyToOne(() => Rol, (rol) => rol.usuarios)
  @JoinColumn({ name: 'id_rol' })
  rol: Rol;

  @Column({ type: 'uuid', nullable: true })
  id_rol: string;

  // REGLA: Aislamiento Multi-Empresa 
  @ManyToOne(() => Empresa, (empresa) => empresa.usuarios)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column({ type: 'uuid' }) 
  id_empresa: string;

 // SUCURSAL

  @ManyToOne(() => Sucursal)
  @JoinColumn({ name: 'id_sucursal' })
  sucursal: Sucursal;

  @Column({ type: 'uuid', nullable: true })
  id_sucursal: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fecha_actualizacion: Date;
}