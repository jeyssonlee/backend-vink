import { IsString, IsNotEmpty, IsOptional, IsEmail, IsInt, Min, IsUUID } from 'class-validator';

export class CreateProveedorDto {
  @IsString()
  @IsNotEmpty()
  nombre_empresa: string;

  @IsString()
  @IsNotEmpty() // El RIF suele ser obligatorio fiscalmente
  rif: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsString()
  @IsOptional()
  nombre_vendedor?: string;

  @IsString()
  @IsOptional()
  telefono_contacto?: string;

  @IsEmail()
  @IsOptional()
  email_pedidos?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  dias_credito?: number;

  @IsUUID('4')
  @IsNotEmpty()
  id_empresa: string;
}