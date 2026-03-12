import { IsUUID, IsOptional, IsString } from 'class-validator';

export class AgingQueryDto {
  @IsUUID()
  id_empresa: string;

  @IsOptional()
  @IsString()
  vendedor?: string;    // id_vendedor o nombre, según tu modelo
}