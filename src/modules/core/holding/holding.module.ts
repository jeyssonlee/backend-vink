import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Holding } from './entities/holding.entity';
import { HoldingService } from './holding.service';
import { HoldingController } from './holding.controller';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Holding, Rol])],
  controllers: [HoldingController],
  providers: [HoldingService, PermisosGuard],
  exports: [TypeOrmModule],
})
export class HoldingModule {}