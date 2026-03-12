import { IsString, IsOptional, IsUUID, IsArray, ValidateNested, IsNumber, IsPositive, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DetallePedidoDto {
  @IsUUID()
  id_producto: string;

  @IsInt()
  @IsPositive()
  cantidad: number;

  @IsNumber()
  @IsPositive()
  precio_unitario: number;
}

export class CreatePedidoDto {
  @IsOptional()
  @IsString()
  id_pedido_local?: string;

  // Seteado desde el token en el controller
  @IsOptional()
  @IsUUID()
  id_empresa?: string;

  @IsOptional()
  @IsUUID()
  id_vendedor?: string;

  @IsUUID()
  id_cliente: string;

  @IsOptional()
  @IsString()
  nota?: string;

  @IsOptional()
  @IsString()
  metodo_pago?: string; // Default: 'CREDITO'

  @IsOptional()
  @IsInt()
  @Min(0)
  dias_credito?: number; // Default: 15

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetallePedidoDto)
  detalles: DetallePedidoDto[];
}

export class RechazarPedidoDto {
  @IsString()
  nota_rechazo: string;
}

export class FacturarLoteDto {
  @IsArray()
  @IsUUID('all', { each: true })
  ids_pedidos: string[];
}
