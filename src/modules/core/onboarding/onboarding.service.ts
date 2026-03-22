import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Holding } from '../holding/entities/holding.entity';
import { Empresa } from '../empresa/entities/empresa.entity';
import { Sucursal } from '../sucursal/entities/sucursal.entity';
import { Usuario } from '../usuarios/entities/usuarios.entity';
import { Rol } from '../../auth/roles/entities/rol.entity';
import { Almacen } from '../../inventario/almacenes/entities/almacen.entity';
import { OnboardingEmpresaDto, OnboardingHoldingDto } from './dto/onboarding.dto';
import { SchemaProvisioningService } from 'src/modules/banco/schema-provisioning/schema-provisioning.service';

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(Rol)
    private readonly rolRepo: Repository<Rol>,
    private readonly dataSource: DataSource,
    private readonly schemaProvisioning: SchemaProvisioningService,
  ) {}

  async crearEmpresaSimple(dto: OnboardingEmpresaDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Crear empresa
      const empresa = queryRunner.manager.create(Empresa, {
        razon_social: dto.empresa.razon_social,
        rif: dto.empresa.rif,
        direccion: dto.empresa.direccion,
        telefono: dto.empresa.telefono,
        activa: true,
      });
      const empresaGuardada = await queryRunner.manager.save(empresa);

      // 2. Crear sucursales y almacenes
      for (let i = 0; i < dto.empresa.sucursales.length; i++) {
        const s = dto.empresa.sucursales[i];
        const sucursal = queryRunner.manager.create(Sucursal, {
          nombre: s.nombre,
          direccion: s.direccion,
          telefono: s.telefono,
          es_matriz: i === 0,
          empresa: empresaGuardada,
        });
        const sucursalGuardada = await queryRunner.manager.save(sucursal);

        const almacenesACrear =
          s.almacenes && s.almacenes.length > 0
            ? s.almacenes
            : [{ nombre: 'ALMACÉN GENERAL', es_venta: true }];

        for (const a of almacenesACrear) {
          const almacen = queryRunner.manager.create(Almacen, {
            nombre: a.nombre,
            es_venta: a.es_venta ?? true,
            empresa: empresaGuardada,
            sucursal: sucursalGuardada,
          });
          await queryRunner.manager.save(almacen);
        }
      }

      // 3. Crear usuario SUPER_ADMIN (sin holding — empresa standalone)
      await this.crearAdminUsuario(queryRunner, dto.admin, empresaGuardada, null);

      // 4. Provisionar schema del tenant
      await this.schemaProvisioning.provisionTenant(
        queryRunner,
        'empresa',
        empresaGuardada.id,
      );

      await queryRunner.commitTransaction();

      return {
        success: true,
        mensaje: `Empresa ${empresaGuardada.razon_social} creada correctamente`,
        id_empresa: empresaGuardada.id,
        schema_tenant: SchemaProvisioningService.schemaName('empresa', empresaGuardada.id),
        credenciales: { correo: dto.admin.correo },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error.code === '23505') {
        throw new BadRequestException('El RIF o correo ya existe en el sistema');
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async crearHolding(dto: OnboardingHoldingDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Crear holding
      const holding = queryRunner.manager.create(Holding, {
        nombre: dto.nombre_holding,
        descripcion: dto.descripcion_holding,
      });
      const holdingGuardado = await queryRunner.manager.save(holding);

      // 2. Crear cada empresa con sus sucursales
      let primeraEmpresa: Empresa | null = null;

      for (const empDto of dto.empresas) {
        const empresa = queryRunner.manager.create(Empresa, {
          razon_social: empDto.razon_social,
          rif: empDto.rif,
          direccion: empDto.direccion,
          telefono: empDto.telefono,
          activa: true,
          holding: holdingGuardado,
        });
        const empresaGuardada = await queryRunner.manager.save(empresa);

        if (!primeraEmpresa) primeraEmpresa = empresaGuardada;

        for (let i = 0; i < empDto.sucursales.length; i++) {
          const s = empDto.sucursales[i];
          const sucursal = queryRunner.manager.create(Sucursal, {
            nombre: s.nombre,
            direccion: s.direccion,
            telefono: s.telefono,
            es_matriz: i === 0,
            empresa: empresaGuardada,
          });
          const sucursalGuardada = await queryRunner.manager.save(sucursal);

          const almacenesACrear =
            s.almacenes && s.almacenes.length > 0
              ? s.almacenes
              : [{ nombre: 'ALMACÉN GENERAL', es_venta: true }];

          for (const a of almacenesACrear) {
            const almacen = queryRunner.manager.create(Almacen, {
              nombre: a.nombre,
              es_venta: a.es_venta ?? true,
              empresa: empresaGuardada,
              sucursal: sucursalGuardada,
            });
            await queryRunner.manager.save(almacen);
          }
        }
      }

      // 3. Crear SUPER_ADMIN con id_holding asignado y sin id_empresa
      //    → verá todas las empresas del holding en el selector/switcher
      await this.crearAdminUsuario(queryRunner, dto.admin, null, holdingGuardado);

      // 4. Provisionar schema del holding
      await this.schemaProvisioning.provisionTenant(
        queryRunner,
        'holding',
        holdingGuardado.id_holding,
      );

      await queryRunner.commitTransaction();

      return {
        success: true,
        mensaje: `Holding ${holdingGuardado.nombre} creado con ${dto.empresas.length} empresa(s)`,
        id_holding: holdingGuardado.id_holding,
        schema_tenant: SchemaProvisioningService.schemaName('holding', holdingGuardado.id_holding),
        credenciales: { correo: dto.admin.correo },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error.code === '23505') {
        throw new BadRequestException('El RIF, nombre de holding o correo ya existe');
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async crearAdminUsuario(
    queryRunner: any,
    adminDto: any,
    empresa: Empresa | null,
    holding: Holding | null,
  ) {
    const rol = await this.rolRepo.findOne({ where: { nombre: 'SUPER_ADMIN' } });
    if (!rol) {
      throw new BadRequestException(
        'Rol SUPER_ADMIN no encontrado. Ejecuta la semilla primero.',
      );
    }

    const claveHash = await bcrypt.hash(adminDto.clave, 10);

    const usuario = queryRunner.manager.create(Usuario, {
      nombre_completo: adminDto.nombre_completo,
      correo: adminDto.correo,
      clave: claveHash,
      rol,
      empresa: empresa ?? undefined,
      id_empresa: empresa?.id ?? null,          // ← FK explícito
      holding: holding ?? undefined,
      id_holding: holding?.id_holding ?? null,  // ← FK explícito
      activo: true,
    });

    await queryRunner.manager.save(usuario);
  }
}