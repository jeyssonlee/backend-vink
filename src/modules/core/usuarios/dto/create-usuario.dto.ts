import { IsString, IsEmail, IsUUID, IsOptional, MinLength, IsEnum, IsNotEmpty } from 'class-validator';

export enum RolUsuario {
  ADMIN = 'ADMIN',
  VENDEDOR = 'VENDEDOR',
  ALMACEN = 'ALMACEN',
}

export class CrearUsuarioDto {
  @IsString()
  @IsNotEmpty()
  nombre_completo: string;

  @IsEmail({}, { message: 'Formato de correo inválido' })
  @IsNotEmpty()
  correo: string;

  @IsString()
  @MinLength(6, { message: 'La clave debe tener al menos 6 caracteres' })
  clave: string;

  @IsEnum(RolUsuario)
  @IsOptional()
  rol?: RolUsuario; // Si no se envía, asignar default en Service

  @IsUUID('4')
  @IsNotEmpty()
  id_empresa: string;

  @IsUUID('4')
  @IsNotEmpty()
  id_sucursal: string; // Faltaba vincularlo a una sucursal física
}