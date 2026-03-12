import { Controller, Post, Body, Patch, Param, Get, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Query, Logger, ParseFilePipe, MaxFileSizeValidator } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs'; // Necesario para asegurar carpetas en Windows
import { randomUUID } from 'crypto';

import { CobranzasService } from './cobranzas.service';
import { CreateCobranzaDto } from './dto/create-cobranza.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; 
import { GetUser } from '../auth/decorators/get-user.decorator';
import { PermisosGuard } from '../auth/guards/permisos.guard';
import { Permisos } from '../auth/decorators/permisos.decorator';
import { Permiso } from '../auth/permisos.enum';

@Controller('cobranzas')
@UseGuards(JwtAuthGuard, PermisosGuard)
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
      const allowedExtensions = /\.(jpg|jpeg|png|webp|pdf)$/;
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (allowedMimeTypes.includes(file.mimetype) && file.originalname.toLowerCase().match(allowedExtensions)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Solo se permiten imágenes o PDF'), false);
      }
    },
  }))
  async uploadYRegistrar(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @GetUser() user: any
  ) {
    if (!body.data) throw new BadRequestException('Faltan los datos del pago');
  
    const datosPago = JSON.parse(body.data);
  
    const payloadCompleto: CreateCobranzaDto = {
      ...datosPago,
      id_vendedor: user.id_usuario,
      id_empresa: user.id_empresa,
      fecha_reporte: datosPago.fecha_reporte || new Date().toISOString(),
      url_comprobante: file ? `/uploads/comprobantes/${file.filename}` : null
    };
  
    return this.cobranzasService.create(payloadCompleto);
  }

  @Get('pendientes')
  @Permisos(Permiso.VER_COBRANZAS)
  getPendientes(@GetUser() user: any) {
    return this.cobranzasService.findAllPendientes(user.id_empresa);
  }

  // NUEVO: Ruta para ver todas las cobranzas (Historial)
  @Get()
  @Permisos(Permiso.VER_COBRANZAS)
  findAll(@GetUser() user: any) {
    return this.cobranzasService.findAll(user.id_empresa);
  }

  @Patch(':id/aprobar')
  @Permisos(Permiso.APROBAR_COBRANZAS)
  aprobar(@Param('id') id: string, @GetUser() admin: any) {
    return this.cobranzasService.aprobarCobranza(id, admin.id_usuario);
  }

  @Patch(':id/rechazar')
  @Permisos(Permiso.RECHAZAR_COBRANZAS)
  rechazar(@Param('id') id: string, @GetUser() admin: any, @Body('motivo') motivo: string) {
    return this.cobranzasService.rechazarCobranza(id, admin.id_usuario, motivo);
  }

  @Get('historial')
async historial(
  @Query('id_empresa') idEmpresa: string,
  @Query('fecha_inicio') fecha_inicio?: string,
  @Query('fecha_fin') fecha_fin?: string,
  @Query('texto') texto?: string,
) {
  return this.cobranzasService.findHistorial(idEmpresa, { fecha_inicio, fecha_fin, texto });
}

  @Post('manual')
  async createManual(@Body() createCobranzaDto: any) {
    // Asumimos que el DTO es similar al de creación normal
    return this.cobranzasService.createManual(createCobranzaDto);
  }

  @Patch(':id/anular')
  @Permisos(Permiso.APROBAR_COBRANZAS)
  anularCobranza(@Param('id') id: string) {
    return this.cobranzasService.anularCobranza(id);
  }

  @Get('vendedor/historial')
async historialVendedor(@GetUser() user: any) {
  // Retorna las cobranzas del vendedor logueado para que vea si fueron aprobadas o rechazadas
  return this.cobranzasService.findHistorialByVendedor(user.id_usuario);
}
}