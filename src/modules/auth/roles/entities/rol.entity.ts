import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Usuario } from 'src/modules/core/usuarios/entities/usuarios.entity';

@Entity('roles')
export class Rol {
  @PrimaryGeneratedColumn('uuid')
  id_rol: string;

  @Column({ unique: true })
  nombre: string; // Ej: 'SUPER_ADMIN', 'VENDEDOR'

  @Column({ nullable: true })
  descripcion: string;

  // Permisos simples: ['ver_ventas', 'crear_ventas', 'ver_reportes_ventas', ...]
  @Column('text', { array: true, default: [] })
  permisos: string[];

  // Relación inversa: Un Rol -> Muchos Usuarios
  @OneToMany(() => Usuario, (usuario) => usuario.rol)
  usuarios: Usuario[];

  @CreateDateColumn()
  created_at: Date;
}