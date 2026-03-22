import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable,
} from 'typeorm';
import { Empresa } from '../../empresa/entities/empresa.entity';
import { Sucursal } from '../../sucursal/entities/sucursal.entity';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { Holding } from '../../holding/entities/holding.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  nombre_completo: string;

  @Column({ type: 'varchar', unique: true })
  correo: string;

  @Column({ type: 'varchar', select: false })
  clave: string;

  @ManyToOne(() => Rol, (rol) => rol.usuarios)
  @JoinColumn({ name: 'id_rol' })
  rol: Rol;

  @Column({ type: 'uuid', nullable: true })
  id_rol: string;

  // ── Empresa principal (puede ser null para admins de holding) ──
  @ManyToOne(() => Empresa, (empresa) => empresa.usuarios, { nullable: true })
  @JoinColumn({ name: 'id_empresa' })
  empresa?: Empresa;

  @Column({ type: 'uuid', nullable: true })
  id_empresa?: string;

  // ── Holding al que pertenece el usuario ───────────────────────
  @ManyToOne(() => Holding, { nullable: true })
  @JoinColumn({ name: 'id_holding', referencedColumnName: 'id_holding' })
  holding?: Holding;

  @Column({ type: 'uuid', nullable: true })
  id_holding?: string;

  // ── Empresas con acceso explícito (multi-empresa) ─────────────
  @ManyToMany(() => Empresa, { eager: false })
  @JoinTable({
    name: 'usuario_empresas',
    joinColumn: { name: 'id_usuario', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'id_empresa', referencedColumnName: 'id' },
  })
  empresas_permitidas?: Empresa[];

  // ── Sucursal ──────────────────────────────────────────────────
  @ManyToOne(() => Sucursal, { nullable: true })
  @JoinColumn({ name: 'id_sucursal' })
  sucursal?: Sucursal;

  @Column({ type: 'uuid', nullable: true })
  id_sucursal?: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fecha_actualizacion: Date;
}