import { IsNumber, IsPositive, IsOptional, IsString, Min, IsNotEmpty, ValidateNested, ArrayMinSize, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class IniciarImportacionDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  id_cuenta: number;

  @IsString()
  @IsOptional()
  banco_key?: string; // opcional — si no viene, se auto-detecta
}

export class EditarStagingDto {
  @IsNumber()
  @IsOptional()
  id_categoria?: number;

  @IsNumber()
  @IsOptional()
  id_subtipo?: number | null;

  @IsString()
  @IsOptional()
  tipo_destino?: string;

  @IsString()
  @IsOptional()
  notas?: string;

  @IsBoolean()
  @IsOptional()
  excluir?: boolean;

  @IsNumber()
  @IsOptional()
  tasa_vigente?: number;
}

export class DistribucionDto {
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => DistribucionItemDto)
  distribuciones: DistribucionItemDto[];
}

export class DistribucionItemDto {
  @IsString()
  @IsNotEmpty()
  id_empresa: string;

  @IsNumber()
  @Min(0.01)
  monto: number;

  @IsNumber()
  @IsOptional()
  porcentaje?: number;

  @IsNumber()
  @IsOptional()
  id_cuenta?: number;
}