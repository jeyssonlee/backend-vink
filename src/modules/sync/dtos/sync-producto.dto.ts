import { IsString, IsNumber, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class SyncProductoDto {
  @IsUUID('4')
  id_producto: string;

  @IsString()
  nombre: string;

  @IsNumber()
  precio: number;

  @IsNumber()
  stock: number;

  @IsString()
  @IsOptional()
  codigo_barras?: string; // Este suele ser string normal (EAN-13), no UUID

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}