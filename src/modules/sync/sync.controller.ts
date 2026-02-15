import { Controller, Patch, Param } from '@nestjs/common';
import { SyncService } from './sync.service'; // <--- Import correcto

@Controller('sync') // <--- Ruta renombrada
export class SyncController { // <--- Clase renombrada
  constructor(private readonly syncService: SyncService) {} // <--- Inyección renombrada

  @Patch('anular/:id')
  anular(@Param('id') id: string) {
    // Nota: aquí pasabas un objeto, asegúrate que anularPedido en service espere eso
    return this.syncService.anularPedido({ id_pedido_local: id }); 
  }

  @Patch('finalizar/:id')
  finalizar(@Param('id') id: string) {
    return this.syncService.finalizarVenta(id);
  }
}