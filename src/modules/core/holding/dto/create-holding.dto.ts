import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateHoldingDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del Holding es obligatorio' })
  nombre: string;

  @IsString()
  @IsOptional()
  rif?: string; // A veces el Holding es una figura lógica y no fiscal, por eso opcional

  @IsString()
  @IsOptional()
  descripcion?: string;
}