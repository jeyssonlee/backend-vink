import { IsUUID } from 'class-validator';

export class InventarioValorizadoQueryDto {
  @IsUUID()
  id_empresa: string;
}
