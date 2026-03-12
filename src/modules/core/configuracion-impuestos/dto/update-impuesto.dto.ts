import { IsNumber, IsBoolean, IsOptional, IsDateString, Min, Max } from 'class-validator';

export class UpdateImpuestoDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje: number;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @IsDateString()
  @IsOptional()
  fecha_vigencia?: string;
}