import { IsUUID, IsEnum, IsNumber, IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { TipoMovimiento } from '../entities/movimiento-kardex.entity';

export class RegistrarMovimientoDto {
  @IsUUID('4')
  @IsNotEmpty()
  id_empresa: string;

  @IsUUID('4')
  @IsNotEmpty()
  id_almacen: string;

  @IsUUID('4')
  @IsNotEmpty()
  id_producto: string;

  @IsEnum(TipoMovimiento)
  @IsNotEmpty()
  tipo: TipoMovimiento;

  @IsNumber()
  @IsNotEmpty()
  cantidad: number;

  @IsNumber()
  @IsNotEmpty()
  costo_unitario: number;

  // 👇 AQUÍ ESTABAN LOS CULPABLES (Renombrados correctamente)
  @IsNumber()
  @IsNotEmpty()
  stock_inicial: number; // Antes era stock_anterior

  @IsNumber()
  @IsNotEmpty()
  stock_final: number;   // Antes era stock_nuevo o stock_actual

  @IsString()
  @IsOptional()
  referencia?: string;

  @IsString()
  @IsOptional()
  observacion?: string;
}