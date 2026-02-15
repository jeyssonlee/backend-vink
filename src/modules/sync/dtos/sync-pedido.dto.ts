import { IsString, IsNumber, IsArray, ValidateNested, IsUUID, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncPedidoItemDto {
  @IsUUID('4')
  id_producto: string;

  @IsNumber()
  cantidad: number;

  @IsNumber()
  precio_unitario: number;
}

export class SyncPedidoDto {
  @IsUUID('4')
  id_pedido_local: string;

  @IsUUID('4')
  id_empresa: string;

  @IsUUID('4') // Antes era opcional, ahora DEBE venir
  cliente_id: string; // Nota: en tu DB se llama id_cliente, aquí mapeamos

  @IsUUID('4') // <--- NUEVO CAMPO OBLIGATORIO
  vendedor_id: string; 

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncPedidoItemDto)
  items: SyncPedidoItemDto[];
  
  @IsDateString()
  fecha: string;
}