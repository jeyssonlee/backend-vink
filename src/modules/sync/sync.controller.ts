import { Controller, Patch, Param, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Patch('anular/:id')
  anular(@Param('id') id: string) {
    return this.syncService.anularPedido({ id_pedido_local: id });
  }

  @Patch('finalizar/:id')
  finalizar(@Param('id') id: string) {
    return this.syncService.finalizarVenta(id);
  }
}