import { IsArray, IsUUID, IsOptional, IsEnum } from 'class-validator';
import { MetodoPago } from '../entities/factura.entity';

export class CrearFacturaLoteDto {
  @IsArray()
  @IsUUID('4', { each: true }) // Valida que sea un array de UUIDs válidos
  ids_pedidos: string[];

  // Si quieres procesar todo el lote como CREDITO o ZELLE de un golpe
  @IsOptional()
  @IsEnum(MetodoPago)
  metodo_pago_defecto?: MetodoPago;
}