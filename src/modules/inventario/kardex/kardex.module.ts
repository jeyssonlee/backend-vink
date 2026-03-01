import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimientoKardex } from './entities/movimiento-kardex.entity';
import { KardexService } from './kardex.service';
import { KardexController } from './kardex.controller';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([MovimientoKardex, Rol])],
  controllers: [KardexController],
  providers: [KardexService, PermisosGuard],
  exports: [KardexService],
})
export class KardexModule {}