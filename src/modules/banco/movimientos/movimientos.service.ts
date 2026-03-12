import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantResolverService } from '../tenant-resolver/tenant-resolver.service';
import { FiltrosMovimientosDto } from './dto/movimientos.dto';

@Injectable()
export class MovimientosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  // ─────────────────────────────────────────────
  // LISTADO CON FILTROS
  // ─────────────────────────────────────────────

  async listar(filtros: FiltrosMovimientosDto, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    const condiciones: string[] = ['m.id_empresa = $1'];
    const valores: any[] = [id_empresa];
    let idx = 2;

    if (filtros.fecha_desde) {
      condiciones.push(`m.fecha >= $${idx++}`);
      valores.push(filtros.fecha_desde);
    }
    if (filtros.fecha_hasta) {
      condiciones.push(`m.fecha <= $${idx++}`);
      valores.push(filtros.fecha_hasta);
    }
    if (filtros.id_categoria !== undefined) {
      condiciones.push(`m.id_categoria = $${idx++}`);
      valores.push(filtros.id_categoria);
    }
    if (filtros.tipo_destino) {
      condiciones.push(`m.tipo_destino = $${idx++}`);
      valores.push(filtros.tipo_destino);
    }
    if (filtros.tipo === 'INGRESO') {
      condiciones.push(`m.monto > 0`);
    } else if (filtros.tipo === 'EGRESO') {
      condiciones.push(`m.monto < 0`);
    }

    const where = condiciones.join(' AND ');
    const limite = filtros.limite ?? 50;
    const offset = filtros.offset ?? 0;

    // Total para paginación
    const [{ total }] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total
       FROM "${schema}".movimiento_bancario m
       WHERE ${where}`,
      valores,
    );

    // Datos paginados
    const movimientos = await this.dataSource.query(
      `SELECT
         m.id, m.fecha, m.concepto, m.referencia,
         m.monto, m.moneda, m.tasa_vigente, m.monto_usd,
         m.tipo_destino, m.es_no_ventas, m.notas,
         m.created_at,
         c.nombre  AS nombre_categoria,
         cb.nombre AS nombre_cuenta,
         cb.banco_key
       FROM "${schema}".movimiento_bancario m
       LEFT JOIN "${schema}".categoria_movimiento c  ON c.id  = m.id_categoria
       LEFT JOIN "${schema}".cuenta_bancaria      cb ON cb.id = m.id_cuenta
       WHERE ${where}
       ORDER BY m.fecha DESC, m.id DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...valores, limite, offset],
    );

    return {
      total,
      limite,
      offset,
      movimientos,
    };
  }

  // ─────────────────────────────────────────────
  // DETALLE DE UN MOVIMIENTO
  // ─────────────────────────────────────────────

  async obtener(id: number, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    const [movimiento] = await this.dataSource.query(
      `SELECT
         m.*,
         c.nombre  AS nombre_categoria,
         cb.nombre AS nombre_cuenta,
         cb.banco_key,
         cb.numero_cuenta
       FROM "${schema}".movimiento_bancario m
       LEFT JOIN "${schema}".categoria_movimiento c  ON c.id  = m.id_categoria
       LEFT JOIN "${schema}".cuenta_bancaria      cb ON cb.id = m.id_cuenta
       WHERE m.id = $1 AND m.id_empresa = $2`,
      [id, id_empresa],
    );

    if (!movimiento) throw new NotFoundException(`Movimiento ${id} no encontrado`);

    // Distribuciones si existen
    const distribuciones = await this.dataSource.query(
      `SELECT * FROM "${schema}".movimiento_distribucion WHERE id_movimiento = $1`,
      [id],
    );

    return { ...movimiento, distribuciones };
  }

  // ─────────────────────────────────────────────
  // RESUMEN POR CUENTA — usado por dashboard individual
  // ─────────────────────────────────────────────

  async resumenPorCuenta(id_empresa: string, fecha_desde?: string, fecha_hasta?: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    const condiciones: string[] = ['m.id_empresa = $1'];
    const valores: any[] = [id_empresa];
    let idx = 2;

    if (fecha_desde) { condiciones.push(`m.fecha >= $${idx++}`); valores.push(fecha_desde); }
    if (fecha_hasta) { condiciones.push(`m.fecha <= $${idx++}`); valores.push(fecha_hasta); }

    const where = condiciones.join(' AND ');

    return this.dataSource.query(
      `SELECT
         cb.id, cb.nombre, cb.numero_cuenta, cb.banco_key, cb.moneda,
         COUNT(m.id)::int                                    AS total_movimientos,
         COALESCE(SUM(m.monto) FILTER (WHERE m.monto > 0), 0) AS total_ingresos,
         COALESCE(SUM(m.monto) FILTER (WHERE m.monto < 0), 0) AS total_egresos,
         COALESCE(SUM(m.monto), 0)                            AS flujo_neto,
         COALESCE(SUM(m.monto_usd) FILTER (WHERE m.monto > 0), 0) AS total_ingresos_usd,
         COALESCE(SUM(m.monto_usd) FILTER (WHERE m.monto < 0), 0) AS total_egresos_usd
       FROM "${schema}".cuenta_bancaria cb
       LEFT JOIN "${schema}".movimiento_bancario m
         ON m.id_cuenta = cb.id AND ${where}
       WHERE cb.id_empresa = $1
       GROUP BY cb.id
       ORDER BY cb.nombre`,
      valores,
    );
  }
}