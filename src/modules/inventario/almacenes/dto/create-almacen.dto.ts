import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateAlmacenDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del almacén es obligatorio' })
  nombre: string;

  @IsBoolean()
  @IsOptional()
  es_venta?: boolean; 

  @IsUUID('4')
  @IsNotEmpty()
  id_sucursal: string;

  @IsUUID('4')
  @IsNotEmpty() // Obligatorio para multitenancy
  id_empresa: string;
}