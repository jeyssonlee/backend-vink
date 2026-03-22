import { IsOptional, IsDateString, IsString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export type TipoAgrupadoReporte =
  | 'POR_CATEGORIA'
  | 'POR_MES'
  | 'POR_SEMANA'
  | 'POR_TIPO_DESTINO'
  | 'POR_CUENTA';

export class FiltrosReporteDto {
  @IsDateString()
  @IsOptional()
  fecha_desde?: string;

  @IsDateString()
  @IsOptional()
  fecha_hasta?: string;
}

export class FiltrosTopGastosDto extends FiltrosReporteDto {
  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value) : 10)
  limite?: number;
}

export class FiltrosComparativaDto extends FiltrosReporteDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  })
  empresas?: string[];
}
export class FiltrosAgrupadoDto extends FiltrosReporteDto {
  @IsString()
  @IsIn(['POR_CATEGORIA', 'POR_MES', 'POR_SEMANA', 'POR_TIPO_DESTINO', 'POR_CUENTA'])
  tipo: TipoAgrupadoReporte;

  @IsOptional()
  @IsString()
  @IsIn(['INGRESO', 'EGRESO'])
  tipo_movimiento?: 'INGRESO' | 'EGRESO';
}