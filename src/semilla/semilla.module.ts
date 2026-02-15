import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SemillaService } from './semilla.service';
import { SemillaController } from './semilla.controller';

// Importamos las entidades que el Seed necesita manipular
import { Holding } from '../modules/core/holding/entities/holding.entity';
import { Empresa } from '../modules/core/empresa/entities/empresa.entity';
import { Sucursal } from '../modules/core/sucursal/entities/sucursal.entity';
import { Rol } from 'src/modules/auth/roles/entities/rol.entity';
import { Usuario } from '../modules/core/usuarios/entities/usuarios.entity';
import { Almacen } from 'src/modules/inventario/almacenes/entities/almacen.entity';


@Module({
  imports: [
    // Registramos los repositorios para que el Service pueda usar @InjectRepository
    TypeOrmModule.forFeature([
     Holding,
     Empresa,
     Sucursal,
     Rol,
     Usuario,
     Almacen 
    ]),
  ],
  providers: [SemillaService],
  controllers: [SemillaController],
  exports: [SemillaService],
})
export class SemillaModule {}