import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, CreateDateColumn, JoinColumn } from 'typeorm';
import { Cliente } from '../../clientes/entities/clientes.entity';
import { Vendedor } from '../../vendedores/entities/vendedor.entity';
import { Empresa } from '../../../core/empresa/entities/empresa.entity';
import { PedidoDetalle } from './pedido-detalle.entity';

/**
 * Estados del ciclo de vida de un pedido:
 *
 * Web:  BORRADOR → ENVIADO → REVISADO → FACTURADO
 *                          → RECHAZADO → (vendedor corrige) → ENVIADO
 * App:  llega directo como ENVIADO (sin BORRADOR)
 * Compat: APARTADO = equivalente a ENVIADO (legado app móvil)
 *         COMPLETADO / ANULADO = estados finales legados
 */
export const ESTADOS_EDITABLES = ['BORRADOR', 'ENVIADO', 'REVISADO', 'RECHAZADO'];
export const ESTADOS_CON_STOCK  = ['ENVIADO', 'REVISADO', 'APARTADO'];

@Entity('pedidos')
export class Pedido {
  @PrimaryGeneratedColumn('uuid')
  id_pedido: string;

  @Column({ unique: true, nullable: true })
  id_pedido_local: string;

  @Column({ nullable: true })
  numero_pedido: string;

  @CreateDateColumn()
  fecha: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total: number;

  /**
   * Valores válidos: BORRADOR | ENVIADO | REVISADO | RECHAZADO | FACTURADO | ANULADO
   * Legado (app móvil): APARTADO | COMPLETADO
   */
  @Column({ default: 'BORRADOR' })
  estado: string;

  @Column({ type: 'text', nullable: true })
  nota: string | null;

  @Column({ type: 'text', nullable: true })
  nota_rechazo: string | null;

  @Column({ type: 'varchar', nullable: true })
  revisado_por: string | null;

  @Column({ type: 'timestamp', nullable: true })
  fecha_revision: Date | null;

  @Column({ default: 'CREDITO' })
  metodo_pago: string;

  @Column({ type: 'int', default: 15 })
  dias_credito: number;

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