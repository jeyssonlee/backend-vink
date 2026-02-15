import { IsString, IsNumber, IsArray, ValidateNested, IsOptional, IsUUID, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class PedidoDetalleDto {
  @IsUUID('4')
  @IsNotEmpty()
  id_producto: string;

  @IsNumber()
  @Min(1)
  cantidad: number;

  @IsNumber()
  @Min(0)
  precio_unitario: number;
}

export class CreatePedidoDto {
  @IsString()
  @IsOptional()
  id_pedido_local?: string; // Opcional porque si viene de la Web, no trae ID local

  @IsUUID('4')
  @IsNotEmpty()
  id_cliente: string;

  @IsUUID('4')
  @IsNotEmpty() // Necesitamos saber quién vendió
  id_vendedor: string;

  @IsUUID('4')
  @IsNotEmpty()
  id_empresa: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PedidoDetalleDto)
  detalles: PedidoDetalleDto[];
}