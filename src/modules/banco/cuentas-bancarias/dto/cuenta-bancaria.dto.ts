import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsNumber,
    IsIn,
    Min,
    MaxLength,
  } from 'class-validator';
  
  export class CrearCuentaBancariaDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    nombre: string;
  
    @IsString()
    @IsNotEmpty()
    @MaxLength(30)
    numero_cuenta: string;
  
    @IsIn(['VES', 'USD'])
    moneda: 'VES' | 'USD';
  
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    banco_key: string;
  
    @IsNumber()
    @Min(0)
    @IsOptional()
    saldo_inicial?: number;
  }
  
  export class ActualizarCuentaBancariaDto {
    @IsString()
    @IsOptional()
    @MaxLength(120)
    nombre?: string;
  
    @IsBoolean()
    @IsOptional()
    activa?: boolean;
  
    @IsString()
    @IsOptional()
    @MaxLength(50)
    banco_key?: string;
  }