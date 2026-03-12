import {
    Controller,
    Get,
    Post,
    Body,
    Query,
    UseGuards,
    UsePipes,
    ValidationPipe,
    ParseIntPipe,
    DefaultValuePipe,
  } from '@nestjs/common';
  import { TasaBcvService } from './tasa-bcv.service';
  import { RegistrarTasaManualDto } from './dto/registrar-tasa-manual.dto';
  import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
  import { PermisosGuard } from '../../auth/guards/permisos.guard';
  import { Permisos } from '../../auth/decorators/permisos.decorator';
  import { Permiso } from '../../auth/permisos.enum';
  
  @Controller('banco/tasa-bcv')
  @UseGuards(JwtAuthGuard)
  export class TasaBcvController {
    constructor(private readonly tasaBcvService: TasaBcvService) {}
  
    /**
     * GET /api/banco/tasa-bcv/vigente
     * Tasa activa para hoy — usada por el frontend en tiempo real.
     */
    @Get('vigente')
    obtenerVigente() {
      return this.tasaBcvService.obtenerTasaVigente();
    }
  
    /**
     * GET /api/banco/tasa-bcv/historial?limite=30
     * Historial de tasas registradas — útil para auditoría y UI.
     */
    @Get('historial')
    obtenerHistorial(
      @Query('limite', new DefaultValuePipe(30), ParseIntPipe) limite: number,
    ) {
      return this.tasaBcvService.obtenerHistorial(limite);
    }
  
    /**
     * POST /api/banco/tasa-bcv/manual
     * Solo ROOT — fallback cuando dolarapi.com está caído.
     * También permite corregir una tasa ya registrada.
     */
    @Post('manual')
    @UseGuards(PermisosGuard)
    @Permisos(Permiso.EDITAR_EMPRESA) // Reutiliza permiso ROOT hasta definir uno específico
    @UsePipes(new ValidationPipe({ whitelist: true }))
    registrarManual(@Body() dto: RegistrarTasaManualDto) {
      return this.tasaBcvService.registrarManual(dto);
    }
  }