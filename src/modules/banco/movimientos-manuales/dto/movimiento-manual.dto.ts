import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsNumber,
    IsIn,
    IsDateString,
    Min,
  } from 'class-validator';
  import { Transform } from 'class-transformer';
  
  export class CrearMovimientoManualDto {
    @IsDateString()
    fecha: string;
  
    @IsIn(['INGRESO', 'EGRESO'])
    tipo: 'INGRESO' | 'EGRESO';
  
    @IsIn(['GASTO_OPERATIVO', 'COMPRA_INVENTARIO', 'INVERSION_ACTIVOS', 'RETIRO_APORTE_SOCIOS'])
    @IsOptional()
    tipo_egreso?: string;
  
    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => value ? parseInt(value) : undefined)
    id_cuenta?: number;
  
    @IsBoolean()
    @IsOptional()
    es_efectivo?: boolean;
  
    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => value ? parseInt(value) : undefined)
    id_categoria?: number;
  
    @IsString()
    @IsOptional()
    descripcion?: string;
  
    @IsNumber()
    @Min(0.01)
    monto_usd: number;
  
    @IsNumber()
    @IsOptional()
    tasa_vigente?: number;
  }
  
  export class EditarMovimientoManualDto {
    @IsDateString()
    @IsOptional()
    fecha?: string;
  
    @IsIn(['INGRESO', 'EGRESO'])
    @IsOptional()
    tipo?: 'INGRESO' | 'EGRESO';
  
    @IsIn(['GASTO_OPERATIVO', 'COMPRA_INVENTARIO', 'INVERSION_ACTIVOS', 'RETIRO_APORTE_SOCIOS'])
    @IsOptional()
    tipo_egreso?: string;
  
    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => value ? parseInt(value) : undefined)
    id_cuenta?: number;
  
    @IsBoolean()
    @IsOptional()
    es_efectivo?: boolean;
  
    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => value ? parseInt(value) : undefined)
    id_categoria?: number;
  
    @IsString()
    @IsOptional()
    descripcion?: string;
  
    @IsNumber()
    @IsOptional()
    @Min(0.01)
    monto_usd?: number;
  
    @IsNumber()
    @IsOptional()
    tasa_vigente?: number;
  }
  
  export class FiltrosMovimientoManualDto {
    @IsDateString()
    @IsOptional()
    fecha_desde?: string;
  
    @IsDateString()
    @IsOptional()
    fecha_hasta?: string;
  
    @IsIn(['INGRESO', 'EGRESO'])
    @IsOptional()
    tipo?: string;
  
    @IsIn(['GASTO_OPERATIVO', 'COMPRA_INVENTARIO', 'INVERSION_ACTIVOS', 'RETIRO_APORTE_SOCIOS'])
    @IsOptional()
    tipo_egreso?: string;
  
    @IsOptional()
    @Transform(({ value }) => value ? parseInt(value) : undefined)
    id_categoria?: number;
  
    @IsOptional()
    @Transform(({ value }) => value ? parseInt(value) : 50)
    limite?: number;
  
    @IsOptional()
    @Transform(({ value }) => value ? parseInt(value) : 0)
    offset?: number;
  }