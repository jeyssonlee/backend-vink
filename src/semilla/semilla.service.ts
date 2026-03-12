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
      // ── 1. ROLES ────────────────────────────────────────────────────────────
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
          permisos: Object.values(Permiso).filter(
            p => p !== Permiso.EDITAR_EMPRESA && p !== Permiso.EDITAR_TASA_BCV),
        },
        {
          nombre: 'VENTAS',
          descripcion: 'Gestión de ventas, pedidos, clientes e inventario',
          permisos: [
            // Ventas
            Permiso.VER_VENTAS,
            Permiso.CREAR_VENTAS,
            Permiso.VER_REPORTES_VENTAS,
            // Pedidos — ciclo completo de revisión y facturación
            Permiso.VER_PEDIDOS,
            Permiso.CREAR_PEDIDOS,
            Permiso.EDITAR_PEDIDOS,
            Permiso.REVISAR_PEDIDOS,
            Permiso.FACTURAR_PEDIDOS,
            // Clientes
            Permiso.VER_CLIENTES,
            Permiso.CREAR_CLIENTES,
            Permiso.EDITAR_CLIENTES,
            Permiso.VER_PERFIL_CLIENTE,
            // Inventario y productos
            Permiso.VER_INVENTARIO,
            Permiso.VER_PRODUCTOS,
            Permiso.VER_KARDEX,
            Permiso.VER_INVENTARIO_VALORIZADO,
            // Compras y proveedores
            Permiso.VER_COMPRAS,
            Permiso.CREAR_COMPRAS,
            Permiso.VER_PROVEEDORES,
            Permiso.VER_REPORTES_COMPRAS,
            // Almacenes
            Permiso.VER_ALMACENES,
            // Vendedores
            Permiso.VER_VENDEDORES,
            // CXC
            Permiso.VER_CXC,
          ],
        },
        {
          nombre: 'COBRANZAS',
          descripcion: 'Gestión de cobranzas y cuentas por cobrar',
          permisos: [
            Permiso.VER_VENTAS,
            Permiso.VER_CLIENTES,
            Permiso.VER_PERFIL_CLIENTE,
            Permiso.VER_COBRANZAS,
            Permiso.APROBAR_COBRANZAS,
            Permiso.RECHAZAR_COBRANZAS,
            Permiso.VER_CXC,
          ],
        },
        {
          nombre: 'GERENCIA',
          descripcion: 'Ventas, inventarios y reportes — solo lectura',
          permisos: [
            Permiso.VER_VENTAS,
            Permiso.VER_PEDIDOS,
            Permiso.VER_CLIENTES,
            Permiso.VER_PERFIL_CLIENTE,
            Permiso.VER_INVENTARIO,
            Permiso.VER_PRODUCTOS,
            Permiso.VER_KARDEX,
            Permiso.VER_CXC,
            Permiso.VER_COBRANZAS,
            Permiso.VER_PROVEEDORES,
            Permiso.VER_ALMACENES,
            Permiso.VER_VENDEDORES,
          ],
        },
        {
          nombre: 'ALMACEN',
          descripcion: 'Consulta y gestión de inventario y almacenes',
          permisos: [
            Permiso.VER_INVENTARIO,
            Permiso.EDITAR_INVENTARIO,
            Permiso.VER_KARDEX,
            Permiso.VER_ALMACENES,
            Permiso.EDITAR_ALMACENES,
            Permiso.VER_PRODUCTOS,
          ],
        },
        {
          nombre: 'VENDEDOR',
          descripcion: 'Vendedor de campo — web y app móvil',
          permisos: [
            // Pedidos — crear y enviar (no revisar ni facturar)
            Permiso.VER_PEDIDOS,
            Permiso.CREAR_PEDIDOS,
            // Clientes — solo cartera básica, sin perfil 360
            Permiso.VER_CLIENTES,
            // Cobranza — solo ver y registrar
            Permiso.VER_COBRANZAS,
            // Inventario — solo consulta de stock disponible
            Permiso.VER_INVENTARIO,
            // CXC — para ver saldos del cliente
            Permiso.VER_CXC,
          ],
        },
        {
          nombre: 'SUPERVISOR DE VENTAS',
          descripcion: 'Supervisión de vendedores, pedidos y clientes',
          permisos: [
            Permiso.VER_VENTAS,
            Permiso.VER_PEDIDOS,
            Permiso.REVISAR_PEDIDOS,
            Permiso.VER_CLIENTES,
            Permiso.VER_PERFIL_CLIENTE,
            Permiso.VER_VENDEDORES,
            Permiso.VER_INVENTARIO,
            Permiso.VER_CXC,
            Permiso.VER_COBRANZAS,
          ],
        },
      ];

      const rolesGuardados: Record<string, Rol> = {};
      for (const rolData of rolesData) {
        const rol = this.rolRepo.create(rolData);
        rolesGuardados[rolData.nombre] = await this.rolRepo.save(rol);
      }
      this.logger.log(`✅ ${rolesData.length} roles creados.`);

      // ── 2. USUARIO ROOT ──────────────────────────────────────────────────────
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
        credenciales: { user: 'admin@erp.com', pass: '123456' },
      };

    } catch (error) {
      this.logger.error('❌ ERROR FATAL EN SEMILLA:');
      console.error(error);
      throw error;
    }
  }
}
