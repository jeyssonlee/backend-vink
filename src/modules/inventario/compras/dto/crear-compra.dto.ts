import { IsString, IsNotEmpty, IsInt, IsNumber, Min, IsArray, ValidateNested, IsEnum, IsUUID, IsDateString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { FormaPago } from '../entities/compra.entity';

export class CrearCompraDetalleDto {
  @IsUUID('4')
  id_producto: string;

  @IsNumber()
  @Min(0.01) // No permitir cantidad 0
  cantidad: number;

  @IsNumber()
  @Min(0)
  costo_unitario: number;
}

export class CrearCompraDto {
  @IsString()
  @IsNotEmpty()
  num_factura: string;

  @IsUUID('4')
  @IsNotEmpty()
  id_proveedor: string;

  @IsUUID('4')
  @IsNotEmpty()
  id_empresa: string;

  @IsUUID('4')
  @IsNotEmpty()
  id_almacen: string;

  @IsDateString()
  @IsOptional() // Puede ser opcional y tomar la fecha actual
  fecha_compra?: string;

  @IsEnum(FormaPago)
  @IsNotEmpty()
  forma_pago: FormaPago;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearCompraDetalleDto)
  detalles: CrearCompraDetalleDto[];
}