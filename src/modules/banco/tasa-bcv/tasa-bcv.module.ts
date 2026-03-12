import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasaBcvController } from './tasa-bcv.controller';
import { TasaBcvService } from './tasa-bcv.service';
import { TasaBcv } from './entities/tasa-bcv.entity';
import { MonitorDolarModule } from '../../utilidades/monitor-dolar/monitor-dolar.module';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Rol } from '../../auth/roles/entities/rol.entity';

/**
 * Ubicación: src/modules/banco/tasa-bcv/
 *
 * Exporta TasaBcvService para que otros módulos del banco
 * puedan consultar la tasa vigente para una fecha dada.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TasaBcv, Rol]),
    MonitorDolarModule,
  ],
  controllers: [TasaBcvController],
  providers: [TasaBcvService, PermisosGuard],
  exports: [TasaBcvService],
})
export class TasaBcvModule {}