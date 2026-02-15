import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, JoinColumn, ManyToOne } from 'typeorm';
import { Vendedor } from 'src/modules/ventas/vendedores/entities/vendedor.entity';
import { Usuario } from '../../usuarios/entities/usuarios.entity';
import { Sucursal } from '../../sucursal/entities/sucursal.entity';
import { Holding } from '../../holding/entities/holding.entity';

@Entity('empresas')
export class Empresa {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true, nullable: false })
  rif: string;

  @Column({ nullable: false })
  razon_social: string;

  @Column({ nullable: false })
  direccion: string;

  @Column({ nullable: false })
  telefono: string;

  // Relación: Una empresa tiene muchos vendedores
  @OneToMany(() => Vendedor, (vendedor) => vendedor.empresa)
  vendedores: Vendedor[];

  // Relación: Una empresa tiene muchos usuarios
  @OneToMany(() => Usuario, (usuario) => usuario.empresa)
  usuarios: Usuario[];

  // --- RELACIÓN CON HOLDING (NUEVO) ---
  @ManyToOne(() => Holding, (holding) => holding.empresas, { nullable: true }) // Nullable al principio para no romper datos viejos
  @JoinColumn({ name: 'id_holding' })
  holding: Holding;

  @Column({ type: 'uuid', nullable: true })
  id_holding: string;

  // --- RELACIÓN CON SUCURSALES (NUEVO) ---
  @OneToMany(() => Sucursal, (sucursal) => sucursal.empresa)
  sucursales: Sucursal[];

  @Column({ default: true })
  activa: boolean;

  @CreateDateColumn()
  created_at: Date;

}