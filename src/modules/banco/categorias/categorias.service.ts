import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantResolverService } from '../tenant-resolver/tenant-resolver.service';
import {
  CrearCategoriaDto,
  ActualizarCategoriaDto,
  AgregarPalabrasClaveDto,
} from './dto/categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  // ─────────────────────────────────────────────
  // CATEGORÍAS
  // ─────────────────────────────────────────────

  /**
   * Lista categorías con su subtipo, tipo y palabras clave.
   * Devuelve la jerarquía completa: tipo > subtipo > categoría.
   */
  async listar(id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    return this.dataSource.query(
      `SELECT
         c.id,
         c.nombre,
         c.descripcion,
         c.activa,
         c.created_at,
         c.id_subtipo,
         s.nombre    AS subtipo_nombre,
         s.id_tipo,
         t.nombre    AS tipo_nombre,
         t.es_sistema,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT('id', r.id, 'palabra_clave', r.palabra_clave)
           ) FILTER (WHERE r.id IS NOT NULL),
           '[]'
         ) AS palabras_clave
       FROM "${schema}".categoria_movimiento c
       LEFT JOIN "${schema}".subtipo_movimiento s ON s.id = c.id_subtipo
       LEFT JOIN "${schema}".tipo_movimiento    t ON t.id = s.id_tipo
       LEFT JOIN "${schema}".regla_categoria    r ON r.id_categoria = c.id AND r.activa = TRUE
       GROUP BY c.id, s.id, s.nombre, s.id_tipo, t.nombre, t.es_sistema
       ORDER BY t.nombre NULLS LAST, s.nombre NULLS LAST, c.nombre`,
    );
  }

  async obtener(id: number, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    const [categoria] = await this.dataSource.query(
      `SELECT
         c.id, c.nombre, c.descripcion, c.activa, c.created_at,
         c.id_subtipo,
         s.nombre  AS subtipo_nombre,
         s.id_tipo,
         t.nombre  AS tipo_nombre,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT('id', r.id, 'palabra_clave', r.palabra_clave)
           ) FILTER (WHERE r.id IS NOT NULL),
           '[]'
         ) AS palabras_clave
       FROM "${schema}".categoria_movimiento c
       LEFT JOIN "${schema}".subtipo_movimiento s ON s.id = c.id_subtipo
       LEFT JOIN "${schema}".tipo_movimiento    t ON t.id = s.id_tipo
       LEFT JOIN "${schema}".regla_categoria    r ON r.id_categoria = c.id AND r.activa = TRUE
       WHERE c.id = $1
       GROUP BY c.id, s.id, s.nombre, s.id_tipo, t.nombre`,
      [id],
    );

    if (!categoria) throw new NotFoundException(`Categoría ${id} no encontrada`);
    return categoria;
  }

  async crear(dto: CrearCategoriaDto, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    const [existente] = await this.dataSource.query(
      `SELECT id FROM "${schema}".categoria_movimiento WHERE UPPER(nombre) = UPPER($1)`,
      [dto.nombre],
    );

    if (existente) {
      throw new BadRequestException(`Ya existe una categoría con el nombre "${dto.nombre}"`);
    }

    // Validar que el subtipo existe si se provee
    if (dto.id_subtipo) {
      const [subtipo] = await this.dataSource.query(
        `SELECT id FROM "${schema}".subtipo_movimiento WHERE id = $1 AND activo = TRUE`,
        [dto.id_subtipo],
      );
      if (!subtipo) throw new BadRequestException(`Subtipo ${dto.id_subtipo} no encontrado`);
    }

    const [nueva] = await this.dataSource.query(
      `INSERT INTO "${schema}".categoria_movimiento (nombre, descripcion, id_subtipo)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [dto.nombre, dto.descripcion ?? null, dto.id_subtipo ?? null],
    );

    if (dto.palabras_clave && dto.palabras_clave.length > 0) {
      await this.insertarPalabras(schema, nueva.id, dto.palabras_clave);
    }

    return this.obtener(nueva.id, id_empresa);
  }

  async actualizar(id: number, dto: ActualizarCategoriaDto, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    await this.obtener(id, id_empresa);

    if (dto.id_subtipo) {
      const [subtipo] = await this.dataSource.query(
        `SELECT id FROM "${schema}".subtipo_movimiento WHERE id = $1 AND activo = TRUE`,
        [dto.id_subtipo],
      );
      if (!subtipo) throw new BadRequestException(`Subtipo ${dto.id_subtipo} no encontrado`);
    }

    const campos: string[] = [];
    const valores: any[] = [];
    let idx = 1;

    if (dto.nombre !== undefined)      { campos.push(`nombre = $${idx++}`);      valores.push(dto.nombre); }
    if (dto.descripcion !== undefined) { campos.push(`descripcion = $${idx++}`); valores.push(dto.descripcion); }
    if (dto.activa !== undefined)      { campos.push(`activa = $${idx++}`);      valores.push(dto.activa); }
    if ('id_subtipo' in dto)           { campos.push(`id_subtipo = $${idx++}`);  valores.push(dto.id_subtipo ?? null); }

    if (campos.length === 0) throw new BadRequestException('No se enviaron campos para actualizar');

    valores.push(id);
    await this.dataSource.query(
      `UPDATE "${schema}".categoria_movimiento SET ${campos.join(', ')} WHERE id = $${idx}`,
      valores,
    );

    return this.obtener(id, id_empresa);
  }

  async eliminar(id: number, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    await this.obtener(id, id_empresa);

    const [{ total }] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM "${schema}".movimiento_bancario WHERE id_categoria = $1`,
      [id],
    );

    if (parseInt(total) > 0) {
      await this.dataSource.query(
        `UPDATE "${schema}".categoria_movimiento SET activa = FALSE WHERE id = $1`,
        [id],
      );
      return { mensaje: 'Categoría desactivada. No se puede eliminar porque tiene movimientos asociados.' };
    }

    await this.dataSource.query(
      `DELETE FROM "${schema}".categoria_movimiento WHERE id = $1`,
      [id],
    );

    return { mensaje: 'Categoría eliminada correctamente' };
  }

  // ─────────────────────────────────────────────
  // PALABRAS CLAVE
  // ─────────────────────────────────────────────

  async agregarPalabras(id: number, dto: AgregarPalabrasClaveDto, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    await this.obtener(id, id_empresa);

    const insertadas = await this.insertarPalabras(schema, id, dto.palabras_clave);

    return {
      mensaje: `${insertadas} palabra(s) clave agregada(s)`,
      categoria: await this.obtener(id, id_empresa),
    };
  }

  async eliminarPalabra(id_categoria: number, id_regla: number, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    await this.obtener(id_categoria, id_empresa);

    const resultado = await this.dataSource.query(
      `DELETE FROM "${schema}".regla_categoria WHERE id = $1 AND id_categoria = $2`,
      [id_regla, id_categoria],
    );

    if (resultado[1] === 0) {
      throw new NotFoundException(`Regla ${id_regla} no encontrada en la categoría ${id_categoria}`);
    }

    return { mensaje: 'Palabra clave eliminada correctamente' };
  }

  // ─────────────────────────────────────────────
  // MOTOR DE MATCHING — usado por el wizard de importación
  // ─────────────────────────────────────────────

  async resolverCategoria(
    concepto: string,
    id_empresa: string,
  ): Promise<{ id_categoria: number; nombre: string; coincidencias: number } | null> {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    const resultados = await this.dataSource.query(
      `SELECT
         c.id AS id_categoria,
         c.nombre,
         COUNT(r.id) AS coincidencias
       FROM "${schema}".categoria_movimiento c
       JOIN "${schema}".regla_categoria r ON r.id_categoria = c.id AND r.activa = TRUE
       WHERE c.activa = TRUE
         AND $1 ILIKE '%' || r.palabra_clave || '%'
       GROUP BY c.id, c.nombre
       ORDER BY coincidencias DESC, c.id ASC
       LIMIT 1`,
      [concepto],
    );

    if (resultados.length === 0) return null;

    return {
      id_categoria: resultados[0].id_categoria,
      nombre: resultados[0].nombre,
      coincidencias: parseInt(resultados[0].coincidencias),
    };
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private async insertarPalabras(
    schema: string,
    id_categoria: number,
    palabras: string[],
  ): Promise<number> {
    let insertadas = 0;

    for (const palabra of palabras) {
      const limpia = palabra.trim().toLowerCase();
      if (!limpia) continue;

      const resultado = await this.dataSource.query(
        `INSERT INTO "${schema}".regla_categoria (id_categoria, palabra_clave)
         VALUES ($1, $2)
         ON CONFLICT (id_categoria, palabra_clave) DO NOTHING`,
        [id_categoria, limpia],
      );

      if (resultado[1] > 0) insertadas++;
    }

    return insertadas;
  }
}
