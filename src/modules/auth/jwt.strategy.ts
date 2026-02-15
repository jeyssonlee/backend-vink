import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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