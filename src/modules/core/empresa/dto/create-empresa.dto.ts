import { IsString, IsNotEmpty, IsBoolean, IsOptional, Length, IsUUID } from 'class-validator';

export class CreateEmpresaDto {
  @IsString()
  @IsNotEmpty({ message: 'La razón social es obligatoria' })
  razon_social: string;

  @IsString()
  @IsNotEmpty()
  // Ajusta el largo según tu validación de RIF
  rif: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsBoolean()
  @IsOptional()
  activa?: boolean;

  @IsUUID('4')
  @IsOptional() // No es estricto (puede ser una empresa independiente)
  id_holding?: string; 
}