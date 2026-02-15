import { IsString, IsOptional, IsUUID } from 'class-validator';

export class SyncAccionDto {
  @IsUUID('4')
  id_pedido_local: string;

  @IsUUID('4')
  id_empresa: string;

  @IsString()
  @IsOptional()
  motivo?: string; 
}