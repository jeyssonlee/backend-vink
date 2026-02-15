import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { Holding } from '../modules/core/holding/entities/holding.entity';
import { Empresa } from '../modules/core/empresa/entities/empresa.entity';
import { Sucursal } from '../modules/core/sucursal/entities/sucursal.entity';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { Usuario } from '../modules/core/usuarios/entities/usuarios.entity';
import { Almacen } from 'src/modules/inventario/almacenes/entities/almacen.entity';

@Injectable()
export class SemillaService {
  private readonly logger = new Logger(SemillaService.name);

  constructor(
    @InjectRepository(Holding) private readonly holdingRepo: Repository<Holding>,
    @InjectRepository(Empresa) private readonly empresaRepo: Repository<Empresa>,
    @InjectRepository(Sucursal) private readonly sucursalRepo: Repository<Sucursal>,
    @InjectRepository(Rol) private readonly rolRepo: Repository<Rol>,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Almacen) private readonly almacenRepo: Repository<Almacen>,
    private readonly dataSource: DataSource,
  ) {}

  async ejecutarSemilla() {
    this.logger.log('🚀 PASO 0: Limpiando Base de Datos...');

    // USAMOS QUERY RUNNER PARA EJECUTAR SQL PURO (TRUNCATE)
    // Esto evita el error "Empty criteria" y maneja las llaves foráneas con CASCADE
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
        await queryRunner.query(`
            TRUNCATE TABLE 
                usuarios, 
                roles, 
                almacenes, 
                sucursales, 
                empresas, 
                holdings 
            RESTART IDENTITY CASCADE;
        `);
        this.logger.log('✅ Base de datos limpia (TRUNCATE exitoso).');
    } catch (error) {
        this.logger.error('⚠️ Error al limpiar tablas (ignorable si es primera vez): ' + error.message);
    } finally {
        await queryRunner.release();
    }

    try {
        // 1. Holding
        this.logger.log('➡️ PASO 1: Creando Holding...');
        const holding = this.holdingRepo.create({
            nombre: 'GRUPO EMPRESARIAL ERP',
            descripcion: 'Holding Principal',
        });
        const holdingGuardado = await this.holdingRepo.save(holding);
        
        // 2. Empresa
        this.logger.log('➡️ PASO 2: Creando Empresa...');
        const empresa = this.empresaRepo.create({
            razon_social: 'MI EMPRESA C.A.',
            rif: 'J-123456789',
            direccion: "LECHERIA",
            telefono: "0281-2674256",
            holding: holdingGuardado,
            activa: true,
        });
        const empresaGuardada = await this.empresaRepo.save(empresa);

        // 3. Sucursal
        this.logger.log('➡️ PASO 3: Creando Sucursal...');
        const sucursal = this.sucursalRepo.create({
            nombre: 'SUCURSAL PRINCIPAL',
            direccion: 'Av. Bolívar, Edif. Central',
            es_matriz: true,
            empresa: empresaGuardada,
        });
        const sucursalGuardada = await this.sucursalRepo.save(sucursal);

        // 4. Almacenes
        this.logger.log('➡️ PASO 4: Creando Almacenes...');
        const almacenVenta = this.almacenRepo.create({
            nombre: 'ALMACÉN GENERAL (VENTA)',
            es_venta: true,
            empresa: empresaGuardada,
            sucursal: sucursalGuardada, // ✅ Ahora sí tenemos la relación
        });
        await this.almacenRepo.save(almacenVenta);

        const almacenApartado = this.almacenRepo.create({
            nombre: 'ALMACÉN DE APARTADOS',
            es_venta: false,
            empresa: empresaGuardada,
            sucursal: sucursalGuardada, // ✅ Ahora sí tenemos la relación
        });
        await this.almacenRepo.save(almacenApartado);

        // 5. Roles
        this.logger.log('➡️ PASO 5: Creando Roles...');
        const rolAdmin = this.rolRepo.create({
            nombre: 'SUPER_ADMIN',
            descripcion: 'Acceso total',
            permisos: ['TODO'],
        });
        const adminGuardado = await this.rolRepo.save(rolAdmin);

        // 6. Usuario
        this.logger.log('➡️ PASO 6: Creando Usuario...');
        const passwordHash = await bcrypt.hash('123456', 10);
        
        const usuario = this.usuarioRepo.create({
            nombre_completo: 'Administrador del Sistema',
            correo: 'admin@erp.com',
            clave: passwordHash,
            rol: adminGuardado,       
            sucursal: sucursalGuardada, 
            empresa: empresaGuardada,   
            activo: true,
        });
        await this.usuarioRepo.save(usuario);
        this.logger.log('✅ Usuario creado.');

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