import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './entities/usuarios.entity';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { Vendedor } from 'src/modules/ventas/vendedores/entities/vendedor.entity';
import { CrearUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,

    @InjectRepository(Rol)
    private readonly rolRepo: Repository<Rol>,

    @InjectRepository(Vendedor)
    private readonly vendedorRepo: Repository<Vendedor>,
  ) {}

  // ======================================================
  // 1. CREAR USUARIO
  // ======================================================
  async crear(dto: CrearUsuarioDto): Promise<Usuario> {
    const existe = await this.usuarioRepo.findOne({ where: { correo: dto.correo } });
    if (existe) throw new ConflictException('Este correo ya está registrado.');

    const nombreRol = dto.rol?.toString() || 'VENDEDOR';
    const rolEntidad = await this.rolRepo.findOne({ where: { nombre: nombreRol } });
    if (!rolEntidad) throw new BadRequestException(`El rol '${nombreRol}' no existe.`);

    const salt = await bcrypt.genSalt();
    const claveHasheada = await bcrypt.hash(dto.clave, salt);

    const nuevoUsuario = this.usuarioRepo.create({
      nombre_completo: dto.nombre_completo,
      correo: dto.correo,
      clave: claveHasheada,
      id_empresa: dto.id_empresa,
      id_sucursal: dto.id_sucursal,
      rol: rolEntidad,
    });

    const guardado = await this.usuarioRepo.save(nuevoUsuario);
    const { ...result } = guardado;
    return result;
  }

  // ======================================================
  // 2. LISTAR POR EMPRESA
  // ======================================================
  async listarPorEmpresa(idEmpresa: string): Promise<any[]> {
    const usuarios = await this.usuarioRepo.find({
      where: { id_empresa: idEmpresa },
      relations: ['rol', 'sucursal', 'empresa'],
      order: { fecha_creacion: 'DESC' }
    });

    // Nunca enviamos la clave al frontend
    return usuarios.map(({ ...u }) => u);
  }

  // ======================================================
  // 3. BUSCAR POR ID
  // ======================================================
  async findOne(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepo.findOne({
      where: { id },
      relations: ['rol', 'sucursal', 'empresa']
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  // ======================================================
  // 4. BUSCAR POR CORREO (Para el Login)
  // ======================================================
  async buscarPorCorreo(correo: string): Promise<Usuario | null> {
    return this.usuarioRepo.createQueryBuilder('usuario')
      .addSelect('usuario.clave')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .leftJoinAndSelect('usuario.empresa', 'empresa')
      .leftJoinAndSelect('empresa.holding', 'holding')
      .leftJoinAndSelect('usuario.sucursal', 'sucursal')
      .where('usuario.correo = :correo', { correo })
      .andWhere('usuario.activo = :activo', { activo: true })
      .getOne();
  }

  // ======================================================
  // 5. ACTUALIZAR
  // ======================================================
  async update(id: string, dto: UpdateUsuarioDto) {
    const usuario = await this.findOne(id);

    if (dto.correo && dto.correo !== usuario.correo) {
      const existe = await this.usuarioRepo.findOne({ where: { correo: dto.correo } });
      if (existe) throw new ConflictException('Este correo ya está en uso.');
    }

    if (dto.clave) {
      const salt = await bcrypt.genSalt();
      dto.clave = await bcrypt.hash(dto.clave, salt);
    }

    if (dto.rol) {
      const rolEntidad = await this.rolRepo.findOne({ where: { nombre: dto.rol.toString() } });
      if (rolEntidad) usuario.rol = rolEntidad;
    }

    const { rol, clave, ...restoDto } = dto;
    Object.assign(usuario, restoDto);
    if (dto.clave) usuario.clave = dto.clave;

    await this.usuarioRepo.save(usuario);
    return this.findOne(id);
  }

  // ======================================================
  // 6. ACTIVAR / DESACTIVAR (Soft delete)
  // ======================================================
  async toggleActivo(id: string): Promise<{ activo: boolean }> {
    const usuario = await this.findOne(id);
    usuario.activo = !usuario.activo;
    await this.usuarioRepo.save(usuario);
    return { activo: usuario.activo };
  }

  // ======================================================
  // 7. MIGRAR VENDEDORES → USUARIOS
  // ======================================================
  async migrarVendedores(idEmpresa: string): Promise<any> {
    const vendedores = await this.vendedorRepo.find({
      where: { id_empresa: idEmpresa }
    });

    if (vendedores.length === 0) {
      return { mensaje: 'No hay vendedores para migrar.', migrados: 0, errores: [] };
    }

    const rolVendedor = await this.rolRepo.findOne({ where: { nombre: 'VENDEDOR' } });
    if (!rolVendedor) throw new BadRequestException("El rol 'VENDEDOR' no existe. Créalo primero.");

    const resultados = { migrados: 0, omitidos: 0, errores: [] as any[] };

    for (const vendedor of vendedores) {
      try {
        // Usamos el campo 'usuario' del vendedor como correo si no tiene formato email
        const correo = vendedor.usuario.includes('@') 
          ? vendedor.usuario 
          : `${vendedor.usuario}@empresa.com`;

        const existe = await this.usuarioRepo.findOne({ where: { correo } });
        if (existe) {
          resultados.omitidos++;
          continue;
        }

        // La contraseña ya está guardada en el vendedor, la re-hasheamos
        // Como no tenemos acceso al texto plano, generamos una temporal
        const claveTemp = `${vendedor.cedula}*Temp`;
        const salt = await bcrypt.genSalt();
        const claveHasheada = await bcrypt.hash(claveTemp, salt);

        const nuevoUsuario = this.usuarioRepo.create({
          nombre_completo: vendedor.nombre_apellido,
          correo,
          clave: claveHasheada,
          id_empresa: idEmpresa,
          rol: rolVendedor,
          activo: true,
        });

        await this.usuarioRepo.save(nuevoUsuario);
        resultados.migrados++;

      } catch (error) {
        resultados.errores.push({ vendedor: vendedor.nombre_apellido, error: error.message });
      }
    }

    return {
      mensaje: `Migración completada. ${resultados.migrados} vendedores migrados.`,
      ...resultados,
      nota: 'La clave temporal de cada usuario es: cédula + *Temp (ej: 12345678*Temp). Pídeles que la cambien.'
    };
  }

  // ======================================================
  // 8. ELIMINAR (Físico - solo para admin)
  // ======================================================
  async remove(id: string) {
    const resultado = await this.usuarioRepo.delete(id);
    if (resultado.affected === 0) throw new NotFoundException('Usuario no encontrado');
    return { message: 'Usuario eliminado' };
  }
}