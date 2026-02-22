import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          //console.log("🔍 [Auth] Cookies recibidas:", request.cookies);
          let token: string | null = null;
          // 1. Buscamos en las cookies (si existe)
          if (request && request.cookies) {
            token = request.cookies['token']; // Cambia 'token' si tu cookie tiene otro nombre
          }
          // 2. Fallback: Si no hay cookie, buscamos en el header (Útil para Postman o App Móvil)
          if (!token && request.headers.authorization) {
            token = request.headers.authorization.split(' ')[1];
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET') || 'CLAVE_SECRETA_SUPER_SEGURA', 
    });
  }

  async validate(payload: any) {
    return { 
      sub: payload.sub,             
      id_usuario: payload.sub,      
      email: payload.email, 
      id_empresa: payload.id_empresa, 
      rol: payload.rol,
      
      // 👇 NUEVO: Recuperamos el nombre para usarlo en los Logs
      username: payload.username || 'Usuario' 
    };
  }
}