import {
    Injectable,
    Logger,
    BadRequestException,
    NotFoundException,
  } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';
  import { Cron, CronExpression } from '@nestjs/schedule';
  import { TasaBcv } from './entities/tasa-bcv.entity';
  import { MonitorDolarService } from '../../utilidades/monitor-dolar/monitor-dolar.service';
  import { RegistrarTasaManualDto } from './dto/registrar-tasa-manual.dto';
  
  @Injectable()
  export class TasaBcvService {
    private readonly logger = new Logger(TasaBcvService.name);
  
    constructor(
      @InjectRepository(TasaBcv)
      private readonly tasaRepo: Repository<TasaBcv>,
      private readonly monitorDolar: MonitorDolarService,
    ) {}
  
    // ─────────────────────────────────────────────
    // CRON — todos los días a las 8:00 AM
    // ─────────────────────────────────────────────
  
    @Cron('0 8 * * *', { name: 'actualizar_tasa_bcv', timeZone: 'America/Caracas' })
    async actualizarTasaDiaria(): Promise<void> {
      const hoy = this.fechaHoy();
      const diaSemana = hoy.getDay(); // 0=Dom, 6=Sab
  
      // El BCV no publica tasas en fin de semana.
      // La query WHERE fecha_vigencia <= fecha ORDER BY fecha_vigencia DESC LIMIT 1
      // devuelve automáticamente la tasa del viernes para sábado y domingo.
      if (diaSemana === 0 || diaSemana === 6) {
        this.logger.log(`Cron BCV omitido — fin de semana (día ${diaSemana})`);
        return;
      }
  
      const yaExiste = await this.tasaRepo.findOne({
        where: { fecha_vigencia: hoy },
      });
  
      if (yaExiste) {
        this.logger.log(`Tasa del ${this.formatFecha(hoy)} ya registrada (id: ${yaExiste.id})`);
        return;
      }
  
      await this.fetchYPersistir(hoy);
    }
  
    // ─────────────────────────────────────────────
    // CONSULTA PRINCIPAL — tasa vigente para una fecha de movimiento
    // ─────────────────────────────────────────────
  
    /**
     * Devuelve la tasa vigente para una fecha dada.
     * Cubre automáticamente fines de semana y lunes
     * (usa la última tasa cuya fecha_vigencia <= fecha_movimiento).
     */
    async obtenerTasaParaFecha(fecha: Date): Promise<TasaBcv> {
      const tasa = await this.tasaRepo
        .createQueryBuilder('t')
        .where('t.fecha_vigencia <= :fecha', { fecha })
        .orderBy('t.fecha_vigencia', 'DESC')
        .limit(1)
        .getOne();
  
      if (!tasa) {
        throw new NotFoundException(
          `No hay tasa BCV registrada para la fecha ${this.formatFecha(fecha)}. Registra una manualmente.`,
        );
      }
  
      return tasa;
    }
  
    /**
     * Tasa vigente para hoy — shortcut usado por otros módulos.
     */
    async obtenerTasaVigente(): Promise<TasaBcv> {
      return this.obtenerTasaParaFecha(this.fechaHoy());
    }
  
    // ─────────────────────────────────────────────
    // HISTORIAL
    // ─────────────────────────────────────────────
  
    async obtenerHistorial(limite = 30): Promise<TasaBcv[]> {
      return this.tasaRepo.find({
        order: { fecha_vigencia: 'DESC' },
        take: limite,
      });
    }
  
    // ─────────────────────────────────────────────
    // FALLBACK MANUAL — endpoint ROOT para downtime de dolarapi.com
    // ─────────────────────────────────────────────
  
    async registrarManual(dto: RegistrarTasaManualDto): Promise<TasaBcv> {
      const fechaVigencia = new Date(dto.fecha_vigencia);
      const fechaPublicacion = dto.fecha_publicacion
        ? new Date(dto.fecha_publicacion)
        : this.fechaHoy();
  
      const existente = await this.tasaRepo.findOne({
        where: { fecha_vigencia: fechaVigencia },
      });
  
      if (existente) {
        // Permite actualizar si ya existe — útil para corregir errores
        this.logger.warn(
          `Sobreescribiendo tasa del ${this.formatFecha(fechaVigencia)} — era ${existente.tasa}, nueva: ${dto.tasa}`,
        );
        existente.tasa = dto.tasa;
        existente.fecha_publicacion = fechaPublicacion;
        existente.origen = 'MANUAL';
        existente.notas = dto.notas ?? null;
        return this.tasaRepo.save(existente);
      }
  
      const nueva = this.tasaRepo.create({
        tasa: dto.tasa,
        fecha_vigencia: fechaVigencia,
        fecha_publicacion: fechaPublicacion,
        origen: 'MANUAL',
        notas: dto.notas ?? null,
      });
  
      return this.tasaRepo.save(nueva);
    }
  
    // ─────────────────────────────────────────────
    // HELPERS PRIVADOS
    // ─────────────────────────────────────────────
  
    private async fetchYPersistir(fechaVigencia: Date): Promise<void> {
      this.logger.log(`Obteniendo tasa BCV para ${this.formatFecha(fechaVigencia)}...`);
  
      const resultado = await this.monitorDolar.obtenerTasaBcv();
  
      if (!resultado.success || !resultado.tasa) {
        this.logger.error(
          'dolarapi.com no respondió correctamente. Registra la tasa manualmente via POST /banco/tasa-bcv/manual',
        );
        return; // No persiste el fallback hardcodeado — el manual es responsabilidad del ROOT
      }
  
      const nueva = this.tasaRepo.create({
        tasa: resultado.tasa,
        fecha_vigencia: fechaVigencia,
        fecha_publicacion: this.calcularFechaPublicacion(fechaVigencia),
        origen: 'CRON',
        notas: null,
      });
  
      await this.tasaRepo.save(nueva);
      this.logger.log(
        `Tasa BCV guardada: ${resultado.tasa} Bs/USD (vigencia: ${this.formatFecha(fechaVigencia)})`,
      );
    }
  
    private calcularFechaPublicacion(fechaVigencia: Date): Date {
      const pub = new Date(fechaVigencia);
      const diaSemana = fechaVigencia.getDay(); // 1 = lunes
      if (diaSemana === 1) {
        pub.setDate(pub.getDate() - 3); // lunes → publicada el viernes
      } else {
        pub.setDate(pub.getDate() - 1); // resto → publicada el dia anterior
      }
      return pub;
    }
  
    private fechaHoy(): Date {
      // Normaliza a medianoche en UTC para comparaciones de fecha puras
      const ahora = new Date();
      return new Date(
        Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()),
      );
    }
  
    private formatFecha(fecha: Date): string {
      return fecha.toISOString().split('T')[0];
    }
  }