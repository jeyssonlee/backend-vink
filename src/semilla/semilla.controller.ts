import { Controller, Post } from '@nestjs/common';
import { SemillaService } from './semilla.service';

@Controller('semilla')
export class SemillaController {
  constructor(private readonly semillaService: SemillaService) {}

  @Post()
  ejecutarSemilla() {
    return this.semillaService.ejecutarSemilla();
  }
}