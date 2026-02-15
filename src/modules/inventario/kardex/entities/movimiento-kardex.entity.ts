import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Producto } from '../../productos/entities/producto.entity';
import { Almacen } from '../../almacenes/entities/almacen.entity';
import { Usuario } from '../../../core/usuarios/entities/usuarios.entity'; // Ajusta ruta según tu estructura
import { Empresa } from 'src/modules/core/empresa/entities/empresa.entity';

export enum TipoMovimiento {
  COMPRA = 'COMPRA',
  VENTA = 'VENTA',
  APARTADO = 'APARTADO',        // Reserva (Logística)
  LIBERACION = 'LIBERACION',    // Cancelar reserva
  AJUSTE_POS = 'AJUSTE_POS',    // Sobrante
  AJUSTE_NEG = 'AJUSTE_NEG',    // Faltante/Robo/Merma
  TRASLADO_SALIDA = 'TRASLADO_OUT',
  TRASLADO_ENTRADA = 'TRASLADO_IN'
}

@Entity('kardex_movimientos')
export class MovimientoKardex {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  fecha: Date;

  @Column({ type: 'enum', enum: TipoMovimiento })
  tipo: TipoMovimiento;

  // Cantidad que se movió (positiva o negativa según lógica, pero aquí guardamos magnitud)
  @Column('decimal', { precision: 12, scale: 3 })
  cantidad: number;

  // Costo en el momento exacto de la operación
  @Column('decimal', { precision: 12, scale: 2 })
  costo_unitario: number;

  // Stock que había ANTES de mover
  @Column('decimal', { precision: 12, scale: 3 })
  stock_inicial: number;

  // Stock que quedó DESPUÉS de mover
  @Column('decimal', { precision: 12, scale: 3 })
  stock_final: number;

  @Column({ nullable: true })
  referencia: string; // ID de Compra, Pedido o Nota de Entrega

  @Column({ nullable: true })
  observacion: string;

  // --- Relaciones ---

  @ManyToOne(() => Producto)
  @JoinColumn({ name: 'id_producto' })
  producto: Producto;

  @Column('uuid')
  id_producto: string;

  @ManyToOne(() => Almacen)
  @JoinColumn({ name: 'id_almacen' })
  almacen: Almacen;

  @Column('uuid')
  id_almacen: string;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @Column('uuid')
  id_empresa: string;

  @ManyToOne(() => Usuario, { nullable: true }) // Quién hizo el movimiento
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
  
  @Column({ name: 'id_usuario', nullable: true })
  id_usuario_responsable: string;
}