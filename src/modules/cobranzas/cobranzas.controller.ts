import { Controller, Post, Body, Patch, Param, Get, Query, UseGuards } from '@nestjs/common';
import { CobranzasService } from './cobranzas.service';
import { CreateCobranzaDto } from './dto/create-cobranza.dto';

// 👇 1. Importaciones de Auth corregidas
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; 
import { GetUser } from '../auth/decorators/get-user.decorator'; 

@Controller('cobranzas')
@UseGuards(JwtAuthGuard) // 🔒 Protegemos toda la ruta
export class CobranzasController {
  constructor(private readonly cobranzasService: CobranzasService) {}

  @Post()
  create(
    @Body() createCobranzaDto: CreateCobranzaDto,
    @GetUser() user: any // Usamos 'any' porque viene del token, no es la entidad completa de BD
  ) {
    // 🔐 SEGURIDAD:
    // 1. El vendedor ES el usuario logueado (evita suplantación)
    createCobranzaDto.id_vendedor = user.id_usuario; 

    // 2. La empresa ES la del token (evita registrar cobros en otra empresa)
    createCobranzaDto.id_empresa = user.id_empresa;

    return this.cobranzasService.create(createCobranzaDto);
  }

  @Patch(':id/aprobar')
  aprobar(
    @Param('id') id: string, 
    @GetUser() admin: any // El usuario logueado (Admin/Tesorero)
  ) {
    // Pasamos el ID del administrador que aprueba
    return this.cobranzasService.aprobarCobranza(id, admin.id_usuario);
  }

  @Patch(':id/rechazar')
  rechazar(
      @Param('id') id: string, 
      @GetUser() admin: any,
      @Body('motivo') motivo: string
  ) {
    return this.cobranzasService.rechazarCobranza(id, admin.id_usuario, motivo);
  }

  @Get('pendientes')
  getPendientes(
      @GetUser() user: any
  ) {
      // Solo devolvemos los pendientes de LA EMPRESA del usuario logueado
      return this.cobranzasService.findAllPendientes(user.id_empresa);
  }
}