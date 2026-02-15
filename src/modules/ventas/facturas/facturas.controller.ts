import { Controller, Post, Body, Get, Param, Patch, UseGuards, Req, ParseUUIDPipe } from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { CrearFacturaLoteDto } from './dto/crear-factura-lote.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard'; 

@Controller('facturas')
@UseGuards(JwtAuthGuard) 
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  // 1. Crear Factura (Individual)
  @Post()
  async crear(@Body() dto: CrearFacturaDto, @Req() req) {
    dto.id_empresa = req.user.id_empresa;
    dto.id_usuario = req.user.id_usuario; // ✅ Ahora esto ya no será undefined

    return await this.facturasService.crear(dto);
  }

  // 2. Procesar Lote Masivo 🚀
  @Post('masivo')
  async crearMasivo(@Body() dto: CrearFacturaLoteDto, @Req() req) {
    return await this.facturasService.crearLote(
      dto, 
      req.user.id_empresa,             
      req.user.id_usuario // ✅ Corregido
    );
  }

  // 3. Confirmar un Borrador
  @Patch(':id/confirmar')
  async confirmarBorrador(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    return await this.facturasService.confirmarBorrador(
      id, 
      req.user.id_empresa
    );
  }

  // 4. ANULAR FACTURA
  @Patch(':id/anular')
  async anular(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() body: { motivo?: string }, 
    @Req() req
  ) {
    const motivo = body?.motivo || 'Sin motivo especificado';
    return await this.facturasService.anular(
      id, 
      motivo, 
      req.user.id_usuario, // ✅ Ahora llega el UUID correcto, no undefined
      req.user.id_empresa
    );
  }

  // 5. Listar Facturas
  @Get()
  async findAll(@Req() req) {
    return await this.facturasService.findAll(req.user.id_empresa);
  }

  // 6. Ver una
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.facturasService.findOne(id);
  }
}