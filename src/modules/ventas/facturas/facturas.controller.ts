import { Controller, Post, Body, Get, Param, Patch, UseGuards, Req, ParseUUIDPipe, Query } from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { CrearFacturaLoteDto } from './dto/crear-factura-lote.dto';
// Asegúrate de que esta ruta sea correcta según tu estructura
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard'; 

@Controller('facturas')
@UseGuards(JwtAuthGuard) 
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  // 1. Crear Factura (Individual)
  @Post()
  create(@Body() createFacturaDto: CrearFacturaDto, @Req() req: any) {
    // Pasamos el usuario completo del request (req.user)
    return this.facturasService.crear(createFacturaDto, req.user);
  }

  // 2. Procesar Lote Masivo
  @Post('masivo')
  async crearMasivo(@Body() dto: CrearFacturaLoteDto, @Req() req: any) {
    return await this.facturasService.crearLote(
      dto, 
      req.user.id_empresa,             
      req.user.id_usuario 
    );
  }

  // 3. Confirmar un Borrador
  @Patch(':id/confirmar')
  async confirmarBorrador(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return await this.facturasService.confirmarBorrador(
      id, 
      req.user.id_empresa
    );
  }

  // 4. Anular Factura
  @Patch(':id/anular')
  async anular(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() body: { motivo?: string }, 
    @Req() req: any
  ) {
    const motivo = body?.motivo || 'Sin motivo especificado';
    return await this.facturasService.anular(
      id, 
      motivo, 
      req.user.id_usuario,
      req.user.id_empresa
    );
  }

  // 5. Listar Facturas
  @Get()
  findAll(
    @Query('id_empresa') idEmpresa: string,
    @Query('id_cliente') idCliente?: string, // 👈 El signo '?' lo hace opcional
  ) {
    return this.facturasService.findAll(idEmpresa, idCliente);
  }

  // 6. Ver una Factura
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.facturasService.findOne(id);
  }
}