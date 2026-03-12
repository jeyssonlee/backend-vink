import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
  } from 'typeorm';
  
  /**
   * Tabla en schema PUBLIC — compartida por todos los tenants.
   *
   * fecha_publicacion: cuándo el BCV la publicó (generalmente el día anterior a las 4 PM)
   * fecha_vigencia:    para qué día aplica esta tasa
   *
   * Consulta estándar para obtener la tasa de un movimiento:
   *   WHERE fecha_vigencia <= :fecha ORDER BY fecha_vigencia DESC LIMIT 1
   */
  @Entity({ name: 'tasa_bcv', schema: 'public' })
  @Index('idx_tasa_bcv_vigencia', ['fecha_vigencia'])
  export class TasaBcv {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Column({ type: 'date', name: 'fecha_publicacion' })
    fecha_publicacion: Date;
  
    @Column({ type: 'date', name: 'fecha_vigencia', unique: true })
    fecha_vigencia: Date;
  
    @Column({ type: 'numeric', precision: 10, scale: 4 })
    tasa: number;
  
    @Column({ type: 'varchar', length: 20, default: 'CRON' })
    origen: 'CRON' | 'MANUAL'; // CRON = automático, MANUAL = ingresado por ROOT
  
    @Column({ type: 'text', nullable: true })
    notas: string | null;
  
    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;
  }