import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from 'src/modules/core/usuarios/entities/usuarios.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private usuariosRepo: Repository<Usuario>,
    private jwtService: JwtService,
  ) {}

  // 1. Validar Usuario (Login Strategy)
  async validarUsuario(correo: string, pass: string): Promise<any> {
    const user = await this.usuariosRepo.createQueryBuilder('usuario')
      .addSelect('usuario.clave') 
      .leftJoinAndSelect('usuario.rol', 'rol')           
      .leftJoinAndSelect('usuario.sucursal', 'sucursal') 
      .leftJoinAndSelect('usuario.empresa', 'empresa')
      // 👇 AGREGA ESTA LÍNEA (Asumiendo que la relación en Empresa se llama 'holding')
      .leftJoinAndSelect('empresa.holding', 'holding')   
      .where('usuario.correo = :correo', { correo })
      .andWhere('usuario.activo = :activo', { activo: true })
      .getOne();

    if (user && await bcrypt.compare(pass, user.clave)) {
      const { clave, ...result } = user; 
      return result;
    }
    return null;
  }

  // 2. Generar Token (JWT)
  async login(user: any) {
    const payload = { 
      sub: user.id, 
      email: user.correo, 
      username: user.nombre_completo || user.correo, 
      rol: user.rol?.nombre,                   
      sucursalId: user.sucursal?.id_sucursal,  
      id_empresa: user.empresa?.id_empresa || user.id_empresa 
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      usuario: {
        id: user.id,
        id_empresa: user.id_empresa || user.empresa?.id_empresa,
        nombre: user.nombre_completo,
        email: user.correo,
        rol: user.rol?.nombre,
        sucursal: user.sucursal?.nombre,
        // 👇 AQUÍ LA EMPRESA YA VIENE COMO STRING (Razon Social)
        empresa: user.empresa?.razon_social,
        // 👇 AGREGAMOS EL HOLDING AL OBJETO DE RESPUESTA
        holding: user.empresa?.holding?.nombre || null 
      }
    };
  }
}