import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantResolverService } from '../tenant-resolver/tenant-resolver.service';
import {
  CrearMovimientoManualDto,
  EditarMovimientoManualDto,
  FiltrosMovimientoManualDto,
} from './dto/movimiento-manual.dto';

@Injectable()
export class MovimientoManualService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  // ─────────────────────────────────────────────
  // CREAR
  // ─────────────────────────────────────────────

  async crear(dto: CrearMovimientoManualDto, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    // Validar que si no es efectivo, debe tener id_cuenta
    if (!dto.es_efectivo && !dto.id_cuenta) {
      throw new BadRequestException('Debe especificar una cuenta bancaria o marcar como efectivo');
    }

    // Validar que si es egreso, debe tener tipo_egreso
    if (dto.tipo === 'EGRESO' && !dto.tipo_egreso) {
      throw new BadRequestException('Los egresos deben tener un tipo de egreso especificado');
    }

    // Calcular monto_bs si viene tasa
    const monto_bs = dto.tasa_vigente
      ? dto.monto_usd * dto.tasa_vigente
      : null;

    const [nuevo] = await this.dataSource.query(
      `INSERT INTO "${schema}".movimiento_manual
         (fecha, tipo, tipo_egreso, id_cuenta, es_efectivo, id_categoria,
          descripcion, monto_usd, tasa_vigente, monto_bs, id_empresa)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        dto.fecha,
        dto.tipo,
        dto.tipo_egreso ?? null,
        dto.id_cuenta ?? null,
        dto.es_efectivo ?? false,
        dto.id_categoria ?? null,
        dto.descripcion ?? null,
        dto.monto_usd,
        dto.tasa_vigente ?? null,
        monto_bs,
        id_empresa,
      ],
    );

    return this.obtener(nuevo.id, id_empresa);
  }

  // ─────────────────────────────────────────────
  // LISTAR CON FILTROS
  // ─────────────────────────────────────────────

  async listar(filtros: FiltrosMovimientoManualDto, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    const condiciones: string[] = ['m.id_empresa = $1'];
    const valores: any[] = [id_empresa];
    let idx = 2;

    if (filtros.fecha_desde) { condiciones.push(`m.fecha >= $${idx++}`); valores.push(filtros.fecha_desde); }
    if (filtros.fecha_hasta) { condiciones.push(`m.fecha <= $${idx++}`); valores.push(filtros.fecha_hasta); }
    if (filtros.tipo)        { condiciones.push(`m.tipo = $${idx++}`);   valores.push(filtros.tipo); }
    if (filtros.tipo_egreso) { condiciones.push(`m.tipo_egreso = $${idx++}`); valores.push(filtros.tipo_egreso); }
    if (filtros.id_categoria !== undefined) {
      condiciones.push(`m.id_categoria = $${idx++}`);
      valores.push(filtros.id_categoria);
    }

    const where  = condiciones.join(' AND ');
    const limite = filtros.limite ?? 50;
    const offset = filtros.offset ?? 0;

    const [{ total }] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total
       FROM "${schema}".movimiento_manual m
       WHERE ${where}`,
      valores,
    );

    const movimientos = await this.dataSource.query(
      `SELECT
         m.*,
         c.nombre  AS nombre_categoria,
         cb.nombre AS nombre_cuenta,
         cb.banco_key
       FROM "${schema}".movimiento_manual m
       LEFT JOIN "${schema}".categoria_movimiento c  ON c.id = m.id_categoria
       LEFT JOIN "${schema}".cuenta_bancaria      cb ON cb.id = m.id_cuenta
       WHERE ${where}
       ORDER BY m.fecha DESC, m.id DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...valores, limite, offset],
    );

    return { total, limite, offset, movimientos };
  }

  // ─────────────────────────────────────────────
  // OBTENER UNO
  // ─────────────────────────────────────────────

  async obtener(id: number, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    const [movimiento] = await this.dataSource.query(
      `SELECT
         m.*,
         c.nombre  AS nombre_categoria,
         cb.nombre AS nombre_cuenta,
         cb.banco_key
       FROM "${schema}".movimiento_manual m
       LEFT JOIN "${schema}".categoria_movimiento c  ON c.id = m.id_categoria
       LEFT JOIN "${schema}".cuenta_bancaria      cb ON cb.id = m.id_cuenta
       WHERE m.id = $1 AND m.id_empresa = $2`,
      [id, id_empresa],
    );

    if (!movimiento) throw new NotFoundException(`Movimiento manual ${id} no encontrado`);
    return movimiento;
  }

  // ─────────────────────────────────────────────
  // EDITAR
  // ─────────────────────────────────────────────

  async editar(id: number, dto: EditarMovimientoManualDto, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    await this.obtener(id, id_empresa);

    const sets: string[] = [];
    const valores: any[] = [];
    let idx = 1;

    if (dto.fecha        !== undefined) { sets.push(`fecha = $${idx++}`);        valores.push(dto.fecha); }
    if (dto.tipo         !== undefined) { sets.push(`tipo = $${idx++}`);         valores.push(dto.tipo); }
    if (dto.tipo_egreso  !== undefined) { sets.push(`tipo_egreso = $${idx++}`);  valores.push(dto.tipo_egreso); }
    if (dto.id_cuenta    !== undefined) { sets.push(`id_cuenta = $${idx++}`);    valores.push(dto.id_cuenta); }
    if (dto.es_efectivo  !== undefined) { sets.push(`es_efectivo = $${idx++}`);  valores.push(dto.es_efectivo); }
    if (dto.id_categoria !== undefined) { sets.push(`id_categoria = $${idx++}`); valores.push(dto.id_categoria); }
    if (dto.descripcion  !== undefined) { sets.push(`descripcion = $${idx++}`);  valores.push(dto.descripcion); }

    if (dto.monto_usd !== undefined || dto.tasa_vigente !== undefined) {
      // Obtener valores actuales para recalcular
      const actual = await this.obtener(id, id_empresa);
      const monto_usd    = dto.monto_usd    ?? parseFloat(actual.monto_usd)
      const tasa_vigente = dto.tasa_vigente ?? parseFloat(actual.tasa_vigente)

      if (dto.monto_usd    !== undefined) { sets.push(`monto_usd = $${idx++}`);    valores.push(monto_usd); }
      if (dto.tasa_vigente !== undefined) { sets.push(`tasa_vigente = $${idx++}`); valores.push(tasa_vigente); }

      if (tasa_vigente) {
        const monto_bs = monto_usd * tasa_vigente;
        sets.push(`monto_bs = $${idx++}`);
        valores.push(monto_bs);
      }
    }

    if (sets.length === 0) return this.obtener(id, id_empresa);

    sets.push(`updated_at = NOW()`);
    valores.push(id, id_empresa);

    await this.dataSource.query(
      `UPDATE "${schema}".movimiento_manual
       SET ${sets.join(', ')}
       WHERE id = $${idx++} AND id_empresa = $${idx++}`,
      valores,
    );

    return this.obtener(id, id_empresa);
  }

  // ─────────────────────────────────────────────
  // ELIMINAR
  // ─────────────────────────────────────────────

  async eliminar(id: number, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    await this.obtener(id, id_empresa);

    await this.dataSource.query(
      `DELETE FROM "${schema}".movimiento_manual WHERE id = $1 AND id_empresa = $2`,
      [id, id_empresa],
    );

    return { mensaje: 'Movimiento eliminado correctamente' };
  }

  // ─────────────────────────────────────────────
  // RESUMEN — para dashboard y reportes
  // ─────────────────────────────────────────────

  async resumen(id_empresa: string, fecha_desde?: string, fecha_hasta?: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    const condiciones: string[] = ['id_empresa = $1'];
    const valores: any[] = [id_empresa];
    let idx = 2;

    if (fecha_desde) { condiciones.push(`fecha >= $${idx++}`); valores.push(fecha_desde); }
    if (fecha_hasta) { condiciones.push(`fecha <= $${idx++}`); valores.push(fecha_hasta); }

    const where = condiciones.join(' AND ');

    const [result] = await this.dataSource.query(
      `SELECT
         -- Ingresos manuales
         COALESCE(SUM(monto_usd) FILTER (WHERE tipo = 'INGRESO'), 0)              AS ingresos_usd,
         COALESCE(SUM(monto_bs)  FILTER (WHERE tipo = 'INGRESO'), 0)              AS ingresos_bs,
         -- Egresos operativos (gastos reales)
         COALESCE(SUM(monto_usd) FILTER (
           WHERE tipo = 'EGRESO' AND tipo_egreso = 'GASTO_OPERATIVO'
         ), 0)                                                                     AS egresos_operativos_usd,
         -- Compras de inventario (inversión, no gasto)
         COALESCE(SUM(monto_usd) FILTER (
           WHERE tipo = 'EGRESO' AND tipo_egreso = 'COMPRA_INVENTARIO'
         ), 0)                                                                     AS compras_inventario_usd,
         -- Inversiones en activos
         COALESCE(SUM(monto_usd) FILTER (
           WHERE tipo = 'EGRESO' AND tipo_egreso = 'INVERSION_ACTIVOS'
         ), 0)                                                                     AS inversiones_usd,
         -- Total egresos
         COALESCE(SUM(monto_usd) FILTER (WHERE tipo = 'EGRESO'), 0)               AS egresos_usd,
         COUNT(*)::int                                                             AS total_movimientos
       FROM "${schema}".movimiento_manual
       WHERE ${where}`,
      valores,
    );

    return result;
  }
}