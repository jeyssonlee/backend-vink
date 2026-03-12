import {
    IsNumber,
    IsEnum,
    IsOptional,
    IsString,
    IsDateString,
    Min,
  } from 'class-validator';
  import { MetodoPago } from '../entities/pago-cxp.entity';
  
  export { MetodoPago}
  
  export class AplicarPagoDto {
    @IsNumber()
    @Min(0.01)
    monto: number;
  
    @IsEnum(MetodoPago)
    metodo_pago: MetodoPago;
  
    @IsDateString()
    fecha_pago: string;
  
    @IsOptional()
    @IsString()
    referencia?: string;
  
    @IsOptional()
    @IsString()
    observacion?: string;
  }