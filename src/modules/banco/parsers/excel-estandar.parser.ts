import { IBankParser, ResultadoParser, MovimientoParsado, ErrorParser } from './interfaces/bank-parser.interface';
import * as XLSX from 'xlsx';

/**
 * Parser para el formato estándar de importación en Excel (.xlsx)
 *
 * Columnas esperadas en la fila 1 (orden no importa):
 *   FECHA | REFERENCIA | CONCEPTO | DEBITO | CREDITO | BANCO ORIGEN | EMPRESA
 *
 * Reglas de negocio:
 *   - DEBITO > 0  → EGRESO  (monto negativo en el sistema)
 *   - CREDITO > 0 → INGRESO (monto positivo en el sistema)
 *   - Solo una de las dos columnas debe tener valor por fila
 *   - Fechas aceptadas: Date de Excel, serial numérico, string DD/MM/YYYY o DD/MM/YY
 *   - Montos aceptados: número Excel o string con formato venezolano "1.234,56"
 *
 * Para agregar este parser al sistema:
 *   1. Este archivo ya implementa IBankParser ✓
 *   2. Registrarlo en bank-parser.registry.ts ✓ (ya incluido)
 *   3. Instalar dependencia: npm install xlsx
 */
export class ExcelEstandarParser implements IBankParser {
  readonly banco_key = 'EXCEL_ESTANDAR';

  private readonly COLUMNAS_REQUERIDAS = [
    'FECHA',
    'REFERENCIA',
    'CONCEPTO',
    'DEBITO',
    'CREDITO',
    'BANCO ORIGEN',
  ];

  // ─────────────────────────────────────────────
  // DETECCIÓN AUTOMÁTICA
  // ─────────────────────────────────────────────

  detectar(contenido: Buffer | string): boolean {
    try {
      const wb = this.leerWorkbook(contenido);
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) return false;

      const [primeraFila] = XLSX.utils.sheet_to_json<any[]>(ws, {
        header: 1,
        range: 0,
        defval: '',
      });

      if (!Array.isArray(primeraFila)) return false;

      const headersNorm = primeraFila.map((h: any) =>
        String(h ?? '').trim().toUpperCase(),
      );

      return this.COLUMNAS_REQUERIDAS.every((col) => headersNorm.includes(col));
    } catch {
      // No es un xlsx válido o no tiene el formato esperado
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // PARSEO PRINCIPAL
  // ─────────────────────────────────────────────

  async parsear(contenido: Buffer | string): Promise<ResultadoParser> {
    const wb = this.leerWorkbook(contenido);
    const ws = wb.Sheets[wb.SheetNames[0]];

    // cellDates:true en leerWorkbook hace que XLSX convierta seriales a Date.
    // raw:true mantiene números como números y Date como Date.
    const filas = XLSX.utils.sheet_to_json<any[]>(ws, {
      header: 1,
      defval: '',
      raw: true,
    });

    if (filas.length < 2) {
      return {
        banco_key: this.banco_key,
        movimientos: [],
        errores: [{ fila: 0, motivo: 'El archivo no contiene filas de datos' }],
      };
    }

    // ── Mapear cabeceras → índice de columna ──
    const headers = (filas[0] as any[]).map((h) =>
      String(h ?? '').trim().toUpperCase(),
    );

    const idx = (nombre: string) => headers.indexOf(nombre);

    const colFecha      = idx('FECHA');
    const colReferencia = idx('REFERENCIA');
    const colConcepto   = idx('CONCEPTO');
    const colDebito     = idx('DEBITO');
    const colCredito    = idx('CREDITO');
    // BANCO ORIGEN y EMPRESA se leen pero el sistema los obtiene
    // del cuenta_bancaria y del JWT respectivamente.
    // Se guardan solo en caso de querer validarlos en el futuro.
    const colBancoOrigen = idx('BANCO ORIGEN');
    const colEmpresa     = idx('EMPRESA');

    const errores: ErrorParser[] = [];
    const movimientos: MovimientoParsado[] = [];

    for (let i = 1; i < filas.length; i++) {
      const fila = filas[i] as any[];
      const filaNum = i + 1; // número de fila en Excel (1-indexed, +1 por cabecera)

      // Ignorar filas completamente vacías
      if (fila.every((c) => c === '' || c === null || c === undefined)) continue;

      try {
        // ── Fecha ──
        const fecha = this.parsearFecha(fila[colFecha]);
        if (!fecha || isNaN(fecha.getTime())) {
          errores.push({
            fila: filaNum,
            motivo: `Fecha inválida: "${fila[colFecha]}"`,
            datos_crudos: fila,
          });
          continue;
        }

        // ── Campos de texto ──
        const referencia = String(fila[colReferencia] ?? '').trim();
        const concepto   = String(fila[colConcepto]   ?? '').trim();

        // ── Montos ──
        const debito  = this.parsearMonto(fila[colDebito]);
        const credito = this.parsearMonto(fila[colCredito]);

        if (debito === 0 && credito === 0) {
          errores.push({
            fila: filaNum,
            motivo: 'Movimiento con débito y crédito en cero',
            datos_crudos: fila,
          });
          continue;
        }

        if (debito > 0 && credito > 0) {
          errores.push({
            fila: filaNum,
            motivo: `Débito (${debito}) y crédito (${credito}) no pueden tener valor simultáneamente`,
            datos_crudos: fila,
          });
          continue;
        }

        // DEBITO → monto negativo (EGRESO) | CREDITO → monto positivo (INGRESO)
        const monto = credito > 0 ? credito : -debito;

        movimientos.push({
          fecha,
          referencia,
          concepto,
          debito,
          credito,
          monto,
          fila_origen: filaNum,
        });
      } catch (e: any) {
        errores.push({
          fila: filaNum,
          motivo: `Error inesperado: ${e.message}`,
          datos_crudos: fila,
        });
      }
    }

    return {
      banco_key: this.banco_key,
      movimientos,
      errores,
    };
  }

  // ─────────────────────────────────────────────
  // HELPERS DE PARSEO
  // ─────────────────────────────────────────────

  /**
   * Acepta fechas en múltiples formatos:
   *   - Date object (cuando xlsx parsea con cellDates:true o raw:false)
   *   - Número serial de Excel (ej: 45678)
   *   - String "DD/MM/YYYY" o "DD/MM/YY"
   *   - String "YYYY-MM-DD" (ISO)
   */
  private parsearFecha(valor: any): Date | null {
    if (!valor && valor !== 0) return null;

    // Date nativa — xlsx con raw:false ya convierte seriales
    if (valor instanceof Date) {
      return isNaN(valor.getTime()) ? null : valor;
    }

    // Serial numérico de Excel
    if (typeof valor === 'number') {
      // XLSX.SSF.parse_date_code no existe en todas las versiones;
      // usamos la fórmula estándar: Excel epoch = 1/1/1900, serial 1 = 1/1/1900
      const fecha = this.serialExcelAFecha(valor);
      return fecha;
    }

    if (typeof valor === 'string') {
      const str = valor.trim();

      // DD/MM/YYYY o DD/MM/YY
      const matchDMY = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (matchDMY) {
        const [, d, m, y] = matchDMY;
        const year = parseInt(y) < 100 ? 2000 + parseInt(y) : parseInt(y);
        return new Date(Date.UTC(year, parseInt(m) - 1, parseInt(d)));
      }

      // ISO YYYY-MM-DD
      const matchISO = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (matchISO) {
        return new Date(str);
      }
    }

    return null;
  }

  /**
   * Convierte serial de Excel a Date.
   * Excel cuenta desde 1/1/1900 (serial 1), con el bug del año bisiesto 1900.
   */
  private serialExcelAFecha(serial: number): Date {
    // Excel tiene un bug: trata 1900 como bisiesto, así que seriales ≥ 60
    // corresponden a un día más del real.
    const diasDesde1900 = serial > 59 ? serial - 1 : serial;
    const ms = (diasDesde1900 - 1) * 86400000;
    const epoch = Date.UTC(1900, 0, 1); // 1 Ene 1900
    return new Date(epoch + ms);
  }

  /**
   * Parsea montos venezolanos o valores numéricos de Excel.
   * Formatos aceptados:
   *   - Número JS: 12500.75
   *   - String con formato venezolano: "12.500,75"
   *   - String con formato internacional: "12500.75"
   * Siempre devuelve valor absoluto (el signo lo determina DEBITO/CREDITO).
   */
  private parsearMonto(valor: any): number {
    if (valor === null || valor === undefined || valor === '') return 0;

    if (typeof valor === 'number') {
      return isNaN(valor) ? 0 : Math.abs(valor);
    }

    const str = String(valor).trim();
    if (str === '' || str === '-') return 0;

    // Formato venezolano: puntos como miles, coma como decimal → "1.234,56"
    if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(str)) {
      return Math.abs(parseFloat(str.replace(/\./g, '').replace(',', '.')));
    }

    // Formato internacional o sin separadores de miles
    const limpio = str.replace(',', '.');
    const num = parseFloat(limpio);
    return isNaN(num) ? 0 : Math.abs(num);
  }

  private leerWorkbook(contenido: Buffer | string): XLSX.WorkBook {
    if (typeof contenido === 'string') {
      return XLSX.read(contenido, { type: 'string', cellDates: true });
    }
    return XLSX.read(contenido, { type: 'buffer', cellDates: true });
  }
}
