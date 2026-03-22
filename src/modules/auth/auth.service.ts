import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
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

  // ── 1. Validar Usuario ────────────────────────────────────────
  async validarUsuario(correo: string, pass: string): Promise<any> {
    const user = await this.usuariosRepo.createQueryBuilder('usuario')
      .addSelect('usuario.clave')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .leftJoinAndSelect('usuario.sucursal', 'sucursal')
      .leftJoinAndSelect('usuario.empresa', 'empresa')
      .leftJoinAndSelect('empresa.holding', 'holding')
      .leftJoinAndSelect('usuario.holding', 'usuarioHolding')
      .leftJoinAndSelect('usuario.empresas_permitidas', 'empresas_permitidas')
      .where('usuario.correo = :correo', { correo })
      .andWhere('usuario.activo = :activo', { activo: true })
      .getOne();

    if (user && await bcrypt.compare(pass, user.clave)) {
      const { clave, ...result } = user;
      return result;
    }
    return null;
  }

  // ── 2. Login ──────────────────────────────────────────────────
  async login(user: any) {
    console.log('LOGIN - user.id:', user.id, '| correo:', user.correo);
    const vendedor = await this.vendedorRepository.findOne({
      where: { id_usuario: user.id },
    });

    const idEmpresa = user.empresa?.id || user.id_empresa || null;
    const empresasPermitidas: any[] = user.empresas_permitidas || [];

    // Necesita selector si: no tiene empresa asignada O tiene acceso a múltiples
    const necesitaSelector = !idEmpresa || empresasPermitidas.length > 1;

    if (necesitaSelector) {
      const empresas = empresasPermitidas.length > 0
        ? empresasPermitidas.map((e: any) => ({
            id: e.id, razon_social: e.razon_social, rif: e.rif,
          }))
        : await this.obtenerEmpresasDelHolding(user);

      // Solo una empresa disponible y sin empresa asignada → entrar directo
      if (empresas.length === 1 && !idEmpresa) {
        return this.emitirTokenCompleto(user, empresas[0].id, vendedor, empresas[0]);
      }

      // Sin empresas disponibles → caso ROOT sin empresa
      if (empresas.length === 0) {
        return this.emitirTokenCompleto(user, null, vendedor);
      }

      return {
        requiere_seleccion: true,
        token_provisional: this.jwtService.sign(
          {
            sub: user.id,
            email: user.correo,
            username: user.nombre_completo || user.correo,
            rol: user.rol?.nombre,
            id_empresa: null,
            provisional: true,
          },
          { expiresIn: '10m' },
        ),
        usuario: {
          id: user.id,
          nombre: user.nombre_completo,
          email: user.correo,
          rol: user.rol?.nombre,
        },
        empresas,
      };
    }

    return this.emitirTokenCompleto(user, idEmpresa, vendedor);
  }

  // ── 3. Seleccionar empresa (desde selector o switcher) ────────
  async seleccionarEmpresa(idUsuario: string, idEmpresa: string) {
    // Query directo para saltarse cualquier problema de mapeo de TypeORM
    const [raw] = await this.usuariosRepo.manager.query(
      `SELECT id, id_holding, id_empresa FROM usuarios WHERE id = $1`,
      [idUsuario],
    );
    console.log('RAW usuario:', raw);
  
    const user = await this.usuariosRepo.createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .leftJoinAndSelect('usuario.sucursal', 'sucursal')
      .leftJoinAndSelect('usuario.empresa', 'empresa')
      .leftJoinAndSelect('empresa.holding', 'holding')
      .leftJoinAndSelect('usuario.empresas_permitidas', 'empresas_permitidas')
      .where('usuario.id = :id', { id: idUsuario })
      .getOne();
  
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
  
    const empresasPermitidas: any[] = user.empresas_permitidas || [];
  
    let empresasDisponibles: any[] = [];
    if (empresasPermitidas.length > 0) {
      empresasDisponibles = empresasPermitidas;
    } else {
      const idHolding = raw?.id_holding
        || (user as any).id_holding
        || user.empresa?.holding?.id_holding
        || null;
  
      console.log('idHolding resuelto:', idHolding);
  
      if (idHolding) {
        empresasDisponibles = await this.usuariosRepo.manager.query(
          `SELECT id, razon_social, rif FROM empresas
           WHERE id_holding = $1 AND activa = TRUE
           ORDER BY razon_social`,
          [idHolding],
        );
      }
    }
  
    console.log('empresasDisponibles:', empresasDisponibles);
    console.log('buscando id_empresa:', idEmpresa);
  
    const empresaValida = empresasDisponibles.find((e: any) => e.id === idEmpresa);
    if (!empresaValida) throw new ForbiddenException('No tienes acceso a esta empresa');
  
    const vendedor = await this.vendedorRepository.findOne({
      where: { id_usuario: user.id },
    });
  
    return this.emitirTokenCompleto(user, idEmpresa, vendedor, empresaValida);
  }

  // ── 4. Empresas disponibles para el switcher ──────────────────
  async obtenerEmpresasParaSwitcher(idUsuario: string) {
    const user = await this.usuariosRepo.createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.empresa', 'empresa')
      .leftJoinAndSelect('empresa.holding', 'holding')
      .leftJoinAndSelect('usuario.holding', 'usuarioHolding')
      .leftJoinAndSelect('usuario.empresas_permitidas', 'empresas_permitidas')
      .where('usuario.id = :id', { id: idUsuario })
      .getOne();

    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const empresasPermitidas: any[] = user.empresas_permitidas || [];
    if (empresasPermitidas.length > 0) {
      return empresasPermitidas.map((e: any) => ({
        id: e.id, razon_social: e.razon_social, rif: e.rif,
      }));
    }

    return this.obtenerEmpresasDelHolding(user);
  }

  // ── 5. Permisos ───────────────────────────────────────────────
  async obtenerPermisosPorRol(nombreRol: string): Promise<string[]> {
    const rol = await this.rolRepository.findOne({ where: { nombre: nombreRol } });
    if (!rol) return [];
    return rol.permisos ?? [];
  }

  // ── HELPERS ───────────────────────────────────────────────────

  private emitirTokenCompleto(
    user: any,
    idEmpresa: string | null,
    vendedor: any,
    empresa?: any,
  ) {
    const payload = {
      sub: user.id,
      email: user.correo,
      username: user.nombre_completo || user.correo,
      rol: user.rol?.nombre,
      sucursalId: user.sucursal?.id_sucursal,
      id_empresa: idEmpresa,
      id_vendedor: vendedor?.id_vendedor ?? null,
    };

    return {
      requiere_seleccion: false,
      access_token: this.jwtService.sign(payload),
      usuario: {
        id: user.id,
        id_empresa: idEmpresa,
        nombre: user.nombre_completo,
        email: user.correo,
        rol: user.rol?.nombre,
        sucursal: user.sucursal?.nombre,
        empresa: empresa?.razon_social || user.empresa?.razon_social || null,
        holding: user.empresa?.holding?.nombre || user.holding?.nombre || null,
        id_vendedor: vendedor?.id_vendedor ?? null,
      },
    };
  }

  private async obtenerEmpresasDelHolding(user: any): Promise<any[]> {
    const idHolding =
      user.holding?.id ||
      user.id_holding ||
      user.empresa?.holding?.id_holding ||
      user.empresa?.id_holding ||
      null;

    if (!idHolding) return [];

    return this.usuariosRepo.manager.query(
      `SELECT id, razon_social, rif FROM empresas
       WHERE id_holding = $1 AND activa = TRUE
       ORDER BY razon_social`,
      [idHolding],
    );
  }
}