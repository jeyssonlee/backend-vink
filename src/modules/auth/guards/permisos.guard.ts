import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PERMISOS_KEY } from '../decorators/permisos.decorator';
import { Rol } from '../roles/entities/rol.entity';

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Rol)
    private readonly rolRepo: Repository<Rol>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Leemos los permisos requeridos por el endpoint
    const permisosRequeridos = this.reflector.getAllAndOverride<string[]>(PERMISOS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si el endpoint no tiene @Permisos(), lo dejamos pasar
    if (!permisosRequeridos || permisosRequeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('No autenticado');

    // ROOT tiene acceso total, sin consultar BD
    if (user.rol === 'ROOT') return true;

    // Buscamos el rol del usuario en BD para obtener sus permisos actuales
    const rol = await this.rolRepo.findOne({ where: { nombre: user.rol } });
    if (!rol) throw new ForbiddenException('Rol no encontrado');

    // Verificamos que tenga AL MENOS UNO de los permisos requeridos
    const tienePermiso = permisosRequeridos.some(p => rol.permisos.includes(p));
    if (!tienePermiso) {
      throw new ForbiddenException(`No tienes permiso para realizar esta acción`);
    }

    return true;
  }
}