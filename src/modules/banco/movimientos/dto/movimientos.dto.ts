import { IsOptional, IsString, IsIn, IsDateString, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

export class FiltrosMovimientosDto {
  @IsDateString()
  @IsOptional()
  fecha_desde?: string;

  @IsDateString()
  @IsOptional()
  fecha_hasta?: string;

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value) : undefined)
  id_categoria?: number;

  @IsString()
  @IsOptional()
  @IsIn([
    'GASTO_OPERATIVO', 'COMPRA_INVENTARIO', 'PAGO_PROVEEDOR',
    'NOMINA', 'TRANSFERENCIA_INTERNA', 'INGRESO_VENTAS', 'OTRO',
  ])
  tipo_destino?: string;

  @IsString()
  @IsOptional()
  @IsIn(['INGRESO', 'EGRESO'])
  tipo?: 'INGRESO' | 'EGRESO';

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value) : undefined)
  id_empresa?: number; // para vista consolidada filtrada por empresa

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value) : 50)
  limite?: number;

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value) : 0)
  offset?: number;
}

export class FiltrosDashboardDto {
  @IsDateString()
  @IsOptional()
  fecha_desde?: string;

  @IsDateString()
  @IsOptional()
  fecha_hasta?: string;

  // Para consolidado: array de ids de empresa a incluir (opcional)
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  })
  empresas?: string[];
}