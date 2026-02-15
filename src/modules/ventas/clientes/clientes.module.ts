import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './entities/clientes.entity';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente])], // Aquí se registra la entidad
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService], // Lo exportamos para que SyncModule pueda usarlo
})
export class ClientesModule {}