import { IsNumber, IsDateString, IsOptional, IsString, Min } from 'class-validator';

export class RegistrarTasaManualDto {
  @IsNumber()
  @Min(0.01)
  tasa: number;

  @IsDateString()
  fecha_vigencia: string; // 'YYYY-MM-DD'

  @IsDateString()
  @IsOptional()
  fecha_publicacion?: string; // 'YYYY-MM-DD' — si omite, usa hoy

  @IsString()
  @IsOptional()
  notas?: string;
}