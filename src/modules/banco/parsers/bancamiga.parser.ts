import { IBankParser, ResultadoParser, MovimientoParsado, ErrorParser } from './interfaces/bank-parser.interface';

/**
 * Parser para extractos de Bancamiga Banco Universal.
 *
 * Formato real: tabla HTML exportada con extensión .xls
 * Estructura:
 *   Fila 0: logo (vacía)
 *   Fila 1: "Bancamiga Banco Universal"
 *   Fila 2: "Cuenta: 01720702497025656005"
 *   Fila 3: "Movimientos Dia Actual: DD/MM/YYYY"
 *   Fila 4: "Saldo Inicial: XXXXXXX.XX"
 *   Fila 5: headers — Nro | Fecha | Referencia | Concepto | Débito | Crédito | Saldo
 *   Fila 6+: datos
 *
 * Particularidades:
 *   - Números con coma decimal: "125.997,00" → 125997.00
 *   - Fechas en DD/MM/YY
 *   - Referencias con apóstrofe inicial: "'81831222884" → "81831222884"
 *   - Codificación latin-1
 */
export class BancamigaParser implements IBankParser {
  readonly banco_key = 'BANCAMIGA';

  detectar(contenido: Buffer | string): boolean {
    const texto = this.toString(contenido);
    return (
      texto.includes('Bancamiga Banco Universal') ||
      texto.includes('bancamiga-portal') ||
      texto.includes('LOGO-BANCAMIGA')
    );
  }

  async parsear(contenido: Buffer | string): Promise<ResultadoParser> {
    const texto = this.toString(contenido);
    const filas = this.parsearHTML(texto);

    const errores: ErrorParser[] = [];
    const movimientos: MovimientoParsado[] = [];

    // ── Extraer metadatos del encabezado ──
    const numeroCuenta = this.extraerCuenta(filas);
    const saldoInicial = this.extraerSaldoInicial(filas);
    const fechaExtracto = this.extraerFechaExtracto(filas);

    // ── Procesar filas de datos ──
    // Datos comienzan después de la fila de headers (Nro, Fecha, Referencia...)
    const idxHeaders = filas.findIndex(
      (f) => f.length >= 4 && f[0] === 'Nro.' && f[1] === 'Fecha',
    );

    if (idxHeaders === -1) {
      errores.push({ fila: 0, motivo: 'No se encontró la fila de headers en el archivo' });
      return { banco_key: this.banco_key, movimientos, errores };
    }

    const filasDatos = filas.slice(idxHeaders + 1).filter(
      (f) => f.length === 7 && /^\d+$/.test(f[0]),
    );

    for (const fila of filasDatos) {
      const filaNum = parseInt(fila[0]);

      try {
        const fecha = this.parsearFecha(fila[1]);
        const referencia = fila[2].replace(/^'/, '').trim(); // quitar apóstrofe inicial
        const concepto = fila[3].trim();
        const debito = this.parsearMonto(fila[4]);
        const credito = this.parsearMonto(fila[5]);
        const saldo = this.parsearMonto(fila[6]);

        // Validaciones básicas
        if (isNaN(fecha.getTime())) {
          errores.push({ fila: filaNum, motivo: `Fecha inválida: "${fila[1]}"`, datos_crudos: fila });
          continue;
        }

        if (debito === 0 && credito === 0) {
          errores.push({ fila: filaNum, motivo: 'Movimiento con débito y crédito en cero', datos_crudos: fila });
          continue;
        }

        const monto = credito > 0 ? credito : -debito;

        movimientos.push({
          fecha,
          referencia,
          concepto,
          debito,
          credito,
          monto,
          saldo,
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
      numero_cuenta: numeroCuenta,
      fecha_extracto: fechaExtracto,
      saldo_inicial: saldoInicial,
      movimientos,
      errores,
    };
  }

  // ─────────────────────────────────────────────
  // HELPERS DE PARSEO HTML
  // ─────────────────────────────────────────────

  private parsearHTML(html: string): string[][] {
    const filas: string[][] = [];
    let filaActual: string[] = [];
    let celdaActual = '';
    let enCelda = false;

    // Mini parser de HTML — evita dependencias externas
    let i = 0;
    while (i < html.length) {
      if (html[i] === '<') {
        const fin = html.indexOf('>', i);
        if (fin === -1) break;

        const tag = html.slice(i + 1, fin).trim().toLowerCase().split(/\s/)[0];

        if (tag === 'td' || tag === 'th') {
          enCelda = true;
          celdaActual = '';
        } else if (tag === '/td' || tag === '/th') {
          filaActual.push(this.decodificarHTML(celdaActual.trim()));
          enCelda = false;
        } else if (tag === '/tr') {
          if (filaActual.length > 0) {
            filas.push(filaActual);
          }
          filaActual = [];
        }

        i = fin + 1;
      } else {
        if (enCelda) {
          celdaActual += html[i];
        }
        i++;
      }
    }

    return filas;
  }

  private decodificarHTML(texto: string): string {
    return texto
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&eacute;/g, 'é')
      .replace(/&eacute;/gi, 'é')
      .replace(/&aacute;/gi, 'á')
      .replace(/&iacute;/gi, 'í')
      .replace(/&oacute;/gi, 'ó')
      .replace(/&uacute;/gi, 'ú')
      .replace(/&ntilde;/gi, 'ñ')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
      .trim();
  }

  // ─────────────────────────────────────────────
  // HELPERS DE METADATOS
  // ─────────────────────────────────────────────

  private extraerCuenta(filas: string[][]): string | undefined {
    const fila = filas.find((f) => f.length === 1 && f[0].startsWith('Cuenta:'));
    if (!fila) return undefined;
    return fila[0].replace('Cuenta:', '').trim();
  }

  private extraerSaldoInicial(filas: string[][]): number | undefined {
    const fila = filas.find((f) => f.length === 1 && f[0].startsWith('Saldo Inicial:'));
    if (!fila) return undefined;
    return this.parsearMontoSaldoInicial(fila[0].replace('Saldo Inicial:', '').trim());
  }

  private extraerFechaExtracto(filas: string[][]): Date | undefined {
    const fila = filas.find((f) => f.length === 1 && f[0].startsWith('Movimientos Dia'));
    if (!fila) return undefined;

    // "Movimientos Dia Actual: 10/03/2026"
    const match = fila[0].match(/(\d{2}\/\d{2}\/\d{4})/);
    if (!match) return undefined;

    return this.parsearFechaLarga(match[1]);
  }

  // ─────────────────────────────────────────────
  // HELPERS DE FORMATO
  // ─────────────────────────────────────────────

  /**
   * Parsea fechas en formato DD/MM/YY (extracto) → Date
   */
  private parsearFecha(str: string): Date {
    const [dia, mes, anio] = str.split('/').map((s) => parseInt(s.trim()));
    const anioCompleto = anio < 100 ? 2000 + anio : anio;
    return new Date(Date.UTC(anioCompleto, mes - 1, dia));
  }

  /**
   * Parsea fechas en formato DD/MM/YYYY (encabezado) → Date
   */
  private parsearFechaLarga(str: string): Date {
    const [dia, mes, anio] = str.split('/').map((s) => parseInt(s.trim()));
    return new Date(Date.UTC(anio, mes - 1, dia));
  }

  /**
   * Parsea montos venezolanos del cuerpo: "125.997,00" → 125997.00
   * Maneja: puntos como separador de miles, coma como decimal
   */
  private parsearMonto(str: string): number {
    if (!str || str.trim() === '' || str.trim() === '0') return 0;
    const limpio = str.trim().replace(/\./g, '').replace(',', '.');
    const valor = parseFloat(limpio);
    return isNaN(valor) ? 0 : valor;
  }

  /**
   * Parsea el saldo inicial del encabezado: "1141734.87" → 1141734.87
   * Bancamiga usa punto como decimal en el header (distinto al cuerpo).
   */
  private parsearMontoSaldoInicial(str: string): number {
    if (!str || str.trim() === '') return 0;
    const valor = parseFloat(str.trim());
    return isNaN(valor) ? 0 : valor;
  }

  private toString(contenido: Buffer | string): string {
    if (typeof contenido === 'string') return contenido;
    // Intentar latin-1 primero (formato Bancamiga)
    return contenido.toString('latin1');
  }
}