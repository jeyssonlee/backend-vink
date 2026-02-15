import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @IsNotEmpty()
  rif: string; // O Cédula

  @IsString()
  @IsNotEmpty()
  razon_social: string; // O Nombre completo

  @IsString()
  @IsOptional()
  direccion_fiscal?: string;

  @IsString()
  @IsOptional()
  telefono?: string; // Unificado nombre

  @IsUUID('4')
  @IsNotEmpty()
  id_empresa: string;
  
  // Vendedor asignado (opcional)
  @IsUUID('4')
  @IsOptional()
  id_vendedor?: string;
}