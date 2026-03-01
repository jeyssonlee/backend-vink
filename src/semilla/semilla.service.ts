import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { Usuario } from '../modules/core/usuarios/entities/usuarios.entity';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Injectable()
export class SemillaService {
  private readonly logger = new Logger(SemillaService.name);

  constructor(
    @InjectRepository(Rol) private readonly rolRepo: Repository<Rol>,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
    private readonly dataSource: DataSource,
  ) {}

  async ejecutarSemilla() {
    this.logger.log('🚀 PASO 0: Limpiando Base de Datos...');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.query(`
        TRUNCATE TABLE 
          usuarios, roles, almacenes, 
          sucursales, empresas, holdings 
        RESTART IDENTITY CASCADE;
      `);
      this.logger.log('✅ Base de datos limpia.');
    } catch (error) {
      this.logger.error('⚠️ Error al limpiar: ' + error.message);
    } finally {
      await queryRunner.release();
    }

    try {
      // 1. ROLES
      this.logger.log('➡️ PASO 1: Creando Roles...');

      const rolesData = [
        {
          nombre: 'ROOT',
          descripcion: 'Acceso total al sistema - Dueño del sistema',
          permisos: Object.values(Permiso),
        },
        {
          nombre: 'SUPER_ADMIN',
          descripcion: 'Dueño de empresa o holding',
          permisos: Object.values(Permiso).filter(p => p !== Permiso.EDITAR_EMPRESA),
        },
        {
          nombre: 'COBRANZAS',
          descripcion: 'Gestión de cobranzas y cuentas por cobrar',
          permisos: [
            Permiso.VER_VENTAS, Permiso.VER_CLIENTES,
            Permiso.VER_COBRANZAS, Permiso.APROBAR_COBRANZAS,
            Permiso.RECHAZAR_COBRANZAS, Permiso.VER_CXC,
          ],
        },
        {
          nombre: 'VENTAS',
          descripcion: 'Compras, ventas, inventario y CXC',
          permisos: [
            Permiso.VER_VENTAS, Permiso.CREAR_VENTAS,
            Permiso.VER_CLIENTES, Permiso.CREAR_CLIENTES, Permiso.EDITAR_CLIENTES,
            Permiso.VER_INVENTARIO, Permiso.VER_COMPRAS, Permiso.CREAR_COMPRAS,
            Permiso.VER_CXC,
          ],
        },
        {
          nombre: 'GERENCIA',
          descripcion: 'Ventas, inventarios y reportes',
          permisos: [
            Permiso.VER_VENTAS, Permiso.VER_INVENTARIO,
            Permiso.VER_CXC, Permiso.VER_REPORTES, Permiso.VER_CLIENTES,
          ],
        },
        {
          nombre: 'ALMACEN',
          descripcion: 'Solo consulta de inventario',
          permisos: [Permiso.VER_INVENTARIO, Permiso.VER_KARDEX],
        },
        {
          nombre: 'VENDEDOR',
          descripcion: 'Vendedor de campo - acceso desde app móvil',
          permisos: [
            Permiso.VER_CLIENTES, Permiso.VER_VENTAS,
            Permiso.VER_CXC, Permiso.VER_COBRANZAS,
            Permiso.CREAR_PEDIDOS, Permiso.VER_PEDIDOS,
          ],
        },
      ];

      const rolesGuardados: Record<string, Rol> = {};
      for (const rolData of rolesData) {
        const rol = this.rolRepo.create(rolData);
        rolesGuardados[rolData.nombre] = await this.rolRepo.save(rol);
      }
      this.logger.log(`✅ ${rolesData.length} roles creados.`);

      // 2. USUARIO ROOT (sin empresa ni sucursal)
      this.logger.log('➡️ PASO 2: Creando Usuario ROOT...');
      const passwordHash = await bcrypt.hash('123456', 10);

      const usuario = this.usuarioRepo.create({
        nombre_completo: 'Administrador del Sistema',
        correo: 'admin@erp.com',
        clave: passwordHash,
        rol: rolesGuardados['ROOT'],
        activo: true,
      });
      await this.usuarioRepo.save(usuario);
      this.logger.log('✅ Usuario ROOT creado.');

      return {
        success: true,
        message: 'SEMILLA EJECUTADA CORRECTAMENTE 🏁',
        credenciales: { user: 'admin@erp.com', pass: '123456' }
      };

    } catch (error) {
      this.logger.error('❌ ERROR FATAL EN SEMILLA:');
      console.error(error);
      throw error;
    }
  }
}