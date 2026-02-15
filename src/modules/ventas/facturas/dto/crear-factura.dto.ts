import { IsUUID, IsEnum, IsNotEmpty, IsOptional, IsNumber, Min, IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { MetodoPago, EstadoFactura } from '../entities/factura.entity';

// Sub-DTO para los items de Venta Directa
export class DetalleFacturaDirectaDto {
  @IsUUID('4')
  @IsNotEmpty()
  id_producto: string;

  @IsNumber()
  @Min(0.01)
  cantidad: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  precio_personalizado?: number; // Si el vendedor cambia el precio manualmente

  @IsNumber()
  @Min(0)
  @IsOptional()
  descuento_porcentaje?: number;
}

export class CrearFacturaDto {
  // OPCIÓN A: Vienes de un Pedido
  @IsUUID('4')
  @IsOptional()
  id_pedido?: string;

  // OPCIÓN B: Venta Directa (Sin pedido previo)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleFacturaDirectaDto)
  @IsOptional()
  items?: DetalleFacturaDirectaDto[];

  @IsUUID('4')
  @IsOptional()
  id_cliente?: string; // Obligatorio si es venta directa

  // --- DATOS GENERALES ---
  
  @IsEnum(MetodoPago)
  @IsNotEmpty()
  metodo_pago: MetodoPago;

  @IsEnum(EstadoFactura)
  @IsOptional()
  estado?: EstadoFactura; // Puedes enviar 'BORRADOR' explícitamente

  @IsNumber()
  @IsOptional()
  dias_credito?: number; // Solo si es Crédito

  @IsNumber()
  @IsOptional()
  @Min(0)
  descuento_global_monto?: number;

  // Inyectados por el Controller (Token)
  @IsUUID('4')
  @IsOptional()
  id_empresa?: string;

  @IsUUID('4')
  @IsOptional()
  id_usuario?: string;
}