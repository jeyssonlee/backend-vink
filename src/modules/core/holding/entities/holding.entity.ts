import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Empresa } from '../../empresa/entities/empresa.entity';

@Entity('holdings')
export class Holding {
  @PrimaryGeneratedColumn('uuid')
  id_holding: string;

  @Column({ unique: true })
  nombre: string;

  @Column({ nullable: true })
  descripcion: string;

  // Un Holding tiene muchas Empresas
  @OneToMany(() => Empresa, (empresa) => empresa.holding)
  empresas: Empresa[];

  @CreateDateColumn()
  created_at: Date;
}