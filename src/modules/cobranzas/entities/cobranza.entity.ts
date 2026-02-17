import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { CobranzaMetodo } from './cobranza-metodo.entity';
import { CobranzaFactura } from './cobranza-factura.entity';
import { Usuario } from '../../core/usuarios/entities/usuarios.entity'; // Ajusta si tu ruta de Usuario es distinta
import { Empresa } from '../../core/empresa/entities/empresa.entity';

export enum EstadoCobranza {
  POR_CONCILIAR = 'POR_CONCILIAR', // Vendedor subió foto, Admin debe revisar
  APLICADA = 'APLICADA',           // Dinero en banco confirmado, deuda descontada
  RECHAZADA = 'RECHAZADA',         // Admin rechazó (foto borrosa, no cayó dinero)
  ANULADA = 'ANULADA'              // Se reversó contablemente
}

@Entity('cobranzas')
export class Cobranza {
  @PrimaryGeneratedColumn('uuid')
  id_cobranza: string;

  @Column({ unique: true }) // Nro de Recibo Interno (Generado por sistema)
  consecutivo: string; 

  @Column({ type: 'date' })
  fecha_reporte: Date;

  // 📸 REQUISITO: Soporte para Imagen desde App Móvil/Web
  @Column({ nullable: true })
  url_comprobante: string; 

  @Column('decimal', { precision: 12, scale: 2 })
  monto_total: number;

  @Column({ nullable: true })
  nota_vendedor: string;

  @Column({ nullable: true })
  nota_admin: string; // Ej: "Rechazado, referencia no existe"

  @Column({ type: 'enum', enum: EstadoCobranza, default: EstadoCobranza.POR_CONCILIAR })
  estado: EstadoCobranza;

  // 👇 SEGURIDAD (MAKER-CHECKER)
  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_vendedor' })
  vendedor: Usuario; // Quien sube el pago

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'id_aprobador' })
  aprobador: Usuario; // Quien verifica el banco

  @Column({ nullable: true })
  fecha_aprobacion: Date;

  @ManyToOne(() => Empresa)
  @JoinColumn({ name: 'id_empresa' })
  empresa: Empresa;

  // Relaciones
  @OneToMany(() => CobranzaMetodo, cm => cm.cobranza, { cascade: true })
  metodos: CobranzaMetodo[];

  @OneToMany(() => CobranzaFactura, cf => cf.cobranza, { cascade: true })
  facturas_afectadas: CobranzaFactura[];

  @CreateDateColumn()
  created_at: Date;
}