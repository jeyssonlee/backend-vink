import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantResolverService } from '../tenant-resolver/tenant-resolver.service';
import {
  FiltrosReporteDto,
  FiltrosTopGastosDto,
  FiltrosComparativaDto,
} from './dto/reportes-banco.dto';

@Injectable()
export class ReportesBancoService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  // ─────────────────────────────────────────────
  // 1. FLUJO DE CAJA POR PERÍODO
  // ─────────────────────────────────────────────

  async flujoDeCaja(id_empresa: string, filtros: FiltrosReporteDto) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    const { fecha_desde, fecha_hasta } = filtros;

    const periodoFiltro = this.buildPeriodoFiltro(fecha_desde, fecha_hasta);

    const [resumenGeneral, porMes, porSemana] = await Promise.all([

      // Resumen total del período
      this.dataSource.query(
        `SELECT
           MIN(fecha)                                             AS fecha_inicio,
           MAX(fecha)                                            AS fecha_fin,
           COUNT(*)::int                                         AS total_movimientos,
           COALESCE(SUM(monto) FILTER (WHERE monto > 0), 0)     AS total_ingresos,
           COALESCE(SUM(monto) FILTER (WHERE monto < 0), 0)     AS total_egresos,
           COALESCE(SUM(monto), 0)                              AS flujo_neto,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto > 0), 0) AS total_ingresos_usd,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto < 0), 0) AS total_egresos_usd,
           COALESCE(SUM(monto_usd), 0)                          AS flujo_neto_usd
         FROM "${schema}".movimiento_bancario
         WHERE id_empresa = $1 ${periodoFiltro}`,
        [id_empresa],
      ),

      // Desglose mensual
      this.dataSource.query(
        `SELECT
           TO_CHAR(fecha, 'YYYY-MM')                             AS mes,
           TO_CHAR(DATE_TRUNC('month', fecha), 'Mon YYYY')       AS mes_label,
           COUNT(*)::int                                         AS movimientos,
           COALESCE(SUM(monto) FILTER (WHERE monto > 0), 0)     AS ingresos,
           COALESCE(SUM(monto) FILTER (WHERE monto < 0), 0)     AS egresos,
           COALESCE(SUM(monto), 0)                              AS flujo_neto,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto > 0), 0) AS ingresos_usd,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto < 0), 0) AS egresos_usd
         FROM "${schema}".movimiento_bancario
         WHERE id_empresa = $1 ${periodoFiltro}
         GROUP BY mes, mes_label
         ORDER BY mes`,
        [id_empresa],
      ),

      // Desglose semanal
      this.dataSource.query(
        `SELECT
           TO_CHAR(DATE_TRUNC('week', fecha), 'YYYY-MM-DD')      AS semana_inicio,
           COUNT(*)::int                                         AS movimientos,
           COALESCE(SUM(monto) FILTER (WHERE monto > 0), 0)     AS ingresos,
           COALESCE(SUM(monto) FILTER (WHERE monto < 0), 0)     AS egresos,
           COALESCE(SUM(monto), 0)                              AS flujo_neto
         FROM "${schema}".movimiento_bancario
         WHERE id_empresa = $1 ${periodoFiltro}
         GROUP BY semana_inicio
         ORDER BY semana_inicio`,
        [id_empresa],
      ),
    ]);

    return {
      reporte: 'FLUJO_DE_CAJA',
      periodo: { fecha_desde, fecha_hasta },
      resumen: resumenGeneral[0],
      por_mes: porMes,
      por_semana: porSemana,
    };
  }

  // ─────────────────────────────────────────────
  // 2. TOP GASTOS POR CATEGORÍA
  // ─────────────────────────────────────────────

  async topGastos(id_empresa: string, filtros: FiltrosTopGastosDto) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    const { fecha_desde, fecha_hasta, limite = 10 } = filtros;
    const periodoFiltro = this.buildPeriodoFiltro(fecha_desde, fecha_hasta);

    const [porCategoria, porTipoDestino, top10Movimientos] = await Promise.all([

      // Gastos agrupados por categoría
      this.dataSource.query(
        `SELECT
           COALESCE(c.nombre, 'Sin Clasificar')           AS categoria,
           COUNT(m.id)::int                               AS cantidad,
           SUM(ABS(m.monto))                              AS total_bs,
           COALESCE(SUM(ABS(m.monto_usd)), 0)             AS total_usd,
           ROUND(
             SUM(ABS(m.monto)) * 100.0 /
             NULLIF(SUM(SUM(ABS(m.monto))) OVER (), 0), 2
           )                                              AS porcentaje
         FROM "${schema}".movimiento_bancario m
         LEFT JOIN "${schema}".categoria_movimiento c ON c.id = m.id_categoria
         WHERE m.id_empresa = $1
           AND m.monto < 0
           AND m.tipo_destino != 'TRANSFERENCIA_INTERNA'
           ${periodoFiltro}
         GROUP BY c.nombre
         ORDER BY total_bs DESC
         LIMIT $2`,
        [id_empresa, limite],
      ),

      // Gastos agrupados por tipo destino
      this.dataSource.query(
        `SELECT
           COALESCE(tipo_destino::text, 'SIN_CLASIFICAR') AS tipo_destino,
           COUNT(*)::int                                   AS cantidad,
           SUM(ABS(monto))                                 AS total_bs,
           COALESCE(SUM(ABS(monto_usd)), 0)                AS total_usd
         FROM "${schema}".movimiento_bancario
         WHERE id_empresa = $1
           AND monto < 0
           AND tipo_destino != 'TRANSFERENCIA_INTERNA'
           ${periodoFiltro}
         GROUP BY tipo_destino
         ORDER BY total_bs DESC`,
        [id_empresa],
      ),

      // Top 10 movimientos de mayor monto
      this.dataSource.query(
        `SELECT
           m.id, m.fecha, m.concepto, m.referencia,
           ABS(m.monto) AS monto_bs,
           ABS(m.monto_usd) AS monto_usd,
           m.tipo_destino,
           c.nombre AS categoria,
           cb.nombre AS cuenta
         FROM "${schema}".movimiento_bancario m
         LEFT JOIN "${schema}".categoria_movimiento c  ON c.id  = m.id_categoria
         LEFT JOIN "${schema}".cuenta_bancaria      cb ON cb.id = m.id_cuenta
         WHERE m.id_empresa = $1
           AND m.monto < 0
           AND m.tipo_destino != 'TRANSFERENCIA_INTERNA'
           ${periodoFiltro}
         ORDER BY ABS(m.monto) DESC
         LIMIT 10`,
        [id_empresa],
      ),
    ]);

    return {
      reporte: 'TOP_GASTOS',
      periodo: { fecha_desde, fecha_hasta },
      por_categoria: porCategoria,
      por_tipo_destino: porTipoDestino,
      top_10_movimientos: top10Movimientos,
    };
  }

  // ─────────────────────────────────────────────
  // 3. MOVIMIENTOS SIN CLASIFICAR
  // ─────────────────────────────────────────────

  async sinClasificar(id_empresa: string, filtros: FiltrosReporteDto) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    const { fecha_desde, fecha_hasta } = filtros;
    const periodoFiltro = this.buildPeriodoFiltro(fecha_desde, fecha_hasta);

    const [resumen, movimientos] = await Promise.all([

      this.dataSource.query(
        `SELECT
           COUNT(*)::int                                         AS total,
           COUNT(*) FILTER (WHERE monto > 0)::int               AS ingresos,
           COUNT(*) FILTER (WHERE monto < 0)::int               AS egresos,
           COALESCE(SUM(ABS(monto)), 0)                         AS monto_total_bs,
           COALESCE(SUM(ABS(monto_usd)), 0)                     AS monto_total_usd
         FROM "${schema}".movimiento_bancario
         WHERE id_empresa = $1
           AND id_categoria IS NULL
           ${periodoFiltro}`,
        [id_empresa],
      ),

      this.dataSource.query(
        `SELECT
           m.id, m.fecha, m.concepto, m.referencia,
           m.monto, m.monto_usd, m.tipo_destino,
           cb.nombre AS cuenta, cb.banco_key
         FROM "${schema}".movimiento_bancario m
         LEFT JOIN "${schema}".cuenta_bancaria cb ON cb.id = m.id_cuenta
         WHERE m.id_empresa = $1
           AND m.id_categoria IS NULL
           ${periodoFiltro}
         ORDER BY m.fecha DESC`,
        [id_empresa],
      ),
    ]);

    return {
      reporte: 'SIN_CLASIFICAR',
      periodo: { fecha_desde, fecha_hasta },
      resumen: resumen[0],
      movimientos,
    };
  }

  // ─────────────────────────────────────────────
  // 4. COMPARATIVA ENTRE EMPRESAS DEL GRUPO
  // ─────────────────────────────────────────────

  async comparativaEmpresas(id_empresa: string, filtros: FiltrosComparativaDto) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    const { fecha_desde, fecha_hasta, empresas } = filtros;
    const periodoFiltro = this.buildPeriodoFiltro(fecha_desde, fecha_hasta);

    const filtroEmpresas = empresas && empresas.length > 0
      ? `AND id_empresa = ANY(ARRAY[${empresas.map(e => `'${e}'`).join(',')}])`
      : '';

    const [porEmpresa, porEmpresaCategoria, transferenciasInternas] = await Promise.all([

      // KPIs por empresa
      this.dataSource.query(
        `SELECT
           id_empresa,
           COUNT(*)::int                                         AS total_movimientos,
           COALESCE(SUM(monto) FILTER (WHERE monto > 0), 0)     AS ingresos,
           COALESCE(SUM(monto) FILTER (WHERE monto < 0 AND tipo_destino != 'TRANSFERENCIA_INTERNA'), 0) AS egresos_reales,
           COALESCE(SUM(monto), 0)                              AS flujo_neto,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto > 0), 0) AS ingresos_usd,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto < 0 AND tipo_destino != 'TRANSFERENCIA_INTERNA'), 0) AS egresos_usd
         FROM "${schema}".movimiento_bancario
         WHERE TRUE ${filtroEmpresas} ${periodoFiltro}
         GROUP BY id_empresa
         ORDER BY ingresos DESC`,
        [],
      ),

      // Gastos por categoría desglosado por empresa
      this.dataSource.query(
        `SELECT
           m.id_empresa,
           COALESCE(c.nombre, 'Sin Clasificar') AS categoria,
           COUNT(m.id)::int                     AS cantidad,
           SUM(ABS(m.monto))                    AS total_bs,
           COALESCE(SUM(ABS(m.monto_usd)), 0)   AS total_usd
         FROM "${schema}".movimiento_bancario m
         LEFT JOIN "${schema}".categoria_movimiento c ON c.id = m.id_categoria
         WHERE m.monto < 0
           AND m.tipo_destino != 'TRANSFERENCIA_INTERNA'
           ${filtroEmpresas} ${periodoFiltro.replace(/AND fecha/g, 'AND m.fecha')}
         GROUP BY m.id_empresa, c.nombre
         ORDER BY m.id_empresa, total_bs DESC`,
        [],
      ),

      // Transferencias internas entre empresas del grupo
      this.dataSource.query(
        `SELECT
           id_empresa,
           COUNT(*)::int        AS cantidad,
           SUM(ABS(monto))      AS monto_total_bs,
           SUM(ABS(monto_usd))  AS monto_total_usd
         FROM "${schema}".movimiento_bancario
         WHERE tipo_destino = 'TRANSFERENCIA_INTERNA'
           ${filtroEmpresas} ${periodoFiltro}
         GROUP BY id_empresa`,
        [],
      ),
    ]);

    return {
      reporte: 'COMPARATIVA_EMPRESAS',
      periodo: { fecha_desde, fecha_hasta },
      empresas_incluidas: empresas ?? 'TODAS',
      por_empresa: porEmpresa,
      gastos_por_empresa_categoria: porEmpresaCategoria,
      transferencias_internas: transferenciasInternas,
    };
  }

  // ─────────────────────────────────────────────
  // 5. HISTORIAL DE IMPORTACIONES
  // ─────────────────────────────────────────────

  async historialImportaciones(id_empresa: string, filtros: FiltrosReporteDto) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    const { fecha_desde, fecha_hasta } = filtros;

    const condiciones: string[] = [];
    const valores: any[] = [];
    let idx = 1;

    if (fecha_desde) { condiciones.push(`i.created_at::date >= $${idx++}`); valores.push(fecha_desde); }
    if (fecha_hasta) { condiciones.push(`i.created_at::date <= $${idx++}`); valores.push(fecha_hasta); }

    const where = condiciones.length > 0 ? `AND ${condiciones.join(' AND ')}` : '';

    const importaciones = await this.dataSource.query(
      `SELECT
         i.id,
         i.nombre_archivo,
         i.banco_key,
         i.estado,
         i.total_filas,
         i.filas_nuevas,
         i.filas_duplicadas,
         i.created_at,
         i.updated_at,
         cb.nombre        AS nombre_cuenta,
         cb.numero_cuenta,
         cb.banco_key     AS banco_cuenta
       FROM "${schema}".importacion_bancaria i
       JOIN "${schema}".cuenta_bancaria cb ON cb.id = i.id_cuenta
       WHERE TRUE ${where}
       ORDER BY i.created_at DESC`,
      valores,
    );

    const [resumen] = await this.dataSource.query(
      `SELECT
         COUNT(*)::int                                                AS total,
         COUNT(*) FILTER (WHERE estado = 'CONSOLIDADO')::int         AS consolidadas,
         COUNT(*) FILTER (WHERE estado = 'EN_REVISION')::int         AS en_revision,
         COUNT(*) FILTER (WHERE estado = 'CANCELADO')::int           AS canceladas,
         COALESCE(SUM(filas_nuevas), 0)::int                         AS total_movimientos_importados,
         COALESCE(SUM(filas_duplicadas), 0)::int                     AS total_duplicados_detectados
       FROM "${schema}".importacion_bancaria i
       WHERE TRUE ${where}`,
      valores,
    );

    return {
      reporte: 'HISTORIAL_IMPORTACIONES',
      periodo: { fecha_desde, fecha_hasta },
      resumen,
      importaciones,
    };
  }

  // ─────────────────────────────────────────────
  // HELPER
  // ─────────────────────────────────────────────

  private buildPeriodoFiltro(fecha_desde?: string, fecha_hasta?: string): string {
    const partes: string[] = [];
    if (fecha_desde) partes.push(`AND fecha >= '${fecha_desde}'`);
    if (fecha_hasta) partes.push(`AND fecha <= '${fecha_hasta}'`);
    return partes.join(' ');
  }
}