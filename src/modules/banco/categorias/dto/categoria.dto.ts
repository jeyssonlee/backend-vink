import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsArray,
    ArrayMinSize,
    MaxLength,
  } from 'class-validator';
  
  export class CrearCategoriaDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    nombre: string;
  
    @IsString()
    @IsOptional()
    descripcion?: string;
  
    // Palabras clave opcionales al crear la categoría
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