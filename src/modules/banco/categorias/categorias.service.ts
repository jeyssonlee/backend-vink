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
  
    async listar(id_empresa: string) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
  
      // Devuelve categorías con sus palabras clave agrupadas en array
      const categorias = await this.dataSource.query(
        `SELECT
           c.id,
           c.nombre,
           c.descripcion,
           c.activa,
           c.created_at,
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT('id', r.id, 'palabra_clave', r.palabra_clave)
             ) FILTER (WHERE r.id IS NOT NULL),
             '[]'
           ) AS palabras_clave
         FROM "${schema}".categoria_movimiento c
         LEFT JOIN "${schema}".regla_categoria r
           ON r.id_categoria = c.id AND r.activa = TRUE
         GROUP BY c.id
         ORDER BY c.nombre`,
      );
  
      return categorias;
    }
  
    async obtener(id: number, id_empresa: string) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
  
      const [categoria] = await this.dataSource.query(
        `SELECT
           c.id,
           c.nombre,
           c.descripcion,
           c.activa,
           c.created_at,
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT('id', r.id, 'palabra_clave', r.palabra_clave)
             ) FILTER (WHERE r.id IS NOT NULL),
             '[]'
           ) AS palabras_clave
         FROM "${schema}".categoria_movimiento c
         LEFT JOIN "${schema}".regla_categoria r
           ON r.id_categoria = c.id AND r.activa = TRUE
         WHERE c.id = $1
         GROUP BY c.id`,
        [id],
      );
  
      if (!categoria) {
        throw new NotFoundException(`Categoría ${id} no encontrada`);
      }
  
      return categoria;
    }
  
    async crear(dto: CrearCategoriaDto, id_empresa: string) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
  
      // Verificar nombre único
      const [existente] = await this.dataSource.query(
        `SELECT id FROM "${schema}".categoria_movimiento WHERE UPPER(nombre) = UPPER($1)`,
        [dto.nombre],
      );
  
      if (existente) {
        throw new BadRequestException(`Ya existe una categoría con el nombre "${dto.nombre}"`);
      }
  
      const [nueva] = await this.dataSource.query(
        `INSERT INTO "${schema}".categoria_movimiento (nombre, descripcion)
         VALUES ($1, $2)
         RETURNING *`,
        [dto.nombre, dto.descripcion ?? null],
      );
  
      // Insertar palabras clave iniciales si vienen en el DTO
      if (dto.palabras_clave && dto.palabras_clave.length > 0) {
        await this.insertarPalabras(schema, nueva.id, dto.palabras_clave);
      }
  
      return this.obtener(nueva.id, id_empresa);
    }
  
    async actualizar(id: number, dto: ActualizarCategoriaDto, id_empresa: string) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
  
      await this.obtener(id, id_empresa); // valida existencia
  
      const campos: string[] = [];
      const valores: any[] = [];
      let idx = 1;
  
      if (dto.nombre !== undefined) {
        campos.push(`nombre = $${idx++}`);
        valores.push(dto.nombre);
      }
      if (dto.descripcion !== undefined) {
        campos.push(`descripcion = $${idx++}`);
        valores.push(dto.descripcion);
      }
      if (dto.activa !== undefined) {
        campos.push(`activa = $${idx++}`);
        valores.push(dto.activa);
      }
  
      if (campos.length === 0) {
        throw new BadRequestException('No se enviaron campos para actualizar');
      }
  
      valores.push(id);
  
      await this.dataSource.query(
        `UPDATE "${schema}".categoria_movimiento
         SET ${campos.join(', ')}
         WHERE id = $${idx}`,
        valores,
      );
  
      return this.obtener(id, id_empresa);
    }
  
    async eliminar(id: number, id_empresa: string) {
      const schema = await this.tenantResolver.resolverSchema(id_empresa);
  
      await this.obtener(id, id_empresa);
  
      // Verificar si hay movimientos usando esta categoría
      const [{ total }] = await this.dataSource.query(
        `SELECT COUNT(*) AS total FROM "${schema}".movimiento_bancario WHERE id_categoria = $1`,
        [id],
      );
  
      if (parseInt(total) > 0) {
        // Tiene movimientos — solo desactivar
        await this.dataSource.query(
          `UPDATE "${schema}".categoria_movimiento SET activa = FALSE WHERE id = $1`,
          [id],
        );
        return {
          mensaje: 'Categoría desactivada. No se puede eliminar porque tiene movimientos asociados.',
        };
      }
  
      // Sin movimientos — eliminar (cascade borra las reglas)
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
  
      await this.obtener(id, id_empresa); // valida que la categoría existe
  
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
        `DELETE FROM "${schema}".regla_categoria
         WHERE id = $1 AND id_categoria = $2`,
        [id_regla, id_categoria],
      );
  
      if (resultado[1] === 0) {
        throw new NotFoundException(`Regla ${id_regla} no encontrada en la categoría ${id_categoria}`);
      }
  
      return { mensaje: 'Palabra clave eliminada correctamente' };
    }
  
    // ─────────────────────────────────────────────
    // MOTOR DE MATCHING — usado por el wizard de importación (Sprint 2)
    // ─────────────────────────────────────────────
  
    /**
     * Dado un concepto de movimiento, busca la categoría con más coincidencias.
     * Gana la categoría con mayor cantidad de palabras clave que hacen match.
     * En caso de empate, gana la categoría con menor id (creada primero).
     */
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
    // HELPERS PRIVADOS
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
  
        // ON CONFLICT DO NOTHING — ignora duplicados silenciosamente
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