import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantResolverService } from '../tenant-resolver/tenant-resolver.service';
import { FiltrosMovimientosDto } from './dto/movimientos.dto';
import { EditarMovimientoDto } from './dto/movimientos.dto';

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

    const [{ total }] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total
       FROM "${schema}".movimiento_bancario m
       WHERE ${where}`,
      valores,
    );

    const movimientos = await this.dataSource.query(
      `SELECT
         m.id, m.fecha, m.concepto, m.referencia,
         m.monto, m.moneda, m.tasa_vigente, m.monto_usd,
         m.tipo_destino, m.es_no_ventas, m.notas,
         m.es_distribucion, m.tiene_distribucion,
         m.created_at,
         c.nombre   AS nombre_categoria,
         s.nombre   AS nombre_subtipo,
         t.nombre   AS nombre_tipo,
         cb.nombre  AS nombre_cuenta,
         cb.banco_key
       FROM "${schema}".movimiento_bancario m
       LEFT JOIN "${schema}".categoria_movimiento c  ON c.id  = m.id_categoria
       LEFT JOIN "${schema}".subtipo_movimiento   s  ON s.id  = m.id_subtipo
       LEFT JOIN "${schema}".tipo_movimiento      t  ON t.id  = m.id_tipo
       LEFT JOIN "${schema}".cuenta_bancaria      cb ON cb.id = m.id_cuenta
       WHERE ${where}
       ORDER BY m.fecha DESC, m.id DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
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

    const condiciones: string[] = [
      'm.id_empresa::text = $1',
      // Excluir originales distribuidos — sus espejos (es_distribucion=TRUE)
      // ya reflejan la porción correcta de cada empresa
      'm.tiene_distribucion = FALSE',
    ];
    const valores: any[] = [id_empresa];
    let idx = 2;

    if (fecha_desde) { condiciones.push(`m.fecha >= $${idx++}`); valores.push(fecha_desde); }
    if (fecha_hasta) { condiciones.push(`m.fecha <= $${idx++}`); valores.push(fecha_hasta); }

    const where = condiciones.join(' AND ');

    const condManuales: string[] = ['mm.id_empresa::text = $1'];
    if (fecha_desde) condManuales.push(`mm.fecha >= $2`);
    if (fecha_hasta) condManuales.push(`mm.fecha <= $${fecha_desde ? 3 : 2}`);
    const whereManuales = condManuales.join(' AND ');

    const cuentas = await this.dataSource.query(
      `SELECT
         cb.id, cb.nombre, cb.numero_cuenta, cb.banco_key, cb.moneda,
         cb.saldo_inicial,

         COUNT(m.id)::int                                          AS total_movimientos,
         COALESCE(SUM(m.monto) FILTER (WHERE m.monto > 0), 0)     AS total_ingresos,
         COALESCE(SUM(m.monto) FILTER (WHERE m.monto < 0), 0)     AS total_egresos,
         COALESCE(SUM(m.monto), 0)                                 AS flujo_neto,
         COALESCE(SUM(m.monto_usd) FILTER (WHERE m.monto > 0), 0) AS total_ingresos_usd,
         COALESCE(SUM(m.monto_usd) FILTER (WHERE m.monto < 0), 0) AS total_egresos_usd,

         COALESCE(man.ingresos_usd, 0) AS manuales_ingresos_usd,
         COALESCE(man.egresos_usd,  0) AS manuales_egresos_usd,

         cb.saldo_inicial
           + COALESCE(SUM(m.monto_usd * SIGN(m.monto::numeric)), 0)
           + COALESCE(man.ingresos_usd, 0)
           - COALESCE(man.egresos_usd,  0)                         AS saldo_actual_usd

       FROM "${schema}".cuenta_bancaria cb

       LEFT JOIN "${schema}".movimiento_bancario m
           ON m.id_cuenta = cb.id AND ${where}

       LEFT JOIN (
         SELECT
           id_cuenta,
           COALESCE(SUM(monto_usd) FILTER (WHERE tipo = 'INGRESO'), 0) AS ingresos_usd,
           COALESCE(SUM(monto_usd) FILTER (WHERE tipo = 'EGRESO'),  0) AS egresos_usd
         FROM "${schema}".movimiento_manual mm
         WHERE ${whereManuales}
         GROUP BY id_cuenta
       ) man ON man.id_cuenta = cb.id

       WHERE cb.id_empresa::text = $1
       GROUP BY cb.id, man.ingresos_usd, man.egresos_usd
       ORDER BY cb.nombre`,
      valores,
    );

    return cuentas;
  }

  async editar(id: number, id_empresa: string, dto: EditarMovimientoDto) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
  
    const [movimiento] = await this.dataSource.query(
      `SELECT id, monto FROM "${schema}".movimiento_bancario WHERE id = $1 AND id_empresa = $2`,
      [id, id_empresa],
    );
    if (!movimiento) throw new NotFoundException(`Movimiento ${id} no encontrado`);
  
    const sets: string[] = [];
    const valores: any[] = [];
    let idx = 1;
  
    if (dto.fecha        !== undefined) { sets.push(`fecha = $${idx++}`);        valores.push(dto.fecha); }
    if (dto.concepto     !== undefined) { sets.push(`concepto = $${idx++}`);     valores.push(dto.concepto); }
    if (dto.tipo_destino !== undefined) { sets.push(`tipo_destino = $${idx++}`); valores.push(dto.tipo_destino); }
    if (dto.id_categoria !== undefined) { sets.push(`id_categoria = $${idx++}`); valores.push(dto.id_categoria); }
    if (dto.id_subtipo   !== undefined) {
      sets.push(`id_subtipo = $${idx++}`);
      valores.push(dto.id_subtipo);
      if (dto.id_subtipo !== null) {
        const [sub] = await this.dataSource.query(
          `SELECT id_tipo FROM "${schema}".subtipo_movimiento WHERE id = $1`,
          [dto.id_subtipo],
        );
        if (sub) { sets.push(`id_tipo = $${idx++}`); valores.push(sub.id_tipo); }
      } else {
        sets.push(`id_tipo = $${idx++}`);
        valores.push(null);
      }
    }
    if (dto.notas        !== undefined) { sets.push(`notas = $${idx++}`);        valores.push(dto.notas); }
    if (dto.es_no_ventas !== undefined) { sets.push(`es_no_ventas = $${idx++}`); valores.push(dto.es_no_ventas); }
    if (dto.tasa_vigente !== undefined) {
      sets.push(`tasa_vigente = $${idx++}`);
      valores.push(dto.tasa_vigente);
      const montoAbs = Math.abs(parseFloat(movimiento.monto));
      const nuevoUsd = dto.tasa_vigente > 0 ? montoAbs / dto.tasa_vigente : null;
      sets.push(`monto_usd = $${idx++}`);
      valores.push(nuevoUsd);
    }
  
    if (sets.length === 0) return this.obtener(id, id_empresa);
  
    await this.dataSource.query(
      `UPDATE "${schema}".movimiento_bancario SET ${sets.join(', ')} WHERE id = $${idx++} AND id_empresa = $${idx++}`,
      [...valores, id, id_empresa],
    );
  
    return this.obtener(id, id_empresa);
  }
}