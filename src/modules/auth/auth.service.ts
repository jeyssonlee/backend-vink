import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from 'src/modules/core/usuarios/entities/usuarios.entity';
import * as bcrypt from 'bcrypt';
import { Rol } from './roles/entities/rol.entity';
import { Vendedor } from 'src/modules/ventas/vendedores/entities/vendedor.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private usuariosRepo: Repository<Usuario>,
    private jwtService: JwtService,
    @InjectRepository(Rol) private rolRepository: Repository<Rol>,
    @InjectRepository(Vendedor) private vendedorRepository: Repository<Vendedor>,
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
    // Buscar si este usuario tiene un registro de vendedor asociado
    const vendedor = await this.vendedorRepository.findOne({
      where: { id_usuario: user.id },
    });

    console.log('🔍 user.id:', user.id);
  console.log('🔍 vendedor encontrado:', vendedor?.id_vendedor ?? 'NULL');

    const payload = { 
      sub: user.id, 
      email: user.correo, 
      username: user.nombre_completo || user.correo, 
      rol: user.rol?.nombre,                   
      sucursalId: user.sucursal?.id_sucursal,  
      id_empresa: user.empresa?.id || user.id_empresa,
      id_vendedor: vendedor?.id_vendedor ?? null,
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      usuario: {
        id: user.id,
        id_empresa: user.id_empresa || user.empresa?.id,
        nombre: user.nombre_completo,
        email: user.correo,
        rol: user.rol?.nombre,
        sucursal: user.sucursal?.nombre,
        empresa: user.empresa?.razon_social,
        holding: user.empresa?.holding?.nombre || null,
        id_vendedor: vendedor?.id_vendedor ?? null,
      },     
    };
  }
  async obtenerPermisosPorRol(nombreRol: string): Promise<string[]> {
    const rol = await this.rolRepository.findOne({
      where: { nombre: nombreRol },
    });
  
    if (!rol) return [];
    return rol.permisos ?? [];
  }
}