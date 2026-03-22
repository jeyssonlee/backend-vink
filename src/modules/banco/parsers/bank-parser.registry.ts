import { Injectable } from '@nestjs/common';
import { IBankParser, ResultadoParser } from './interfaces/bank-parser.interface';
import { BancamigaParser } from '../parsers/bancamiga.parser';
import { ExcelEstandarParser } from '../parsers/excel-estandar.parser';

/**
 * Registro central de todos los parsers bancarios.
 *
 * Para agregar un banco nuevo:
 *   1. Crear src/modules/banco/parsers/[banco].parser.ts implementando IBankParser
 *   2. Importarlo aquí y agregarlo al array `this.parsers`
 *   3. Listo — el wizard lo detecta automáticamente
 */
@Injectable()
export class BankParserRegistry {
  /**
   * Orden de detección: los parsers se evalúan en el orden del array.
   * Poner los más específicos primero (Bancamiga detecta firmas HTML propias)
   * y los genéricos al final (ExcelEstandar detecta por cabeceras de columna).
   */
  private readonly parsers: IBankParser[] = [
    new BancamigaParser(),      // HTML .xls exportado desde el portal Bancamiga
    new ExcelEstandarParser(),  // .xlsx estándar: FECHA|REFERENCIA|CONCEPTO|DEBITO|CREDITO|BANCO ORIGEN|EMPRESA
    // new BanescoParser(),
    // new VenezuelaParser(),
    // new MercantilParser(),
  ];

  /**
   * Detecta automáticamente el banco analizando el contenido del archivo.
   * Devuelve null si ningún parser reconoce el formato.
   */
  detectarParser(contenido: Buffer | string): IBankParser | null {
    return this.parsers.find((p) => p.detectar(contenido)) ?? null;
  }

  /**
   * Parsea el archivo usando el parser correspondiente al banco_key.
   * Usado cuando el usuario selecciona el banco manualmente.
   */
  parsearConBanco(banco_key: string, contenido: Buffer | string): Promise<ResultadoParser> {
    const parser = this.parsers.find((p) => p.banco_key === banco_key);
    if (!parser) {
      throw new Error(`No existe parser para el banco: ${banco_key}. Agrega el Excel al equipo de desarrollo.`);
    }
    return parser.parsear(contenido);
  }

  /**
   * Auto-detecta el banco y parsea el archivo en un solo paso.
   * Lanza error si no reconoce el formato.
   */
  async autoDetectarYParsear(contenido: Buffer | string): Promise<ResultadoParser> {
    const parser = this.detectarParser(contenido);
    if (!parser) {
      throw new Error(
        'Formato de extracto no reconocido. Los bancos soportados actualmente son: ' +
        this.parsers.map((p) => p.banco_key).join(', '),
      );
    }
    return parser.parsear(contenido);
  }

  /**
   * Lista los bancos con parser disponible — usado en el selector del wizard.
   */
  bancosDisponibles(): string[] {
    return this.parsers.map((p) => p.banco_key);
  }
}