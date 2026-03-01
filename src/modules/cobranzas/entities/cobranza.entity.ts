import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { CobranzaMetodo } from './cobranza-metodo.entity';
import { CobranzaFactura } from './cobranza-factura.entity';
import { Usuario } from '../../core/usuarios/entities/usuarios.entity';
import { Empresa } from '../../core/empresa/entities/empresa.entity';
import { Cliente } from 'src/modules/ventas/clientes/entities/clientes.entity';
import { Vendedor } from 'src/modules/ventas/vendedores/entities/vendedor.entity';

export enum EstadoCobranza {
  POR_CONCILIAR = 'POR_CONCILIAR',
  APLICADA = 'APLICADA',
  RECHAZADA = 'RECHAZADA',
  ANULADA = 'ANULADA'
}

@Entity('cobranzas')
export class Cobranza {
  @PrimaryGeneratedColumn('uuid')
  id_cobranza: string;

  @Column({ unique: true }) 
  consecutivo: string; 

  @Column({ type: 'date' })
  fecha_reporte: Date;

  @Column({ nullable: true })
  url_comprobante: string; 

  @Column('decimal', { precision: 12, scale: 2 })
  monto_total: number;

  @Column({ nullable: true })
  nota_vendedor: string;

  @Column({ nullable: true })
  nota_admin: string; 

  // 👇 AGREGADO: Campo Origen (Faltaba en tu archivo)
  @Column({ default: 'APP' })
  origen: string;

  @Column({ type: 'enum', enum: EstadoCobranza, default: EstadoCobranza.POR_CONCILIAR })
  estado: EstadoCobranza;

  // 👇 AGREGADO: Relación Cliente (Faltaba en tu archivo)
  @ManyToOne(() => Cliente)
  @JoinColumn({ name: 'id_cliente' })
  cliente: Cliente;

  @ManyToOne(() => Vendedor)
  @JoinColumn({ name: 'id_vendedor' })
  vendedor: Vendedor;
  
  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'id_aprobador' })
  aprobador: Usuario; 

  @Column({ nullable: true })
  fecha_aprobacion: Date;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  @OneToMany(() => CobranzaMetodo, cm => cm.cobranza, { cascade: true })
  metodos: CobranzaMetodo[];

  @OneToMany(() => CobranzaFactura, cf => cf.cobranza, { cascade: true })
  facturas_afectadas: CobranzaFactura[];

  @CreateDateColumn()
  created_at: Date;
}