import { IsString, IsOptional, IsUUID, IsNumber, IsNotEmpty, Min } from 'class-validator';

export class CreateProductoDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsUUID('4')
  @IsOptional()
  id_empresa: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  precio_base?: number; // Sugiero renombrar 'precio' a 'precio_base' para claridad

  @IsString()
  @IsOptional()
  codigo_barras?: string;

  @IsString()
  @IsOptional()
  marca?: string;

  @IsString()
  @IsOptional()
  rubro?: string;

  @IsString()
  @IsOptional()
  categoria?: string; // Idealmente debería ser id_categoria (UUID) a futuro

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsString()
  @IsOptional()
  proveedor?: string;

  @IsString()
  @IsOptional()
  imagen?: string;
}