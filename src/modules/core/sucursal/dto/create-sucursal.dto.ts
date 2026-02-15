import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateSucursalDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la sucursal es obligatorio' })
  nombre: string;

  @IsString()
  @IsOptional()
  direccion?: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsString()
  @IsOptional()
  responsable?: string; // Nombre del gerente o encargado

  @IsBoolean()
  @IsOptional()
  es_matriz?: boolean; // Para saber si es la sede principal

  @IsUUID('4')
  @IsNotEmpty() // Una sucursal SIEMPRE debe pertenecer a una empresa
  id_empresa: string;
}