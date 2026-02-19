import { IsNotEmpty, IsString, IsNumber, IsArray, IsOptional, IsDateString, IsUUID, Min, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
// 👇 Importar desde enums, NO desde la entidad
import { MetodoPagoDetalle } from './cobranza.enums';

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

export class CreateCobranzaFacturaDto {
  @IsUUID()
  id_factura: string;

  @IsNumber()
  @Min(0.00)
  monto_aplicado: number;
}

export class CreateCobranzaDto {
  @IsDateString()
  fecha_reporte: Date;

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

  @IsNotEmpty()
  @IsString()
  id_cliente: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCobranzaMetodoDto)
  metodos: CreateCobranzaMetodoDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCobranzaFacturaDto)
  facturas: CreateCobranzaFacturaDto[];
}