import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { NotFoundException } from '@nestjs/common';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

// Entidades
import { Usuario } from './entities/usuarios.entity';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';

// DTOs
import { CrearUsuarioDto } from './dto/create-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepositorio: Repository<Usuario>,

    // ✅ INYECTAMOS EL REPOSITORIO DE ROLES
    @InjectRepository(Rol)
    private readonly rolRepositorio: Repository<Rol>,
  ) {}

  async crear(crearUsuarioDto: CrearUsuarioDto): Promise<Usuario> {
    // Extraemos 'rol' aparte porque en el DTO es un string/enum, 
    // pero la entidad Usuario necesita un OBJETO Rol.
    const { clave, rol, ...datosUsuario } = crearUsuarioDto;

    // 1. Verificar unicidad del correo
    const existe = await this.usuarioRepositorio.findOne({ where: { correo: datosUsuario.correo } });
    if (existe) {
      throw new ConflictException('Este correo ya está registrado.');
    }

    // 2. Buscar el Rol Real en la Base de Datos
    // Si no viene rol, asumimos 'VENDEDOR' por defecto
    const nombreRol = rol ? rol.toString() : 'VENDEDOR';
    
    const rolEntidad = await this.rolRepositorio.findOne({ 
      where: { nombre: nombreRol } 
    });

    if (!rolEntidad) {
      throw new BadRequestException(`El rol '${nombreRol}' no existe en la base de datos. Ejecuta el Seed primero.`);
    }

    // 3. Hashing de contraseña
    const salt = await bcrypt.genSalt();
    const claveHasheada = await bcrypt.hash(clave, salt);

    // 4. Crear el Usuario con la relación correcta
    const nuevoUsuario = this.usuarioRepositorio.create({
      ...datosUsuario,    // Incluye nombre, correo, id_empresa...
      clave: claveHasheada,
      rol: rolEntidad,    // ✅ AQUÍ LA CORRECCIÓN: Asignamos el objeto Rol
    });

    return await this.usuarioRepositorio.save(nuevoUsuario);
  }

  // BUSCAR POR CORREO (Para el Login)
  async buscarPorCorreo(correo: string): Promise<Usuario | null> {
      return this.usuarioRepositorio.createQueryBuilder('usuario')
        .addSelect('usuario.clave') // Seleccionamos la clave explícitamente porque en la entidad tiene select: false
        .leftJoinAndSelect('usuario.rol', 'rol')     // Traemos el Rol
        .leftJoinAndSelect('usuario.empresa', 'empresa') // Traemos la Empresa
        .leftJoinAndSelect('usuario.sucursal', 'sucursal') // Traemos la Sucursal
        .where('usuario.correo = :correo', { correo })
        .andWhere('usuario.activo = :activo', { activo: true }) 
        .getOne();
  }

  // Buscar por ID (Usado por el Controller Admin)
  async findOne(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepositorio.findOne({
      where: { id: id },
      relations: ['rol', 'sucursal', 'empresa']
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async update(id: string, updateUsuarioDto: UpdateUsuarioDto) {
    // ⚠️ Si envían clave nueva, hay que hashearla.
    if (updateUsuarioDto.clave) {
      const salt = await bcrypt.genSalt();
      updateUsuarioDto.clave = await bcrypt.hash(updateUsuarioDto.clave, salt);
    }

    // ⚠️ Si envían rol (string), habría que buscar la entidad Rol de nuevo.
    // Para simplificar y evitar errores rápidos, extraemos el rol si es string
    // y lo manejamos (o lo ignoramos si es complejo por ahora).
    const { rol, ...restoDatos } = updateUsuarioDto;
    
    // Actualizamos datos básicos
    await this.usuarioRepositorio.update(id, restoDatos);

    // Si hay cambio de rol, lo hacemos manual (si es necesario)
    if (rol) {
       const rolEntidad = await this.rolRepositorio.findOne({ where: { nombre: rol.toString() } });
       if (rolEntidad) {
         const usuario = await this.findOne(id);
         usuario.rol = rolEntidad;
         await this.usuarioRepositorio.save(usuario);
       }
    }

    return await this.findOne(id);
  }

  async remove(id: string) {
    const resultado = await this.usuarioRepositorio.delete(id);
    if (resultado.affected === 0) throw new NotFoundException('Usuario no encontrado');
    return { message: 'Usuario eliminado' };
  }
}