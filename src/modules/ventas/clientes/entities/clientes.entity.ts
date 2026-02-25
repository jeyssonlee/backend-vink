import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Vendedor } from '../../vendedores/entities/vendedor.entity';
import { Empresa } from '../../../core/empresa/entities/empresa.entity';

export enum EstatusCliente {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  MOROSO = 'MOROSO'
}

export enum TipoPrecio {
  GRAN_MAYOR = 'GRAN_MAYOR',
  MAYOR = 'MAYOR',
  DETAL = 'DETAL' // Por defecto
}

@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn('uuid') 
  id_cliente: string; 

  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  rif: string; 

  @Column({ type: 'varchar', length: 255, nullable: false })
  razon_social: string; 

  @Column({ type: 'text', nullable: false })
  direccion_fiscal: string; 

  @Column({ type: 'text', nullable: true })
  direccion_entrega: string; 

  @Column({ type: 'varchar', length: 20, nullable: true })
  numero_telefonico: string; 

  @Column({ type: 'varchar', length: 100, nullable: true })
  ciudad: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  estado: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  pais: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  limite_credito_monto: number; // Tope máximo de deuda permitida

  @Column({ type: 'int', default: 0 })
  dias_credito_default: number; // Días base para calcular vencimientos

  @Column({ type: 'enum', enum: EstatusCliente, default: EstatusCliente.ACTIVO })
  estatus: EstatusCliente; // Para ponerle un "Badge" rojo a los morosos en la ficha

  @Column({ type: 'enum', enum: TipoPrecio, default: TipoPrecio.DETAL })
  tipo_precio: TipoPrecio; // Excelente para saber qué lista de precios aplicarle

  @CreateDateColumn()
  fecha_registro: Date;

  @UpdateDateColumn()
  fecha_actualizacion: Date;

  // --- RELACIONES ---

  @ManyToOne(() => Vendedor, (vendedor) => vendedor.clientes, { nullable: true }) // <--- Agrega nullable: true
  @JoinColumn({ name: 'id_vendedor' })
  vendedor: Vendedor;

  @Column({ type: 'uuid', nullable: true }) // <--- Agrega nullable: true
  id_vendedor: string;

  // NUEVO: Aislamiento Multi-Empresa
  @ManyToOne(() => Empresa) // Si quieres relación inversa, agrégala en empresa.entity.ts
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column({ type: 'uuid' })
  id_empresa: string;
}