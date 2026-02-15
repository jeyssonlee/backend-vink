import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimientoKardex } from './entities/movimiento-kardex.entity';
import { KardexService } from './kardex.service';
import { KardexController } from './kardex.controller'; 

@Global() // 👈 IMPORTANTE: Lo hacemos Global para no tener que importarlo en todos lados
@Module({
  imports: [TypeOrmModule.forFeature([MovimientoKardex])],
  controllers: [KardexController], // Créalo simple solo con un Get
  providers: [KardexService],
  exports: [KardexService],
})
export class KardexModule {}