import { Controller, Post, Body, Patch, Param, Get, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Query, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs'; // Necesario para asegurar carpetas en Windows
import { randomUUID } from 'crypto';

import { CobranzasService } from './cobranzas.service';
import { CreateCobranzaDto } from './dto/create-cobranza.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; 
import { GetUser } from '../auth/decorators/get-user.decorator'; 

@Controller('cobranzas')
@UseGuards(JwtAuthGuard)
export class CobranzasController {
  private readonly logger = new Logger(CobranzasController.name);

  constructor(private readonly cobranzasService: CobranzasService) {}

  // REGISTRO ESTÁNDAR (JSON)
  @Post()
  create(@Body() dto: CreateCobranzaDto, @GetUser() user: any) {
    dto.id_vendedor = user.id_usuario; 
    dto.id_empresa = user.id_empresa;
    return this.cobranzasService.create(dto);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = join(process.cwd(), 'uploads', 'comprobantes');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueName = randomUUID();
        cb(null, `${uniqueName}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
        return cb(new BadRequestException('Solo se permiten archivos de imagen (jpg, jpeg, png, webp)'), false);
      }
      cb(null, true);
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  }))
  async createWithUpload(
    @UploadedFile() file: Express.Multer.File, 
    @Body() body: any, 
    @GetUser() user: any
  ) {
    if (!body.data) throw new BadRequestException('Faltan los datos del pago');
    
    // 1. Parseamos los datos
    const datosPago = JSON.parse(body.data);

    if (!file) {
      this.logger.warn(`Solicitud de carga recibida sin archivo o archivo invalido. Usuario: ${user.id_usuario}`);
    }
  
    // 2. Inyectamos los datos del usuario y archivo
    const payloadCompleto = {
      ...datosPago,
      id_vendedor: user.id_usuario,
      id_empresa: user.id_empresa,
      fecha_reporte: datosPago.fecha_reporte || new Date().toISOString(),
      // Forzamos la URL aquí:
      url_comprobante: file ? `/comprobantes/${file.filename}` : null
    };
  
    // Este log DEBE mostrar url_comprobante ahora
    console.log('Datos finales a procesar:', payloadCompleto); 
  
    return this.cobranzasService.create(payloadCompleto);
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

  @Get('historial')
  async historial(@Query('id_empresa') idEmpresa: string) {
    return this.cobranzasService.findHistorial(idEmpresa);
  }

  @Post('manual')
  async createManual(@Body() createCobranzaDto: any) {
    // Asumimos que el DTO es similar al de creación normal
    return this.cobranzasService.createManual(createCobranzaDto);
  }

  @Patch(':id/anular')
  anularCobranza(@Param('id') id: string) {
    return this.cobranzasService.anularCobranza(id);
  }

  @Get('vendedor/historial')
async historialVendedor(@GetUser() user: any) {
  // Retorna las cobranzas del vendedor logueado para que vea si fueron aprobadas o rechazadas
  return this.cobranzasService.findHistorialByVendedor(user.id_usuario);
}
}