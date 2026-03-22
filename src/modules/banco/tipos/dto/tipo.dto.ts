import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

// ── TIPOS ──────────────────────────────────────

export class CrearTipoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}

export class ActualizarTipoDto {
  @IsString()
  @IsOptional()
  @MaxLength(60)
  nombre?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}

// ── SUBTIPOS ───────────────────────────────────

export class CrearSubtipoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}

export class ActualizarSubtipoDto {
  @IsString()
  @IsOptional()
  @MaxLength(80)
  nombre?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
