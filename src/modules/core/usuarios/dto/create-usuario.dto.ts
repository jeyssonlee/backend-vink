import { IsString, IsEmail, IsUUID, IsOptional, MinLength, IsNotEmpty } from 'class-validator';

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

  @IsString()
  @IsOptional()
  rol?: string;

  @IsUUID('4')
  @IsNotEmpty()
  id_empresa: string;

  @IsUUID('4')
  @IsOptional()
  id_sucursal?: string;
}