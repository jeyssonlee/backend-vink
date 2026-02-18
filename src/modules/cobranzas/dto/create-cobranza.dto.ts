import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MetodoPagoDetalle } from '../entities/cobranza-metodo.entity';

// 1. Detalle del Dinero
export class CreateCobranzaMetodoDto {
  @IsEnum(MetodoPagoDetalle)
  metodo: MetodoPagoDetalle;

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  banco?: string;
}

// 2. Detalle de Imputación
export class CreateCobranzaFacturaDto {
  @IsUUID()
  id_factura: string;

  @IsNumber()
  @Min(0.01)
  monto_aplicado: number;
}

// 3. Cabecera (El Recibo)
export class CreateCobranzaDto {
  @IsDateString()
  fecha_reporte: string;

  @IsString()
  @IsOptional()
  url_comprobante?: string;

  @IsNumber()
  @Min(0.01)
  monto_total: number;

  @IsString()
  @IsOptional()
  nota_vendedor?: string;

  @IsUUID()
  @IsOptional()
  id_vendedor: string;

  @IsUUID()
  @IsOptional()
  id_empresa: string;

  // Arrays anidados
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCobranzaMetodoDto)
  metodos: CreateCobranzaMetodoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCobranzaFacturaDto)
  facturas: CreateCobranzaFacturaDto[];
}