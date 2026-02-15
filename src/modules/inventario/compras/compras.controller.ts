import { Controller, Get, Post, Body, Patch, Param, ParseUUIDPipe, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { ComprasService } from './compras.service';
import { CrearCompraDto } from './dto/crear-compra.dto'; // Asegúrate que el nombre del archivo sea correcto
import { AuthGuard } from '@nestjs/passport';

@Controller('compras')
@UseGuards(AuthGuard('jwt')) // 🔒 Protegemos todas las rutas
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Post()
  async create(@Body() createCompraDto: CrearCompraDto) {
    // CORRECCIÓN: Tu servicio usa 'crear' (en español)
    return await this.comprasService.crear(createCompraDto);
  }

  @Get()
  async findAll() {
    return await this.comprasService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.comprasService.findOne(id);
  }

  // ✅ RUTA DE ANULACIÓN ACTUALIZADA
  @Patch(':termino/anular')
  async anularCompra(@Param('termino') termino: string, @Req() req) {
    // 1. Extraemos la empresa del usuario logueado (Security Check)
    const idEmpresa = req.user.id_empresa;
    if (!idEmpresa) throw new UnauthorizedException('Usuario sin empresa asignada');

    // 2. Llamamos al método 'anular' pasando los DOS argumentos que espera
    return await this.comprasService.anular(termino, idEmpresa);
  }
}