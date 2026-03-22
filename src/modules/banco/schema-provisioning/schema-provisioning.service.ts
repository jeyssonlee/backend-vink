import { Injectable, Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';

@Injectable()
export class SchemaProvisioningService {
  private readonly logger = new Logger(SchemaProvisioningService.name);

  static schemaName(tipo: 'holding' | 'empresa', id: string | number): string {
    return tipo === 'holding' ? `tenant_h${id}` : `tenant_e${id}`;
  }

  async provisionTenant(
    queryRunner: QueryRunner,
    tipo: 'holding' | 'empresa',
    id: string | number,
  ): Promise<void> {
    const schema = SchemaProvisioningService.schemaName(tipo, id);
    this.logger.log(`Provisionando schema: ${schema}`);

    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

    await this.crearTablasCuentasBancarias(queryRunner, schema);
    await this.crearTablasCategorias(queryRunner, schema);
    await this.crearTablasMovimientos(queryRunner, schema);
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
        id_empresa        UUID            NOT NULL,
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
        monto             NUMERIC(18,2)   NOT NULL,
        moneda            VARCHAR(3)      NOT NULL DEFAULT 'VES',
        tasa_vigente      NUMERIC(10,4),
        monto_usd         NUMERIC(18,2),
        id_tipo           INTEGER,
        id_subtipo        INTEGER,
        id_categoria      INTEGER,
        tipo_destino      "${schema}".tipo_destino_enum,
        es_no_ventas      BOOLEAN         NOT NULL DEFAULT FALSE,
        es_distribucion   BOOLEAN         NOT NULL DEFAULT FALSE,
        -- Marca el movimiento original que fue repartido entre empresas.
        -- Se excluye de KPIs y saldos; se muestra en la tabla resaltado en amarillo.
        tiene_distribucion BOOLEAN        NOT NULL DEFAULT FALSE,
        id_origen         INTEGER,
        hash_dedup        VARCHAR(64)     NOT NULL,
        id_importacion    INTEGER,
        id_empresa        UUID            NOT NULL,
        notas             TEXT,
        created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        UNIQUE (hash_dedup, id_cuenta)
      )
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_mov_fecha
        ON "${schema}".movimiento_bancario (fecha DESC)
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_mov_empresa_fecha
        ON "${schema}".movimiento_bancario (id_empresa, fecha DESC)
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".movimiento_manual (
        id               SERIAL PRIMARY KEY,
        fecha            DATE            NOT NULL,
        tipo             VARCHAR(10)     NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
        id_tipo          INTEGER,
        id_subtipo       INTEGER,
        id_cuenta        INTEGER         REFERENCES "${schema}".cuenta_bancaria(id) ON DELETE SET NULL,
        es_efectivo      BOOLEAN         NOT NULL DEFAULT FALSE,
        id_categoria     INTEGER         REFERENCES "${schema}".categoria_movimiento(id) ON DELETE SET NULL,
        descripcion      TEXT,
        monto_usd        NUMERIC(18,2)   NOT NULL,
        tasa_vigente     NUMERIC(12,4),
        monto_bs         NUMERIC(18,2),
        id_empresa       UUID            NOT NULL,
        created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      )
    `);

    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_movimiento_manual_empresa
        ON "${schema}".movimiento_manual (id_empresa)
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_movimiento_manual_fecha
        ON "${schema}".movimiento_manual (fecha DESC)
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".movimiento_distribucion (
        id                SERIAL PRIMARY KEY,
        id_movimiento     INTEGER         NOT NULL
                            REFERENCES "${schema}".movimiento_bancario(id)
                            ON DELETE CASCADE,
        id_empresa        UUID            NOT NULL,
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
      CREATE TABLE IF NOT EXISTS "${schema}".tipo_movimiento (
        id          SERIAL PRIMARY KEY,
        nombre      VARCHAR(60)   NOT NULL,
        descripcion TEXT,
        es_sistema  BOOLEAN       NOT NULL DEFAULT FALSE,
        activo      BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        UNIQUE (nombre)
      )
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".subtipo_movimiento (
        id          SERIAL PRIMARY KEY,
        id_tipo     INTEGER       NOT NULL
                      REFERENCES "${schema}".tipo_movimiento(id) ON DELETE CASCADE,
        nombre      VARCHAR(80)   NOT NULL,
        descripcion TEXT,
        activo      BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        UNIQUE (id_tipo, nombre)
      )
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".categoria_movimiento (
        id          SERIAL PRIMARY KEY,
        nombre      VARCHAR(80)   NOT NULL,
        descripcion TEXT,
        id_subtipo  INTEGER
                      REFERENCES "${schema}".subtipo_movimiento(id) ON DELETE SET NULL,
        activa      BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        UNIQUE (nombre)
      )
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".regla_categoria (
        id            SERIAL PRIMARY KEY,
        id_categoria  INTEGER       NOT NULL
                        REFERENCES "${schema}".categoria_movimiento(id) ON DELETE CASCADE,
        palabra_clave VARCHAR(80)   NOT NULL,
        activa        BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        UNIQUE (id_categoria, palabra_clave)
      )
    `);
  }

  private async crearTablasImportacion(
    qr: QueryRunner,
    schema: string,
  ): Promise<void> {
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
        id_usuario        UUID            NOT NULL,
        created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      )
    `);

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
        id_tipo           INTEGER,
        id_subtipo        INTEGER,
        id_categoria      INTEGER,
        tipo_destino      VARCHAR(30),
        notas             TEXT,
        procesado         BOOLEAN         NOT NULL DEFAULT FALSE,
        tasa_vigente      NUMERIC(18,4),
        monto_usd         NUMERIC(18,2),
        created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      )
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".staging_distributions (
        id                SERIAL PRIMARY KEY,
        id_staging        INTEGER         NOT NULL
                            REFERENCES "${schema}".bank_transactions_staging(id)
                            ON DELETE CASCADE,
        id_empresa        UUID            NOT NULL,
        monto             NUMERIC(18,2)   NOT NULL,
        porcentaje        NUMERIC(5,2),
        id_cuenta         INTEGER,
        created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      )
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${schema}".conciliacion_cobranza (
        id                SERIAL PRIMARY KEY,
        id_movimiento     INTEGER
                            REFERENCES "${schema}".movimiento_bancario(id),
        id_factura        INTEGER,
        monto_conciliado  NUMERIC(18,2)   NOT NULL,
        fecha             DATE            NOT NULL,
        notas             TEXT,
        created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      )
    `);
  }

  // ─────────────────────────────────────────────
  // SEMILLA DE CATEGORÍAS DEFAULT
  // ─────────────────────────────────────────────

  private async sembrarCategoriasDefault(
    qr: QueryRunner,
    schema: string,
  ): Promise<void> {
    const [tipoIngreso] = await qr.query(
      `INSERT INTO "${schema}".tipo_movimiento (nombre, descripcion, es_sistema)
       VALUES ('INGRESO', 'Entradas de dinero a la cuenta', TRUE)
       RETURNING id`,
    );
    const [tipoEgreso] = await qr.query(
      `INSERT INTO "${schema}".tipo_movimiento (nombre, descripcion, es_sistema)
       VALUES ('EGRESO', 'Salidas de dinero de la cuenta', TRUE)
       RETURNING id`,
    );

    const [stIngresosOp] = await qr.query(
      `INSERT INTO "${schema}".subtipo_movimiento (id_tipo, nombre, descripcion)
       VALUES ($1, 'Ingresos Operacionales', 'Cobros propios de la actividad comercial')
       RETURNING id`,
      [tipoIngreso.id],
    );
    const [stGastos] = await qr.query(
      `INSERT INTO "${schema}".subtipo_movimiento (id_tipo, nombre, descripcion)
       VALUES ($1, 'Gastos', 'Pagos y salidas relacionadas con la operación')
       RETURNING id`,
      [tipoEgreso.id],
    );
    const [stImpuestos] = await qr.query(
      `INSERT INTO "${schema}".subtipo_movimiento (id_tipo, nombre, descripcion)
       VALUES ($1, 'Impuestos y Tributos', 'Pagos al SENIAT y otros organismos')
       RETURNING id`,
      [tipoEgreso.id],
    );

    const categorias: { nombre: string; descripcion: string; id_subtipo: number | null; palabras: string[] }[] = [
      {
        nombre: 'Ingresos por Ventas',
        descripcion: 'Cobros de clientes, transferencias recibidas y créditos inmediatos',
        id_subtipo: stIngresosOp.id,
        palabras: ['nc transf', 'nc fondos', 'nc credito', 'credito inmediato',
                   'fondos recib', 'transf. distinto cliente', 'transf. internet terceros', 'pago movil'],
      },
      {
        nombre: 'Comisiones Bancarias',
        descripcion: 'Comisiones y cargos del banco por operaciones',
        id_subtipo: stGastos.id,
        palabras: ['comision', 'comisión', 'comisi'],
      },
      {
        nombre: 'Impuestos',
        descripcion: 'Pagos al SENIAT y organismos tributarios',
        id_subtipo: stImpuestos.id,
        palabras: ['seniat', 'pagos web', 'impuesto', 'igtf', 'iva'],
      },
      {
        nombre: 'Servicios Públicos',
        descripcion: 'Electricidad, agua, aseo y otros servicios básicos',
        id_subtipo: stGastos.id,
        palabras: ['corpoelec', 'energia', 'aseo', 'relleno', 'hidrolago', 'hidrocapital', 'cantv', 'movilnet'],
      },
      {
        nombre: 'Pago a Proveedores',
        descripcion: 'Transferencias enviadas a proveedores de bienes y servicios',
        id_subtipo: stGastos.id,
        palabras: [],
      },
      {
        nombre: 'Nómina',
        descripcion: 'Pago de sueldos y salarios al personal',
        id_subtipo: stGastos.id,
        palabras: ['nomina', 'nómina', 'sueldo', 'salario'],
      },
      {
        nombre: 'Transferencia Interna',
        descripcion: 'Movimientos entre empresas del mismo grupo (no afectan P&L consolidado)',
        id_subtipo: null,
        palabras: ['transferencia interna', 'transf interna'],
      },
      {
        nombre: 'Sin Clasificar',
        descripcion: 'Movimientos pendientes de revisión y clasificación',
        id_subtipo: null,
        palabras: [],
      },
    ];

    for (const cat of categorias) {
      const [nueva] = await qr.query(
        `INSERT INTO "${schema}".categoria_movimiento (nombre, descripcion, id_subtipo)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [cat.nombre, cat.descripcion, cat.id_subtipo ?? null],
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