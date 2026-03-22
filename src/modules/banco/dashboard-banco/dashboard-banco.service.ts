import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantResolverService } from '../tenant-resolver/tenant-resolver.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { FiltrosDashboardDto } from '../movimientos/dto/movimientos.dto';

@Injectable()
export class DashboardBancoService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantResolver: TenantResolverService,
    private readonly movimientosService: MovimientosService,
  ) {}

  // ─────────────────────────────────────────────
  // DASHBOARD INDIVIDUAL — una empresa
  // ─────────────────────────────────────────────

  async dashboardIndividual(id_empresa: string, filtros: FiltrosDashboardDto) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    const { fecha_desde, fecha_hasta } = filtros;

    const [kpis, porCategoria, porTipoDestino, evolucionMensual, cuentas] = await Promise.all([

      // KPIs principales
      // tiene_distribucion = FALSE: excluye el original distribuido, sus espejos
      // (es_distribucion=TRUE) ya reflejan la porción correcta de la empresa.
      // SIGN(monto): monto_usd se guarda siempre positivo, hay que reconstruir el signo.
      this.dataSource.query(
        `SELECT
           COALESCE(SUM(monto) FILTER (WHERE monto > 0), 0)                   AS total_ingresos,
           COALESCE(SUM(monto) FILTER (WHERE monto < 0), 0)                   AS total_egresos,
           COALESCE(SUM(monto), 0)                                             AS flujo_neto,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto > 0), 0)               AS total_ingresos_usd,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto < 0), 0)               AS total_egresos_usd,
           COALESCE(SUM(monto_usd * SIGN(monto::numeric)), 0)                 AS flujo_neto_usd,
           COUNT(*)::int                                                        AS total_movimientos,
           COUNT(*) FILTER (WHERE id_categoria IS NULL)::int                   AS sin_categoria
         FROM "${schema}".movimiento_bancario
         WHERE id_empresa = $1
           AND tiene_distribucion = FALSE
           ${fecha_desde ? `AND fecha >= '${fecha_desde}'` : ''}
           ${fecha_hasta ? `AND fecha <= '${fecha_hasta}'` : ''}`,
        [id_empresa],
      ),

      // Desglose por categoría
      this.dataSource.query(
        `SELECT
           COALESCE(c.nombre, 'Sin Clasificar') AS categoria,
           COUNT(m.id)::int                     AS cantidad,
           SUM(m.monto)                         AS total_bs,
           SUM(m.monto_usd)                     AS total_usd
         FROM "${schema}".movimiento_bancario m
         LEFT JOIN "${schema}".categoria_movimiento c ON c.id = m.id_categoria
         WHERE m.id_empresa = $1
           AND m.tiene_distribucion = FALSE
           ${fecha_desde ? `AND m.fecha >= '${fecha_desde}'` : ''}
           ${fecha_hasta ? `AND m.fecha <= '${fecha_hasta}'` : ''}
         GROUP BY c.nombre
         ORDER BY ABS(SUM(m.monto)) DESC`,
        [id_empresa],
      ),

      // Desglose por tipo destino
      this.dataSource.query(
        `SELECT
           COALESCE(tipo_destino::text, 'SIN_CLASIFICAR') AS tipo_destino,
           COUNT(*)::int                                   AS cantidad,
           SUM(monto)                                      AS total_bs,
           SUM(monto_usd)                                  AS total_usd
         FROM "${schema}".movimiento_bancario
         WHERE id_empresa = $1
           AND tiene_distribucion = FALSE
           ${fecha_desde ? `AND fecha >= '${fecha_desde}'` : ''}
           ${fecha_hasta ? `AND fecha <= '${fecha_hasta}'` : ''}
         GROUP BY tipo_destino
         ORDER BY ABS(SUM(monto)) DESC`,
        [id_empresa],
      ),

      // Evolución mensual
      this.dataSource.query(
        `SELECT
           TO_CHAR(fecha, 'YYYY-MM')                                           AS mes,
           COALESCE(SUM(monto) FILTER (WHERE monto > 0), 0)                   AS ingresos,
           COALESCE(SUM(monto) FILTER (WHERE monto < 0), 0)                   AS egresos,
           COALESCE(SUM(monto), 0)                                             AS flujo_neto,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto > 0), 0)               AS ingresos_usd,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto < 0), 0)               AS egresos_usd,
           COALESCE(SUM(monto_usd * SIGN(monto::numeric)), 0)                 AS flujo_neto_usd
         FROM "${schema}".movimiento_bancario
         WHERE id_empresa = $1
           AND tiene_distribucion = FALSE
           ${fecha_desde ? `AND fecha >= '${fecha_desde}'` : ''}
           ${fecha_hasta ? `AND fecha <= '${fecha_hasta}'` : ''}
         GROUP BY mes
         ORDER BY mes`,
        [id_empresa],
      ),

      this.movimientosService.resumenPorCuenta(id_empresa, fecha_desde, fecha_hasta),
    ]);

    return {
      tipo: 'INDIVIDUAL',
      id_empresa,
      periodo: { fecha_desde, fecha_hasta },
      kpis: kpis[0],
      por_categoria: porCategoria,
      por_tipo_destino: porTipoDestino,
      evolucion_mensual: evolucionMensual,
      cuentas,
    };
  }

  // ─────────────────────────────────────────────
  // DASHBOARD CONSOLIDADO — todas las empresas del holding
  // ─────────────────────────────────────────────

  async dashboardConsolidado(id_empresa: string, filtros: FiltrosDashboardDto) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    const { fecha_desde, fecha_hasta, empresas } = filtros;

    const filtroEmpresas = empresas && empresas.length > 0
      ? `AND id_empresa = ANY(ARRAY[${empresas.map(e => `'${e}'`).join(',')}])`
      : '';

    // tiene_distribucion = FALSE: excluye originales distribuidos del consolidado.
    // Los espejos (es_distribucion=TRUE) de cada empresa ya suman su porción correcta,
    // evitando doble conteo en la vista del holding.
    const periodoFiltro = `
      ${fecha_desde ? `AND fecha >= '${fecha_desde}'` : ''}
      ${fecha_hasta ? `AND fecha <= '${fecha_hasta}'` : ''}
      AND tiene_distribucion = FALSE
    `;

    const [kpisConsolidados, porEmpresa, evolucionMensual, topCategorias] = await Promise.all([

      // KPIs totales del grupo
      this.dataSource.query(
        `SELECT
           COALESCE(SUM(monto) FILTER (WHERE monto > 0), 0)                   AS total_ingresos,
           COALESCE(SUM(monto) FILTER (WHERE monto < 0), 0)                   AS total_egresos,
           COALESCE(SUM(monto), 0)                                             AS flujo_neto,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto > 0), 0)               AS total_ingresos_usd,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto < 0), 0)               AS total_egresos_usd,
           COALESCE(SUM(monto_usd * SIGN(monto::numeric)), 0)                 AS flujo_neto_usd,
           COUNT(*)::int                                                        AS total_movimientos,
           COALESCE(SUM(monto) FILTER (
             WHERE monto < 0 AND tipo_destino != 'TRANSFERENCIA_INTERNA'
           ), 0) AS egresos_reales
         FROM "${schema}".movimiento_bancario
         WHERE TRUE ${filtroEmpresas} ${periodoFiltro}`,
        [],
      ),

      // KPIs por empresa
      this.dataSource.query(
        `SELECT
           id_empresa,
           COALESCE(SUM(monto) FILTER (WHERE monto > 0), 0)                   AS ingresos,
           COALESCE(SUM(monto) FILTER (WHERE monto < 0), 0)                   AS egresos,
           COALESCE(SUM(monto), 0)                                             AS flujo_neto,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto > 0), 0)               AS ingresos_usd,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto < 0), 0)               AS egresos_usd,
           COALESCE(SUM(monto_usd * SIGN(monto::numeric)), 0)                 AS flujo_neto_usd,
           COUNT(*)::int                                                        AS total_movimientos
         FROM "${schema}".movimiento_bancario
         WHERE TRUE ${filtroEmpresas} ${periodoFiltro}
         GROUP BY id_empresa
         ORDER BY ABS(SUM(monto)) DESC`,
        [],
      ),

      // Evolución mensual consolidada
      this.dataSource.query(
        `SELECT
           TO_CHAR(fecha, 'YYYY-MM')                                           AS mes,
           COALESCE(SUM(monto) FILTER (WHERE monto > 0), 0)                   AS ingresos,
           COALESCE(SUM(monto) FILTER (WHERE monto < 0 AND tipo_destino != 'TRANSFERENCIA_INTERNA'), 0) AS egresos_reales,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto > 0), 0)               AS ingresos_usd,
           COALESCE(SUM(monto_usd * SIGN(monto::numeric)), 0)                 AS flujo_neto_usd
         FROM "${schema}".movimiento_bancario
         WHERE TRUE ${filtroEmpresas} ${periodoFiltro}
         GROUP BY mes
         ORDER BY mes`,
        [],
      ),

      // Top categorías de gasto del grupo
      // tiene_distribucion = FALSE explícito porque periodoFiltro usa alias m.fecha
      this.dataSource.query(
        `SELECT
           COALESCE(c.nombre, 'Sin Clasificar') AS categoria,
           COUNT(m.id)::int                     AS cantidad,
           SUM(m.monto)                         AS total_bs,
           SUM(m.monto_usd)                     AS total_usd
         FROM "${schema}".movimiento_bancario m
         LEFT JOIN "${schema}".categoria_movimiento c ON c.id = m.id_categoria
         WHERE m.monto < 0
           AND m.tipo_destino != 'TRANSFERENCIA_INTERNA'
           AND m.tiene_distribucion = FALSE
           ${filtroEmpresas} ${periodoFiltro.replace(/AND fecha/g, 'AND m.fecha')}
         GROUP BY c.nombre
         ORDER BY SUM(m.monto) ASC
         LIMIT 10`,
        [],
      ),
    ]);

    return {
      tipo: 'CONSOLIDADO',
      periodo: { fecha_desde, fecha_hasta },
      empresas_incluidas: empresas ?? 'TODAS',
      kpis: kpisConsolidados[0],
      por_empresa: porEmpresa,
      evolucion_mensual: evolucionMensual,
      top_categorias_gasto: topCategorias,
    };
  }
}