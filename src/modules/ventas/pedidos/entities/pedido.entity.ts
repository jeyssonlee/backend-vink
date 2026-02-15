import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, CreateDateColumn, JoinColumn } from 'typeorm';
import { Cliente } from '../../clientes/entities/clientes.entity';
import { Vendedor } from '../../vendedores/entities/vendedor.entity';
import { Empresa } from '../../../core/empresa/entities/empresa.entity';
import { PedidoDetalle } from './pedido-detalle.entity';

@Entity('pedidos')
export class Pedido {
  @PrimaryGeneratedColumn('uuid') // CAMBIO: UUID
  id_pedido: string;

  @Column({ unique: true, nullable: true })
  id_pedido_local: string; 

  @CreateDateColumn()
  fecha: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total: number;

  @Column({ default: 'APARTADO' }) 
  estado: string;

  // RELACIONES UUID
  @ManyToOne(() => Cliente)
  @JoinColumn({ name: 'id_cliente' })
  cliente: Cliente;

  @Column({ type: 'uuid' })
  id_cliente: string;

  @ManyToOne(() => Vendedor)
  @JoinColumn({ name: 'id_vendedor' })
  vendedor: Vendedor;

  @Column({ type: 'uuid' })
  id_vendedor: string;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column({ type: 'uuid' })
  id_empresa: string;

  @OneToMany(() => PedidoDetalle, (detalle) => detalle.pedido, { cascade: true })
  detalles: PedidoDetalle[];
}