import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantResolverService } from '../tenant-resolver/tenant-resolver.service';
import {
  CrearTipoDto,
  ActualizarTipoDto,
  CrearSubtipoDto,
  ActualizarSubtipoDto,
} from './dto/tipo.dto';

@Injectable()
export class TiposService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  // ─────────────────────────────────────────────
  // TIPOS
  // ─────────────────────────────────────────────

  /**
   * Lista todos los tipos con sus subtipos anidados.
   * Los tipos de sistema (INGRESO/EGRESO) aparecen primero.
   */
  async listarTipos(id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    return this.dataSource.query(
      `SELECT
         t.id,
         t.nombre,
         t.descripcion,
         t.es_sistema,
         t.activo,
         t.created_at,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT(
               'id',          s.id,
               'nombre',      s.nombre,
               'descripcion', s.descripcion,
               'activo',      s.activo,
               'created_at',  s.created_at
             ) ORDER BY s.nombre
           ) FILTER (WHERE s.id IS NOT NULL),
           '[]'
         ) AS subtipos
       FROM "${schema}".tipo_movimiento t
       LEFT JOIN "${schema}".subtipo_movimiento s
         ON s.id_tipo = t.id AND s.activo = TRUE
       GROUP BY t.id
       ORDER BY t.es_sistema DESC, t.nombre`,
    );
  }

  async obtenerTipo(id: number, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    const [tipo] = await this.dataSource.query(
      `SELECT
         t.id, t.nombre, t.descripcion, t.es_sistema, t.activo, t.created_at,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT('id', s.id, 'nombre', s.nombre, 'activo', s.activo)
             ORDER BY s.nombre
           ) FILTER (WHERE s.id IS NOT NULL),
           '[]'
         ) AS subtipos
       FROM "${schema}".tipo_movimiento t
       LEFT JOIN "${schema}".subtipo_movimiento s ON s.id_tipo = t.id
       WHERE t.id = $1
       GROUP BY t.id`,
      [id],
    );

    if (!tipo) throw new NotFoundException(`Tipo ${id} no encontrado`);
    return tipo;
  }

  async crearTipo(dto: CrearTipoDto, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);

    const [existente] = await this.dataSource.query(
      `SELECT id FROM "${schema}".tipo_movimiento WHERE UPPER(nombre) = UPPER($1)`,
      [dto.nombre],
    );

    if (existente) {
      throw new BadRequestException(`Ya existe un tipo con el nombre "${dto.nombre}"`);
    }

    const [nuevo] = await this.dataSource.query(
      `INSERT INTO "${schema}".tipo_movimiento (nombre, descripcion, es_sistema)
       VALUES ($1, $2, FALSE)
       RETURNING *`,
      [dto.nombre.trim(), dto.descripcion ?? null],
    );

    return nuevo;
  }

  async actualizarTipo(id: number, dto: ActualizarTipoDto, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    const tipo = await this.obtenerTipo(id, id_empresa);

    if (tipo.es_sistema && dto.nombre !== undefined) {
      throw new BadRequestException(
        'No se puede cambiar el nombre de los tipos de sistema (INGRESO / EGRESO)',
      );
    }

    const campos: string[] = [];
    const valores: any[] = [];
    let idx = 1;

    if (dto.nombre !== undefined)      { campos.push(`nombre = $${idx++}`);      valores.push(dto.nombre.trim()); }
    if (dto.descripcion !== undefined) { campos.push(`descripcion = $${idx++}`); valores.push(dto.descripcion); }
    if (dto.activo !== undefined)      { campos.push(`activo = $${idx++}`);       valores.push(dto.activo); }

    if (campos.length === 0) throw new BadRequestException('No se enviaron campos para actualizar');

    valores.push(id);
    await this.dataSource.query(
      `UPDATE "${schema}".tipo_movimiento SET ${campos.join(', ')} WHERE id = $${idx}`,
      valores,
    );

    return this.obtenerTipo(id, id_empresa);
  }

  async eliminarTipo(id: number, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    const tipo = await this.obtenerTipo(id, id_empresa);

    if (tipo.es_sistema) {
      throw new BadRequestException(
        'Los tipos INGRESO y EGRESO son del sistema y no pueden eliminarse',
      );
    }

    // Verificar si tiene movimientos asociados
    const [{ total }] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM "${schema}".movimiento_bancario WHERE id_tipo = $1`,
      [id],
    );

    if (parseInt(total) > 0) {
      await this.dataSource.query(
        `UPDATE "${schema}".tipo_movimiento SET activo = FALSE WHERE id = $1`,
        [id],
      );
      return { mensaje: 'Tipo desactivado. Tiene movimientos asociados y no puede eliminarse.' };
    }

    await this.dataSource.query(
      `DELETE FROM "${schema}".tipo_movimiento WHERE id = $1`,
      [id],
    );

    return { mensaje: 'Tipo eliminado correctamente' };
  }

  // ─────────────────────────────────────────────
  // SUBTIPOS
  // ─────────────────────────────────────────────

  async crearSubtipo(id_tipo: number, dto: CrearSubtipoDto, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    await this.obtenerTipo(id_tipo, id_empresa); // valida que el tipo existe

    const [existente] = await this.dataSource.query(
      `SELECT id FROM "${schema}".subtipo_movimiento
       WHERE id_tipo = $1 AND UPPER(nombre) = UPPER($2)`,
      [id_tipo, dto.nombre],
    );

    if (existente) {
      throw new BadRequestException(
        `Ya existe el subtipo "${dto.nombre}" en este tipo`,
      );
    }

    const [nuevo] = await this.dataSource.query(
      `INSERT INTO "${schema}".subtipo_movimiento (id_tipo, nombre, descripcion)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id_tipo, dto.nombre.trim(), dto.descripcion ?? null],
    );

    return nuevo;
  }

  async actualizarSubtipo(
    id_tipo: number,
    id_subtipo: number,
    dto: ActualizarSubtipoDto,
    id_empresa: string,
  ) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    await this.obtenerSubtipo(schema, id_tipo, id_subtipo);

    const campos: string[] = [];
    const valores: any[] = [];
    let idx = 1;

    if (dto.nombre !== undefined)      { campos.push(`nombre = $${idx++}`);      valores.push(dto.nombre.trim()); }
    if (dto.descripcion !== undefined) { campos.push(`descripcion = $${idx++}`); valores.push(dto.descripcion); }
    if (dto.activo !== undefined)      { campos.push(`activo = $${idx++}`);       valores.push(dto.activo); }

    if (campos.length === 0) throw new BadRequestException('No se enviaron campos para actualizar');

    valores.push(id_subtipo);
    const [actualizado] = await this.dataSource.query(
      `UPDATE "${schema}".subtipo_movimiento SET ${campos.join(', ')}
       WHERE id = $${idx} RETURNING *`,
      valores,
    );

    return actualizado;
  }

  async eliminarSubtipo(id_tipo: number, id_subtipo: number, id_empresa: string) {
    const schema = await this.tenantResolver.resolverSchema(id_empresa);
    await this.obtenerSubtipo(schema, id_tipo, id_subtipo);

    const [{ total }] = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM "${schema}".categoria_movimiento WHERE id_subtipo = $1`,
      [id_subtipo],
    );

    if (parseInt(total) > 0) {
      await this.dataSource.query(
        `UPDATE "${schema}".subtipo_movimiento SET activo = FALSE WHERE id = $1`,
        [id_subtipo],
      );
      return { mensaje: 'Subtipo desactivado. Tiene categorías asociadas y no puede eliminarse.' };
    }

    await this.dataSource.query(
      `DELETE FROM "${schema}".subtipo_movimiento WHERE id = $1`,
      [id_subtipo],
    );

    return { mensaje: 'Subtipo eliminado correctamente' };
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  private async obtenerSubtipo(schema: string, id_tipo: number, id_subtipo: number) {
    const [subtipo] = await this.dataSource.query(
      `SELECT * FROM "${schema}".subtipo_movimiento WHERE id = $1 AND id_tipo = $2`,
      [id_subtipo, id_tipo],
    );

    if (!subtipo) {
      throw new NotFoundException(`Subtipo ${id_subtipo} no encontrado en el tipo ${id_tipo}`);
    }

    return subtipo;
  }

  /**
   * Resuelve el id del tipo INGRESO o EGRESO dado un monto.
   * Usado por el wizard de importación para auto-asignar el tipo.
   * monto > 0 → INGRESO | monto < 0 → EGRESO
   */
  async resolverTipoPorMonto(monto: number, schema: string): Promise<number | null> {
    const nombre = monto >= 0 ? 'INGRESO' : 'EGRESO';
    const [tipo] = await this.dataSource.query(
      `SELECT id FROM "${schema}".tipo_movimiento
       WHERE UPPER(nombre) = $1 AND es_sistema = TRUE`,
      [nombre],
    );
    return tipo?.id ?? null;
  }
}
