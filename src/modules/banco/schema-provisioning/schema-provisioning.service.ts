import { Injectable, Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';

@Injectable()
export class SchemaProvisioningService {
  private readonly logger = new Logger(SchemaProvisioningService.name);

  /**
   * Genera el nombre del schema para un tenant.
   * Holding:  tenant_h{id}
   * Empresa:  tenant_e{id}
   */
  static schemaName(tipo: 'holding' | 'empresa', id: string | number): string {
    return tipo === 'holding' ? `tenant_h${id}` : `tenant_e${id}`;
  }

  /**
   * Crea el schema y todas las tablas base del tenant.
   * Se ejecuta DENTRO del QueryRunner activo, antes del commit.
   * Si falla, la transacción completa hace rollback (DDL es transaccional en PostgreSQL).
   */
  async provisionTenant(
    queryRunner: QueryRunner,
    tipo: 'holding' | 'empresa',
    id: string | number,
  ): Promise<void> {
    const schema = SchemaProvisioningService.schemaName(tipo, id);
    this.logger.log(`Provisionando schema: ${schema}`);

    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

    await this.crearTablasCuentasBancarias(queryRunner, schema);
    await this.crearTablasMovimientos(queryRunner, schema);
    await this.crearTablasCategorias(queryRunner, schema);
    await this.crearTablasImportacion(queryRunner, schema);

    await this.sembrarCategoriasDefault(queryRunner, schema);

    this.logger.log(`Schema ${schema} provisionado correctamente`);
  }

  // ─────────────────────────────────────────────
  // TABLAS
  // ─────────────────────────────────────────────

  private async crearTablasCuentasBancarias(
    qr: QueryRunner,
    schema: string,
  ): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".cuenta_bancaria (
        id                SERIAL PRIMARY KEY,
        nombre            VARCHAR(120)    NOT NULL,
        numero_cuenta     VARCHAR(30)     NOT NULL,
        moneda            VARCHAR(3)      NOT NULL DEFAULT 'VES'
                            CHECK (moneda IN ('VES','USD')),
        banco_key         VARCHAR(50)     NOT NULL,
        id_empresa        INTEGER         NOT NULL,
        activa            BOOLEAN         NOT NULL DEFAULT TRUE,
        saldo_inicial     NUMERIC(18,2)   NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        UNIQUE (numero_cuenta, id_empresa)
      )
    `);
  }

  private async crearTablasMovimientos(
    qr: QueryRunner,
    schema: string,
  ): Promise<void> {
    // Tipo destino — enum como dominio PostgreSQL
    await qr.query(`
      DO $$ BEGIN
        CREATE TYPE "${schema}".tipo_destino_enum AS ENUM (
          'GASTO_OPERATIVO',
          'COMPRA_INVENTARIO',
          'PAGO_PROVEEDOR',
          'NOMINA',
          'TRANSFERENCIA_INTERNA',
          'INGRESO_VENTAS',
          'OTRO'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".movimiento_bancario (
        id                SERIAL PRIMARY KEY,
        id_cuenta         INTEGER         NOT NULL
                            REFERENCES "${schema}".cuenta_bancaria(id),
        fecha             DATE            NOT NULL,
        concepto          TEXT            NOT NULL,
        referencia        VARCHAR(100),
        monto             NUMERIC(18,2)   NOT NULL,  -- positivo=ingreso, negativo=egreso
        moneda            VARCHAR(3)      NOT NULL DEFAULT 'VES',
        tasa_vigente      NUMERIC(10,4),             -- tasa BCV aplicada
        monto_usd         NUMERIC(18,2),             -- monto convertido
        id_categoria      INTEGER,
        tipo_destino      "${schema}".tipo_destino_enum,
        es_no_ventas      BOOLEAN         NOT NULL DEFAULT FALSE,
        hash_dedup        VARCHAR(64)     NOT NULL,
        id_importacion    INTEGER,
        id_empresa        INTEGER         NOT NULL,
        notas             TEXT,
        created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        UNIQUE (hash_dedup, id_cuenta)
      )
    `);

    // Índices de consulta frecuente
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_mov_fecha
        ON "${schema}".movimiento_bancario (fecha DESC)
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_mov_empresa_fecha
        ON "${schema}".movimiento_bancario (id_empresa, fecha DESC)
    `);

    // Distribución de egresos entre empresas del grupo
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".movimiento_distribucion (
        id                SERIAL PRIMARY KEY,
        id_movimiento     INTEGER         NOT NULL
                            REFERENCES "${schema}".movimiento_bancario(id)
                            ON DELETE CASCADE,
        id_empresa        INTEGER         NOT NULL,
        monto             NUMERIC(18,2)   NOT NULL,
        porcentaje        NUMERIC(5,2),
        notas             TEXT,
        created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      )
    `);
  }

  private async crearTablasCategorias(
    qr: QueryRunner,
    schema: string,
  ): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".categoria_movimiento (
        id                SERIAL PRIMARY KEY,
        nombre            VARCHAR(80)     NOT NULL,
        descripcion       TEXT,
        activa            BOOLEAN         NOT NULL DEFAULT TRUE,
        created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      )
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".regla_categoria (
        id                SERIAL PRIMARY KEY,
        id_categoria      INTEGER         NOT NULL
                            REFERENCES "${schema}".categoria_movimiento(id)
                            ON DELETE CASCADE,
        palabra_clave     VARCHAR(100)    NOT NULL,
        activa            BOOLEAN         NOT NULL DEFAULT TRUE,
        created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        UNIQUE (id_categoria, palabra_clave)
      )
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_regla_categoria
        ON "${schema}".regla_categoria (id_categoria)
        WHERE activa = TRUE
    `);
  }

  private async crearTablasImportacion(
    qr: QueryRunner,
    schema: string,
  ): Promise<void> {
    // Estado del lote de importación
    await qr.query(`
      DO $$ BEGIN
        CREATE TYPE "${schema}".importacion_estado_enum AS ENUM (
          'PENDIENTE',
          'EN_REVISION',
          'CONSOLIDADO',
          'CANCELADO'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".importacion_bancaria (
        id                SERIAL PRIMARY KEY,
        id_cuenta         INTEGER         NOT NULL
                            REFERENCES "${schema}".cuenta_bancaria(id),
        nombre_archivo    VARCHAR(255)    NOT NULL,
        banco_key         VARCHAR(50)     NOT NULL,
        estado            "${schema}".importacion_estado_enum
                            NOT NULL DEFAULT 'PENDIENTE',
        total_filas       INTEGER,
        filas_nuevas      INTEGER,
        filas_duplicadas  INTEGER,
        id_usuario        INTEGER         NOT NULL,
        created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      )
    `);

    // Staging — filas crudas del Excel antes de consolidar
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".bank_transactions_staging (
        id                SERIAL PRIMARY KEY,
        id_importacion    INTEGER         NOT NULL
                            REFERENCES "${schema}".importacion_bancaria(id)
                            ON DELETE CASCADE,
        fila_excel        INTEGER,
        fecha             DATE,
        concepto          TEXT,
        referencia        VARCHAR(100),
        monto             NUMERIC(18,2),
        hash_dedup        VARCHAR(64),
        es_duplicado      BOOLEAN         NOT NULL DEFAULT FALSE,
        id_categoria      INTEGER,
        tipo_destino      VARCHAR(30),
        notas             TEXT,
        procesado         BOOLEAN         NOT NULL DEFAULT FALSE,
        created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      )
    `);

    // Distribuciones en staging (para prorrateo multi-empresa en el wizard)
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".staging_distributions (
        id                SERIAL PRIMARY KEY,
        id_staging        INTEGER         NOT NULL
                            REFERENCES "${schema}".bank_transactions_staging(id)
                            ON DELETE CASCADE,
        id_empresa        INTEGER         NOT NULL,
        monto             NUMERIC(18,2)   NOT NULL,
        porcentaje        NUMERIC(5,2),
        created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      )
    `);

    // Conciliación (estructura base — se expande en Sprint 5)
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".conciliacion_cobranza (
        id                SERIAL PRIMARY KEY,
        id_movimiento     INTEGER
                            REFERENCES "${schema}".movimiento_bancario(id),
        id_factura        INTEGER,          -- referencia a módulo de ventas
        monto_conciliado  NUMERIC(18,2)    NOT NULL,
        fecha             DATE             NOT NULL,
        notas             TEXT,
        created_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW()
      )
    `);
  }

  // ─────────────────────────────────────────────
  // SEMILLA DE CATEGORÍAS DEFAULT
  // ─────────────────────────────────────────────

  /**
   * Inserta las categorías base con sus palabras clave al crear el tenant.
   * Basado en los conceptos reales del extracto Bancamiga.
   *
   * Categorías con auto-match:   Ingresos por Ventas, Comisiones Bancarias,
   *                               Impuestos, Servicios Públicos.
   * Categorías sin palabras clave (clasificación manual en wizard):
   *                               Pago a Proveedores, Nómina, Transferencia Interna.
   */
  private async sembrarCategoriasDefault(
    qr: QueryRunner,
    schema: string,
  ): Promise<void> {
    const categorias: { nombre: string; descripcion: string; palabras: string[] }[] = [
      {
        nombre: 'Ingresos por Ventas',
        descripcion: 'Cobros de clientes, transferencias recibidas y créditos inmediatos',
        palabras: [
          'nc transf',
          'nc fondos',
          'nc credito',
          'credito inmediato',
          'fondos recib',
          'transf. distinto cliente',
          'transf. internet terceros',
          'pago movil',
        ],
      },
      {
        nombre: 'Comisiones Bancarias',
        descripcion: 'Comisiones y cargos del banco por operaciones',
        palabras: [
          'comision',
          'comisión',
          'comisi',
        ],
      },
      {
        nombre: 'Impuestos',
        descripcion: 'Pagos al SENIAT y organismos tributarios',
        palabras: [
          'seniat',
          'pagos web',
          'impuesto',
          'igtf',
          'iva',
        ],
      },
      {
        nombre: 'Servicios Públicos',
        descripcion: 'Electricidad, agua, aseo y otros servicios básicos',
        palabras: [
          'corpoelec',
          'energia',
          'aseo',
          'relleno',
          'hidrolago',
          'hidrocapital',
          'cantv',
          'movilnet',
        ],
      },
      {
        nombre: 'Pago a Proveedores',
        descripcion: 'Transferencias enviadas a proveedores de bienes y servicios',
        palabras: [], // clasificación manual en el wizard
      },
      {
        nombre: 'Nómina',
        descripcion: 'Pago de sueldos y salarios al personal',
        palabras: [
          'nomina',
          'nómina',
          'sueldo',
          'salario',
        ],
      },
      {
        nombre: 'Transferencia Interna',
        descripcion: 'Movimientos entre empresas del mismo grupo (no afectan P&L consolidado)',
        palabras: [
          'transferencia interna',
          'transf interna',
        ],
      },
      {
        nombre: 'Sin Clasificar',
        descripcion: 'Movimientos pendientes de revisión y clasificación',
        palabras: [], // catch-all manual
      },
    ];

    for (const cat of categorias) {
      const [nueva] = await qr.query(
        `INSERT INTO "${schema}".categoria_movimiento (nombre, descripcion)
         VALUES ($1, $2)
         RETURNING id`,
        [cat.nombre, cat.descripcion],
      );

      for (const palabra of cat.palabras) {
        await qr.query(
          `INSERT INTO "${schema}".regla_categoria (id_categoria, palabra_clave)
           VALUES ($1, $2)
           ON CONFLICT (id_categoria, palabra_clave) DO NOTHING`,
          [nueva.id, palabra.toLowerCase().trim()],
        );
      }
    }

    this.logger.log(`Categorías default sembradas en schema ${schema}`);
  }
}