import {
    Injectable,
    BadRequestException,
    NotFoundException,
    Logger,
  } from '@nestjs/common';
  import { DataSource } from 'typeorm';
  import { TenantResolverService } from '../tenant-resolver/tenant-resolver.service';
  import { BankParserRegistry } from '../parsers/bank-parser.registry';
  import { CategoriasService } from '../categorias/categorias.service';
  import { TasaBcvService } from '../tasa-bcv/tasa-bcv.service';
  import { IniciarImportacionDto } from './dto/importacion.dto';
  import * as crypto from 'crypto';
  
  @Injectable()
  export class ImportacionService {
    private readonly logger = new Logger(ImportacionService.name);
  
    constructor(
      private readonly dataSource: DataSource,
      private readonly tenantResolver: TenantResolverService,
      private readonly parserRegistry: BankParserRegistry,
      private readonly categoriasService: CategoriasService,
      private readonly tasaBcvService: TasaBcvService,
    ) {}
  
    // ─────────────────────────────────────────────
    // PASO 1 — Carga, parseo e inserción en staging
    // ─────────────────────────────────────────────
  
    async iniciarImportacion(
      file: Express.Multer.File,
      dto: IniciarImportacionDto,
      id_empresa: string,
      id_usuario: string,
    ) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
      const cuenta = await this.verificarCuenta(schema, dto.id_cuenta, id_empresa);
  
      this.logger.log(`Parseando archivo: ${file.originalname} (${file.size} bytes)`);
  
      let resultado;
      try {
        if (dto.banco_key) {
          resultado = await this.parserRegistry.parsearConBanco(dto.banco_key, file.buffer);
        } else {
          resultado = await this.parserRegistry.autoDetectarYParsear(file.buffer);
        }
      } catch (e: any) {
        throw new BadRequestException(e.message);
      }
  
      if (resultado.movimientos.length === 0) {
        throw new BadRequestException(
          'El archivo no contiene movimientos. Verifica que sea el extracto correcto.',
        );
      }
  
      let tasaVigente: number | null = null;
      try {
        const tasa = await this.tasaBcvService.obtenerTasaVigente();
        tasaVigente = Number(tasa.tasa);
      } catch {
        this.logger.warn('No hay tasa BCV registrada hoy — monto_usd quedará null en staging');
      }
  
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
  
      try {
        const [importacion] = await queryRunner.query(
          `INSERT INTO "${schema}".importacion_bancaria
             (id_cuenta, nombre_archivo, banco_key, estado, total_filas, id_usuario)
           VALUES ($1, $2, $3, 'PENDIENTE', $4, $5)
           RETURNING *`,
          [dto.id_cuenta, file.originalname, resultado.banco_key, resultado.movimientos.length, id_usuario],
        );
  
        const hashesExistentes = await this.obtenerHashesExistentes(queryRunner, schema, dto.id_cuenta);
  
        let filasNuevas = 0;
        let filasDuplicadas = 0;
  
        for (const mov of resultado.movimientos) {
          const hash = this.calcularHash(mov.fecha, mov.referencia, mov.monto);
          const esDuplicado = hashesExistentes.has(hash);
  
          const categoriaMatch = await this.categoriasService.resolverCategoria(mov.concepto, id_empresa);
  
          const montoUsd = tasaVigente && tasaVigente > 0
            ? parseFloat((Math.abs(mov.monto) / tasaVigente).toFixed(2))
            : null;
  
          await queryRunner.query(
            `INSERT INTO "${schema}".bank_transactions_staging
               (id_importacion, fila_excel, fecha, concepto, referencia,
                monto, hash_dedup, es_duplicado, id_categoria, tasa_vigente, monto_usd)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              importacion.id, mov.fila_origen, mov.fecha, mov.concepto, mov.referencia,
              mov.monto, hash, esDuplicado, categoriaMatch?.id_categoria ?? null,
              tasaVigente, montoUsd,
            ],
          );
  
          esDuplicado ? filasDuplicadas++ : filasNuevas++;
        }
  
        await queryRunner.query(
          `UPDATE "${schema}".importacion_bancaria
           SET filas_nuevas = $1, filas_duplicadas = $2, estado = 'EN_REVISION'
           WHERE id = $3`,
          [filasNuevas, filasDuplicadas, importacion.id],
        );
  
        await queryRunner.commitTransaction();
  
        return {
          id_importacion: importacion.id,
          banco_detectado: resultado.banco_key,
          nombre_archivo: file.originalname,
          numero_cuenta: resultado.numero_cuenta ?? cuenta.numero_cuenta,
          fecha_extracto: resultado.fecha_extracto,
          resumen: {
            total: resultado.movimientos.length,
            nuevos: filasNuevas,
            duplicados: filasDuplicadas,
            errores_parseo: resultado.errores.length,
            tasa_bcv_aplicada: tasaVigente,
          },
          errores_parseo: resultado.errores,
          siguiente_paso: 'VALIDACION',
        };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error('Error en Paso 1 del wizard', error);
        throw error;
      } finally {
        await queryRunner.release();
      }
    }
  
    // ─────────────────────────────────────────────
    // PASO 2 — Validación y resumen para revisión
    // ─────────────────────────────────────────────
  
    async obtenerValidacion(id_importacion: number, id_empresa: string) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
      const importacion = await this.verificarImportacion(schema, id_importacion);
  
      const filasNuevas = await this.dataSource.query(
        `SELECT
           s.id, s.fila_excel, s.fecha, s.concepto, s.referencia,
           s.monto, s.monto_usd, s.tasa_vigente, s.id_categoria,
           c.nombre AS nombre_categoria, s.tipo_destino, s.notas
         FROM "${schema}".bank_transactions_staging s
         LEFT JOIN "${schema}".categoria_movimiento c ON c.id = s.id_categoria
         WHERE s.id_importacion = $1 AND s.es_duplicado = FALSE
         ORDER BY s.fecha, s.fila_excel`,
        [id_importacion],
      );
  
      const filasDuplicadas = await this.dataSource.query(
        `SELECT s.id, s.fila_excel, s.fecha, s.concepto, s.referencia, s.monto
         FROM "${schema}".bank_transactions_staging s
         WHERE s.id_importacion = $1 AND s.es_duplicado = TRUE
         ORDER BY s.fecha`,
        [id_importacion],
      );
  
      const resumenCategorias = await this.dataSource.query(
        `SELECT
           COALESCE(c.nombre, 'Sin Clasificar') AS categoria,
           COUNT(s.id)::int                     AS cantidad,
           SUM(s.monto)                         AS total_monto,
           SUM(s.monto_usd)                     AS total_usd
         FROM "${schema}".bank_transactions_staging s
         LEFT JOIN "${schema}".categoria_movimiento c ON c.id = s.id_categoria
         WHERE s.id_importacion = $1 AND s.es_duplicado = FALSE
         GROUP BY c.nombre
         ORDER BY cantidad DESC`,
        [id_importacion],
      );
  
      const [totales] = await this.dataSource.query(
        `SELECT
           COUNT(*)::int                                          AS total,
           COUNT(*) FILTER (WHERE monto > 0)::int                AS total_ingresos,
           COUNT(*) FILTER (WHERE monto < 0)::int                AS total_egresos,
           COALESCE(SUM(monto) FILTER (WHERE monto > 0), 0)      AS suma_ingresos,
           COALESCE(SUM(monto) FILTER (WHERE monto < 0), 0)      AS suma_egresos,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto > 0), 0)  AS suma_ingresos_usd,
           COALESCE(SUM(monto_usd) FILTER (WHERE monto < 0), 0)  AS suma_egresos_usd,
           COUNT(*) FILTER (WHERE id_categoria IS NULL)::int      AS sin_categoria
         FROM "${schema}".bank_transactions_staging
         WHERE id_importacion = $1 AND es_duplicado = FALSE`,
        [id_importacion],
      );
  
      return {
        importacion: {
          id: importacion.id,
          banco_key: importacion.banco_key,
          nombre_archivo: importacion.nombre_archivo,
          estado: importacion.estado,
          created_at: importacion.created_at,
        },
        totales: {
          nuevos: totales.total,
          duplicados: filasDuplicadas.length,
          ingresos: {
            cantidad: totales.total_ingresos,
            monto_bs: parseFloat(totales.suma_ingresos),
            monto_usd: parseFloat(totales.suma_ingresos_usd),
          },
          egresos: {
            cantidad: totales.total_egresos,
            monto_bs: Math.abs(parseFloat(totales.suma_egresos)),
            monto_usd: Math.abs(parseFloat(totales.suma_egresos_usd)),
          },
          sin_categoria: totales.sin_categoria,
        },
        resumen_categorias: resumenCategorias,
        filas_nuevas: filasNuevas,
        filas_duplicadas: filasDuplicadas,
        siguiente_paso: 'REVISION',
      };
    }
  
    // ─────────────────────────────────────────────
    // PASO 3 — Revisión y edición de filas
    // ─────────────────────────────────────────────
  
    async editarStaging(
      id_importacion: number,
      id_staging: number,
      dto: any,
      id_empresa: string,
    ) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
      await this.verificarImportacion(schema, id_importacion);
  
      const [fila] = await this.dataSource.query(
        `SELECT * FROM "${schema}".bank_transactions_staging
         WHERE id = $1 AND id_importacion = $2`,
        [id_staging, id_importacion],
      );
  
      if (!fila) throw new NotFoundException(`Fila ${id_staging} no encontrada en esta importación`);
      if (fila.procesado) throw new BadRequestException('Esta fila ya fue consolidada y no puede editarse');
  
      const campos: string[] = [];
      const valores: any[] = [];
      let idx = 1;
  
      if (dto.id_categoria !== undefined) { campos.push(`id_categoria = $${idx++}`); valores.push(dto.id_categoria); }
      if (dto.tipo_destino !== undefined) { campos.push(`tipo_destino = $${idx++}`); valores.push(dto.tipo_destino); }
      if (dto.notas !== undefined)        { campos.push(`notas = $${idx++}`);         valores.push(dto.notas); }
      if (dto.excluir !== undefined)      { campos.push(`es_duplicado = $${idx++}`);  valores.push(dto.excluir); }
  
      if (campos.length === 0) throw new BadRequestException('No se enviaron campos para actualizar');
  
      valores.push(id_staging);
      const [actualizada] = await this.dataSource.query(
        `UPDATE "${schema}".bank_transactions_staging
         SET ${campos.join(', ')} WHERE id = $${idx} RETURNING *`,
        valores,
      );
  
      return actualizada;
    }
  
    async guardarDistribucion(
      id_importacion: number,
      id_staging: number,
      dto: any,
      id_empresa: string,
    ) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
      await this.verificarImportacion(schema, id_importacion);
  
      const [fila] = await this.dataSource.query(
        `SELECT * FROM "${schema}".bank_transactions_staging
         WHERE id = $1 AND id_importacion = $2 AND procesado = FALSE`,
        [id_staging, id_importacion],
      );
  
      if (!fila) throw new NotFoundException(`Fila ${id_staging} no encontrada o ya consolidada`);
  
      if (parseFloat(fila.monto) >= 0) {
        throw new BadRequestException('Las distribuciones solo aplican a egresos (monto negativo)');
      }
  
      const montoTotal = Math.abs(parseFloat(fila.monto));
      const sumaDistribuciones = dto.distribuciones.reduce((acc: number, d: any) => acc + d.monto, 0);
  
      if (Math.abs(sumaDistribuciones - montoTotal) > 0.01) {
        throw new BadRequestException(
          `La suma de distribuciones (${sumaDistribuciones}) debe ser igual al monto del egreso (${montoTotal})`,
        );
      }
  
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
  
      try {
        await queryRunner.query(
          `DELETE FROM "${schema}".staging_distributions WHERE id_staging = $1`,
          [id_staging],
        );
  
        for (const dist of dto.distribuciones) {
          await queryRunner.query(
            `INSERT INTO "${schema}".staging_distributions (id_staging, id_empresa, monto, porcentaje)
             VALUES ($1, $2, $3, $4)`,
            [id_staging, dist.id_empresa, dist.monto,
              dist.porcentaje ?? parseFloat(((dist.monto / montoTotal) * 100).toFixed(2))],
          );
        }
  
        await queryRunner.commitTransaction();
  
        const distribuciones = await this.dataSource.query(
          `SELECT * FROM "${schema}".staging_distributions WHERE id_staging = $1`,
          [id_staging],
        );
  
        return { ...fila, distribuciones };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    }
  
    async limpiarDistribucion(id_importacion: number, id_staging: number, id_empresa: string) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
      await this.verificarImportacion(schema, id_importacion);
  
      await this.dataSource.query(
        `DELETE FROM "${schema}".staging_distributions WHERE id_staging = $1`,
        [id_staging],
      );
  
      return { mensaje: 'Distribuciones eliminadas correctamente' };
    }
  
    // ─────────────────────────────────────────────
    // PASO 4 — Consolidación a tablas reales
    // ─────────────────────────────────────────────
  
    async consolidar(id_importacion: number, id_empresa: string) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
      const importacion = await this.verificarImportacion(schema, id_importacion);
  
      // Solo filas nuevas, no excluidas (es_duplicado=false) y no procesadas
      const filasPendientes = await this.dataSource.query(
        `SELECT s.*, 
           COALESCE(
             JSON_AGG(d.*) FILTER (WHERE d.id IS NOT NULL), '[]'
           ) AS distribuciones
         FROM "${schema}".bank_transactions_staging s
         LEFT JOIN "${schema}".staging_distributions d ON d.id_staging = s.id
         WHERE s.id_importacion = $1
           AND s.es_duplicado = FALSE
           AND s.procesado = FALSE
         GROUP BY s.id
         ORDER BY s.fecha, s.fila_excel`,
        [id_importacion],
      );
  
      if (filasPendientes.length === 0) {
        throw new BadRequestException('No hay filas pendientes de consolidar en esta importación');
      }
  
      this.logger.log(`Consolidando ${filasPendientes.length} movimientos de importación ${id_importacion}`);
  
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
  
      try {
        let consolidados = 0;
  
        for (const fila of filasPendientes) {
          // Insertar en movimiento_bancario
          const [movimiento] = await queryRunner.query(
            `INSERT INTO "${schema}".movimiento_bancario
               (id_cuenta, fecha, concepto, referencia, monto, moneda,
                tasa_vigente, monto_usd, id_categoria, tipo_destino,
                es_no_ventas, hash_dedup, id_importacion, id_empresa, notas)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             ON CONFLICT (hash_dedup, id_cuenta) DO NOTHING
             RETURNING id`,
            [
              importacion.id_cuenta,
              fila.fecha,
              fila.concepto,
              fila.referencia,
              fila.monto,
              'VES',
              fila.tasa_vigente,
              fila.monto_usd,
              fila.id_categoria,
              fila.tipo_destino,
              fila.tipo_destino === 'GASTO_OPERATIVO' ||
              fila.tipo_destino === 'COMISION_BANCARIA' ||
              fila.tipo_destino === 'IMPUESTO',
              fila.hash_dedup,
              id_importacion,
              id_empresa,
              fila.notas,
            ],
          );
  
          // Si el movimiento fue insertado (no era duplicado en tabla real)
          if (movimiento) {
            // Mover distribuciones si existen
            const distribuciones = typeof fila.distribuciones === 'string'
              ? JSON.parse(fila.distribuciones)
              : fila.distribuciones;
  
            if (Array.isArray(distribuciones) && distribuciones.length > 0) {
              for (const dist of distribuciones) {
                await queryRunner.query(
                  `INSERT INTO "${schema}".movimiento_distribucion
                     (id_movimiento, id_empresa, monto, porcentaje, notas)
                   VALUES ($1, $2, $3, $4, $5)`,
                  [movimiento.id, dist.id_empresa, dist.monto, dist.porcentaje, dist.notas ?? null],
                );
              }
            }
  
            consolidados++;
          }
  
          // Marcar fila de staging como procesada independientemente
          await queryRunner.query(
            `UPDATE "${schema}".bank_transactions_staging
             SET procesado = TRUE WHERE id = $1`,
            [fila.id],
          );
        }
  
        // Marcar importación como consolidada
        await queryRunner.query(
          `UPDATE "${schema}".importacion_bancaria
           SET estado = 'CONSOLIDADO', updated_at = NOW()
           WHERE id = $1`,
          [id_importacion],
        );
  
        await queryRunner.commitTransaction();
  
        this.logger.log(`Importación ${id_importacion} consolidada: ${consolidados} movimientos insertados`);
  
        return {
          success: true,
          id_importacion,
          consolidados,
          omitidos: filasPendientes.length - consolidados, // duplicados detectados en tabla real
          mensaje: `${consolidados} movimiento(s) consolidado(s) correctamente`,
        };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error(`Error consolidando importación ${id_importacion}`, error);
        throw error;
      } finally {
        await queryRunner.release();
      }
    }
  
    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────
  
    private async verificarCuenta(schema: string, id_cuenta: number, id_empresa: string) {
      const [cuenta] = await this.dataSource.query(
        `SELECT * FROM "${schema}".cuenta_bancaria
         WHERE id = $1 AND id_empresa = $2 AND activa = TRUE`,
        [id_cuenta, id_empresa],
      );
  
      if (!cuenta) {
        throw new NotFoundException(
          `Cuenta bancaria ${id_cuenta} no encontrada o no pertenece a esta empresa`,
        );
      }
  
      return cuenta;
    }
  
    private async verificarImportacion(schema: string, id_importacion: number) {
      const [importacion] = await this.dataSource.query(
        `SELECT * FROM "${schema}".importacion_bancaria WHERE id = $1`,
        [id_importacion],
      );
  
      if (!importacion) throw new NotFoundException(`Importación ${id_importacion} no encontrada`);
      if (importacion.estado === 'CONSOLIDADO') throw new BadRequestException('Esta importación ya fue consolidada');
      if (importacion.estado === 'CANCELADO') throw new BadRequestException('Esta importación fue cancelada');
  
      return importacion;
    }
  
    private async obtenerHashesExistentes(
      queryRunner: any,
      schema: string,
      id_cuenta: number,
    ): Promise<Set<string>> {
      const existentes = await queryRunner.query(
        `SELECT hash_dedup FROM "${schema}".movimiento_bancario WHERE id_cuenta = $1`,
        [id_cuenta],
      );
      return new Set(existentes.map((r: any) => r.hash_dedup));
    }
  
    private calcularHash(fecha: Date, referencia: string, monto: number): string {
      const str = `${fecha.toISOString().split('T')[0]}|${referencia}|${monto}`;
      return crypto.createHash('sha256').update(str).digest('hex');
    }
  }