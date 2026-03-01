import { IsString, IsNotEmpty, IsOptional, IsEmail, ValidateNested, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class SucursalOnboardingDto {
  @IsString() @IsNotEmpty()
  nombre: string;

  @IsString() @IsOptional()
  direccion?: string;

  @IsString() @IsOptional()
  telefono?: string;

  @IsArray() @ValidateNested({ each: true })
  @Type(() => AlmacenOnboardingDto)
  @IsOptional()
  almacenes?: AlmacenOnboardingDto[];
}

export class EmpresaOnboardingDto {
  @IsString() @IsNotEmpty()
  razon_social: string;

  @IsString() @IsNotEmpty()
  rif: string;

  @IsString() @IsOptional()
  direccion?: string;

  @IsString() @IsOptional()
  telefono?: string;

  @IsArray() @ValidateNested({ each: true })
  @Type(() => SucursalOnboardingDto)
  sucursales: SucursalOnboardingDto[];
}

export class AdminOnboardingDto {
  @IsString() @IsNotEmpty()
  nombre_completo: string;

  @IsEmail()
  correo: string;

  @IsString() @IsNotEmpty()
  clave: string;
}

export class OnboardingEmpresaDto {
  @IsString() @IsNotEmpty()
  tipo: 'EMPRESA'; // discriminador

  @ValidateNested() @Type(() => EmpresaOnboardingDto)
  empresa: EmpresaOnboardingDto;

  @ValidateNested() @Type(() => AdminOnboardingDto)
  admin: AdminOnboardingDto;
}

export class OnboardingHoldingDto {
  @IsString() @IsNotEmpty()
  tipo: 'HOLDING';

  @IsString() @IsNotEmpty()
  nombre_holding: string;

  @IsString() @IsOptional()
  descripcion_holding?: string;

  @IsArray() @ValidateNested({ each: true })
  @Type(() => EmpresaOnboardingDto)
  empresas: EmpresaOnboardingDto[];

  @ValidateNested() @Type(() => AdminOnboardingDto)
  admin: AdminOnboardingDto;
}

export class AlmacenOnboardingDto {
  @IsString() @IsNotEmpty()
  nombre: string;

  @IsBoolean() @IsOptional()
  es_venta?: boolean;
}

