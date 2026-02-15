import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query, UseGuards, Req } from '@nestjs/common';
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-prodcuto.dto';
import { AuthGuard } from '@nestjs/passport';
import { UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';


@Controller('productos')
@UseGuards(AuthGuard('jwt'))
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Post()
  async create(@Body() createProductoDto: CreateProductoDto, @Req() req) {
    if (!createProductoDto.id_empresa) createProductoDto.id_empresa = req.user.id_empresa;
    return await this.productosService.crear(createProductoDto);
  }

  @Post('importar')
  @UseGuards(JwtAuthGuard) // 🛡️ Protegemos la ruta para obtener el usuario
  @UseInterceptors(FileInterceptor('file'))
  async importarExcel(@UploadedFile() file: Express.Multer.File, @Req() req) {
    if (!file) throw new BadRequestException('No se subió ningún archivo');
    
    // Obtenemos el ID de la empresa desde el usuario logueado (Token JWT)
    const idEmpresa = req.user.id_empresa; 

    return await this.productosService.importarProductos(file, idEmpresa);
  }

  @Get()
  async findAll(@Query('id_empresa') idEmpresa: string, @Req() req) {
    const empresa = idEmpresa || req.user.id_empresa;
    return await this.productosService.listarTodos(empresa);
  }

  @Get(':id/stock')
  async verStock(@Param('id', ParseUUIDPipe) id: string) {
    const stock = await this.productosService.obtenerStockDisponible(id);
    return { id_producto: id, stock_disponible: stock };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.productosService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateProductoDto: UpdateProductoDto) {
    return await this.productosService.update(id, updateProductoDto); // ⚠️ Requiere implementar en service
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.productosService.remove(id); // ⚠️ Requiere implementar en service
  }
}