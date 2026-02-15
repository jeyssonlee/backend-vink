import { IsString, IsNotEmpty, IsUUID, MinLength, IsOptional } from 'class-validator';

export class CreateVendedorDto {
  @IsString()
  @IsNotEmpty()
  cedula: string;

  @IsString()
  @IsNotEmpty()
  nombre_apellido: string;

  @IsString()
  @IsNotEmpty()
  telefono: string;

  @IsString()
  @IsNotEmpty()
  ciudad: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  pais?: string;

  @IsString()
  @IsNotEmpty()
  usuario: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  contrasena: string;

  // OBLIGATORIO: Vinculación con la sede
  @IsUUID('4', { message: 'El id_empresa debe ser un UUID válido' })
  id_empresa: string;

}