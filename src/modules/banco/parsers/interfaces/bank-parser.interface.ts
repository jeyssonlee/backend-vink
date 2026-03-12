/**
 * Fila normalizada que devuelve cualquier parser bancario.
 * Independiente del banco — siempre la misma estructura.
 */
export interface MovimientoParsado {
    fecha: Date;
    referencia: string;
    concepto: string;
    debito: number;   // 0 si es crédito
    credito: number;  // 0 si es débito
    monto: number;    // positivo=ingreso, negativo=egreso
    saldo?: number;   // opcional — no todos los bancos lo incluyen
    fila_origen: number; // número de fila en el archivo original
  }
  
  /**
   * Resultado completo del parsing de un archivo.
   */
  export interface ResultadoParser {
    banco_key: string;
    numero_cuenta?: string;
    fecha_extracto?: Date;
    saldo_inicial?: number;
    movimientos: MovimientoParsado[];
    errores: ErrorParser[];
  }
  
  export interface ErrorParser {
    fila: number;
    motivo: string;
    datos_crudos?: any;
  }
  
  /**
   * Interfaz que deben implementar todos los parsers bancarios.
   * Cada banco venezolano tiene su propio formato — esta interface
   * garantiza que el wizard siempre recibe la misma estructura.
   */
  export interface IBankParser {
    readonly banco_key: string; // ej: 'BANCAMIGA', 'BANESCO', 'VENEZUELA'
  
    /**
     * Detecta si el buffer/string corresponde a este banco.
     * Usado para auto-detectar el banco al subir el archivo.
     */
    detectar(contenido: Buffer | string): boolean;
  
    /**
     * Parsea el archivo y devuelve los movimientos normalizados.
     */
    parsear(contenido: Buffer | string): Promise<ResultadoParser>;
  }