import { SetMetadata } from '@nestjs/common';
import { Permiso } from '../permisos.enum';

export const PERMISOS_KEY = 'permisos';
export const Permisos = (...permisos: Permiso[]) => SetMetadata(PERMISOS_KEY, permisos);