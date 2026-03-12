import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-prodcuto.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';
import { InventarioValorizadoQueryDto } from './dto/inventario-valorizado-query.dto';

@Controller('productos')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  // ── Maestro de productos (solo roles administrativos) ──────────────────────

  @Post()
  @Permisos(Permiso.CREAR_PRODUCTOS)
  async create(@Body() dto: CreateProductoDto, @Req() req) {
    if (!dto.id_empresa) dto.id_empresa = req.user.id_empresa;
    return await this.productosService.crear(dto);
  }

  @Post('importar')
  @Permisos(Permiso.CREAR_PRODUCTOS)
  @UseInterceptors(FileInterceptor('file'))
  async importarExcel(@UploadedFile() file: Express.Multer.File, @Req() req) {
    if (!file) throw new BadRequestException('No se subió ningún archivo');
    return await this.productosService.importarProductos(file, req.user.id_empresa);
  }

  @Post('importar-precios')
  @Permisos(Permiso.EDITAR_PRODUCTOS)
  @UseInterceptors(FileInterceptor('file'))
  async importarPrecios(@UploadedFile() file: Express.Multer.File, @Body('id_empresa') idEmpresa: string) {
    if (!file) throw new BadRequestException('No se subió ningún archivo');
    return this.productosService.importarPreciosExcel(file, idEmpresa);
  }

  @Get()
  @Permisos(Permiso.VER_PRODUCTOS) // ← Solo admin ve el maestro completo
  async findAll(@Query('id_empresa') idEmpresa: string, @Req() req) {
    return await this.productosService.listarTodos(idEmpresa || req.user.id_empresa);
  }

  @Get('inventario-valorizado')
  @UseGuards(JwtAuthGuard)                       // o el guard que uses en el módulo
  async getInventarioValorizado(
  @Query() query: InventarioValorizadoQueryDto,) {
  return this.productosService.getInventarioValorizado(query);
  }

  @Get('inventario-consulta')
  @Permisos(Permiso.VER_INVENTARIO)
  async listarInventarioConsulta(@Query('id_empresa') idEmpresa: string, @Req() req) {
  return await this.productosService.listarInventarioConsulta(idEmpresa || req.user.id_empresa);
  }

  @Patch(':id')
  @Permisos(Permiso.EDITAR_PRODUCTOS)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductoDto) {
    return await this.productosService.update(id, dto);
  }

  @Get('buscar')
  @Permisos(Permiso.VER_PRODUCTOS)
  async buscar(
  @Query('id_empresa') idEmpresa: string,
  @Query('q') q: string,
  @Query('limit') limit?: string,
  @Req() req?,
  ) {
  if (!q || q.trim().length < 2) return [];
  return await this.productosService.buscar(
    idEmpresa || req.user.id_empresa,
    q,
    limit ? parseInt(limit) : 10,
  );
  }

  @Delete(':id')
  @Permisos(Permiso.ELIMINAR_PRODUCTOS)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.productosService.remove(id);
  }

  @Get(':id/stock')
  @Permisos(Permiso.VER_INVENTARIO) // ← El vendedor puede ver stock disponible
  async verStock(@Param('id', ParseUUIDPipe) id: string) {
    const stock = await this.productosService.obtenerStockDisponible(id);
    return { id_producto: id, stock_disponible: stock };
  }

  @Get(':id')
  @Permisos(Permiso.VER_INVENTARIO) // ← El vendedor puede ver detalle de un producto
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.productosService.findOne(id);
  }
}
