import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  MaxLength,
  IsNumber,
  IsPositive,
} from 'class-validator';

export class CrearCategoriaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  // Subtipo al que pertenece (opcional — puede asignarse luego)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  id_subtipo?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  palabras_clave?: string[];
}

export class ActualizarCategoriaDto {
  @IsString()
  @IsOptional()
  @MaxLength(80)
  nombre?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsBoolean()
  @IsOptional()
  activa?: boolean;

  // null = quitar subtipo, number = reasignar
  @IsNumber()
  @IsOptional()
  id_subtipo?: number | null;
}

export class AgregarPalabrasClaveDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  palabras_clave: string[];
}

export class EliminarPalabraClaveDto {
  @IsString()
  @IsNotEmpty()
  palabra_clave: string;
}
