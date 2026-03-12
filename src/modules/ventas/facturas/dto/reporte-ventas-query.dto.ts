import { IsUUID, IsOptional, IsString, IsDateString } from 'class-validator';

export class ReporteVentasQueryDto {
  @IsUUID()
  id_empresa: string;

  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;   // ISO: '2026-01-01'

  @IsOptional()
  @IsDateString()
  fecha_fin?: string;      // ISO: '2026-03-31'

  @IsOptional()
  @IsString()
  vendedor?: string;       // id_vendedor

  @IsOptional()
  @IsString()
  marca?: string;          // nombre de marca

  @IsOptional()
  @IsString()
  categoria?: string;      // nombre de categoría
}