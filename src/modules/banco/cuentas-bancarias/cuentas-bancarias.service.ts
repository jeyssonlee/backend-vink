import {
    Injectable,
    BadRequestException,
    NotFoundException,
  } from '@nestjs/common';
  import { DataSource } from 'typeorm';
  import { TenantResolverService } from '../tenant-resolver/tenant-resolver.service';
  import { CrearCuentaBancariaDto, ActualizarCuentaBancariaDto } from './dto/cuenta-bancaria.dto';
  
  @Injectable()
  export class CuentasBancariasService {
    constructor(
      private readonly dataSource: DataSource,
      private readonly tenantResolver: TenantResolverService,
    ) {}
  
    // ─────────────────────────────────────────────
    // LISTAR
    // ─────────────────────────────────────────────
  
    async listar(id_empresa: string) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
  
      const cuentas = await this.dataSource.query(
        `SELECT * FROM "${schema}".cuenta_bancaria
         WHERE id_empresa = $1
         ORDER BY moneda, nombre`,
        [id_empresa],
      );
  
      return cuentas;
    }
  
    async listarTodas(id_empresa: string) {
      // ROOT puede ver todas las cuentas del schema sin filtrar por empresa
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
  
      const cuentas = await this.dataSource.query(
        `SELECT * FROM "${schema}".cuenta_bancaria
         ORDER BY id_empresa, moneda, nombre`,
      );
  
      return cuentas;
    }
  
    // ─────────────────────────────────────────────
    // OBTENER UNA
    // ─────────────────────────────────────────────
  
    async obtener(id: number, id_empresa: string) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
  
      const [cuenta] = await this.dataSource.query(
        `SELECT * FROM "${schema}".cuenta_bancaria WHERE id = $1 AND id_empresa = $2`,
        [id, id_empresa],
      );
  
      if (!cuenta) {
        throw new NotFoundException(`Cuenta bancaria ${id} no encontrada`);
      }
  
      return cuenta;
    }
  
    // ─────────────────────────────────────────────
    // CREAR
    // ─────────────────────────────────────────────
  
    async crear(dto: CrearCuentaBancariaDto, id_empresa: string) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
  
      // Verificar unicidad numero_cuenta por empresa
      const [existente] = await this.dataSource.query(
        `SELECT id FROM "${schema}".cuenta_bancaria
         WHERE numero_cuenta = $1 AND id_empresa = $2`,
        [dto.numero_cuenta, id_empresa],
      );
  
      if (existente) {
        throw new BadRequestException(
          `Ya existe una cuenta con el número ${dto.numero_cuenta} para esta empresa`,
        );
      }
  
      const [nueva] = await this.dataSource.query(
        `INSERT INTO "${schema}".cuenta_bancaria
           (nombre, numero_cuenta, moneda, banco_key, id_empresa, saldo_inicial)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          dto.nombre,
          dto.numero_cuenta,
          dto.moneda,
          dto.banco_key,
          id_empresa,
          dto.saldo_inicial ?? 0,
        ],
      );
  
      return nueva;
    }
  
    // ─────────────────────────────────────────────
    // ACTUALIZAR
    // ─────────────────────────────────────────────
  
    async actualizar(id: number, dto: ActualizarCuentaBancariaDto, id_empresa: string) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
  
      // Verificar que existe y pertenece a la empresa
      await this.obtener(id, id_empresa);
  
      const campos: string[] = [];
      const valores: any[] = [];
      let idx = 1;
  
      if (dto.nombre !== undefined) {
        campos.push(`nombre = $${idx++}`);
        valores.push(dto.nombre);
      }
      if (dto.activa !== undefined) {
        campos.push(`activa = $${idx++}`);
        valores.push(dto.activa);
      }
      if (dto.banco_key !== undefined) {
        campos.push(`banco_key = $${idx++}`);
        valores.push(dto.banco_key);
      }
  
      if (campos.length === 0) {
        throw new BadRequestException('No se enviaron campos para actualizar');
      }
  
      campos.push(`updated_at = NOW()`);
      valores.push(id, id_empresa);
  
      const [actualizada] = await this.dataSource.query(
        `UPDATE "${schema}".cuenta_bancaria
         SET ${campos.join(', ')}
         WHERE id = $${idx++} AND id_empresa = $${idx}
         RETURNING *`,
        valores,
      );
  
      return actualizada;
    }
  
    // ─────────────────────────────────────────────
    // DESACTIVAR (soft delete — nunca se borra una cuenta con movimientos)
    // ─────────────────────────────────────────────
  
    async desactivar(id: number, id_empresa: string) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
  
      await this.obtener(id, id_empresa);
  
      // Verificar si tiene movimientos registrados
      const [{ total }] = await this.dataSource.query(
        `SELECT COUNT(*) AS total FROM "${schema}".movimiento_bancario
         WHERE id_cuenta = $1`,
        [id],
      );
  
      if (parseInt(total) > 0) {
        // Tiene movimientos — solo desactivar, nunca eliminar
        const [desactivada] = await this.dataSource.query(
          `UPDATE "${schema}".cuenta_bancaria
           SET activa = FALSE, updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [id],
        );
        return {
          mensaje: 'Cuenta desactivada. No se puede eliminar porque tiene movimientos registrados.',
          cuenta: desactivada,
        };
      }
  
      // Sin movimientos — eliminar físicamente
      await this.dataSource.query(
        `DELETE FROM "${schema}".cuenta_bancaria WHERE id = $1`,
        [id],
      );
  
      return { mensaje: 'Cuenta eliminada correctamente' };
    }
  }