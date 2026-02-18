import { Controller, Post, Body, Patch, Param, Get, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs'; // Necesario para asegurar carpetas en Windows

import { CobranzasService } from './cobranzas.service';
import { CreateCobranzaDto } from './dto/create-cobranza.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; 
import { GetUser } from '../auth/decorators/get-user.decorator'; 

@Controller('cobranzas')
@UseGuards(JwtAuthGuard)
export class CobranzasController {
  constructor(private readonly cobranzasService: CobranzasService) {}

  // REGISTRO ESTÁNDAR (JSON)
  @Post()
  create(@Body() dto: CreateCobranzaDto, @GetUser() user: any) {
    dto.id_vendedor = user.id_usuario; 
    dto.id_empresa = user.id_empresa;
    return this.cobranzasService.create(dto);
  }

  // REGISTRO CON ARCHIVO (MULTIPART)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = './uploads/comprobantes';
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  async createWithUpload(
    @UploadedFile() file: Express.Multer.File, 
    @Body() body: any, 
    @GetUser() user: any
  ) {
    if (!body.data) throw new BadRequestException('Faltan los datos del pago');
    const datosPago = JSON.parse(body.data);

    // Inyectamos seguridad desde el Token
    datosPago.id_vendedor = user.id_usuario;
    datosPago.id_empresa = user.id_empresa;
    if (file) datosPago.url_comprobante = `/uploads/comprobantes/${file.filename}`;

    return this.cobranzasService.create(datosPago);
  }

  @Get('pendientes')
  getPendientes(@GetUser() user: any) {
    return this.cobranzasService.findAllPendientes(user.id_empresa);
  }

  // NUEVO: Ruta para ver todas las cobranzas (Historial)
  @Get()
  findAll(@GetUser() user: any) {
    return this.cobranzasService.findAll(user.id_empresa);
  }

  @Patch(':id/aprobar')
  aprobar(@Param('id') id: string, @GetUser() admin: any) {
    return this.cobranzasService.aprobarCobranza(id, admin.id_usuario);
  }

  @Patch(':id/rechazar')
  rechazar(@Param('id') id: string, @GetUser() admin: any, @Body('motivo') motivo: string) {
    return this.cobranzasService.rechazarCobranza(id, admin.id_usuario, motivo);
  }
}