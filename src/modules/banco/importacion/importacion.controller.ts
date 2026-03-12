import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    ParseIntPipe,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    Request,
    UsePipes,
    ValidationPipe,
  } from '@nestjs/common';
  import { FileInterceptor } from '@nestjs/platform-express';
  import { memoryStorage } from 'multer';
  import { ImportacionService } from './importacion.service';
  import { IniciarImportacionDto, EditarStagingDto, DistribucionDto } from './dto/importacion.dto';
  import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
  import { PermisosGuard } from '../../auth/guards/permisos.guard';
  import { Permisos } from '../../auth/decorators/permisos.decorator';
  import { Permiso } from '../../auth/permisos.enum';
  
  @Controller('banco/importacion')
  @UseGuards(JwtAuthGuard, PermisosGuard)
  export class ImportacionController {
    constructor(private readonly importacionService: ImportacionService) {}
  
    /**
     * POST /api/banco/importacion/paso-1
     * Recibe el extracto bancario, lo parsea e inserta en staging.
     */
    @Post('paso-1')
    @Permisos(Permiso.IMPORTAR_EXTRACTOS)
    @UseInterceptors(
      FileInterceptor('file', {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          const extensionesValidas = /\.(xls|xlsx|csv)$/i;
          if (!file.originalname.match(extensionesValidas)) {
            return cb(new BadRequestException('Solo se permiten archivos .xls, .xlsx o .csv'), false);
          }
          cb(null, true);
        },
      }),
    )
    async paso1(
      @UploadedFile() file: Express.Multer.File,
      @Body() dto: IniciarImportacionDto,
      @Request() req: any,
    ) {
      if (!file) throw new BadRequestException('No se recibió ningún archivo');
      return this.importacionService.iniciarImportacion(file, dto, req.user.id_empresa, req.user.id_usuario);
    }
  
    /**
     * GET /api/banco/importacion/:id/paso-2
     * Devuelve las filas del staging enriquecidas para revisión.
     */
    @Get(':id/paso-2')
    @Permisos(Permiso.IMPORTAR_EXTRACTOS)
    paso2(
      @Param('id', ParseIntPipe) id: number,
      @Request() req: any,
    ) {
      return this.importacionService.obtenerValidacion(id, req.user.id_empresa);
    }
  
    /**
     * PATCH /api/banco/importacion/:id/staging/:id_staging
     * Edita categoría, tipo_destino, notas o excluye una fila.
     */
    @Patch(':id/staging/:id_staging')
    @Permisos(Permiso.IMPORTAR_EXTRACTOS)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    editarStaging(
      @Param('id', ParseIntPipe) id: number,
      @Param('id_staging', ParseIntPipe) idStaging: number,
      @Body() dto: EditarStagingDto,
      @Request() req: any,
    ) {
      return this.importacionService.editarStaging(id, idStaging, dto, req.user.id_empresa);
    }
  
    /**
     * POST /api/banco/importacion/:id/staging/:id_staging/distribucion
     * Distribuye un egreso entre múltiples empresas del grupo.
     */
    @Post(':id/staging/:id_staging/distribucion')
    @Permisos(Permiso.IMPORTAR_EXTRACTOS)
    @UsePipes(new ValidationPipe({ whitelist: true }))
    guardarDistribucion(
      @Param('id', ParseIntPipe) id: number,
      @Param('id_staging', ParseIntPipe) idStaging: number,
      @Body() dto: DistribucionDto,
      @Request() req: any,
    ) {
      return this.importacionService.guardarDistribucion(id, idStaging, dto, req.user.id_empresa);
    }
  
    /**
     * DELETE /api/banco/importacion/:id/staging/:id_staging/distribucion
     * Elimina las distribuciones de una fila para reasignarlas.
     */
    @Delete(':id/staging/:id_staging/distribucion')
    @Permisos(Permiso.IMPORTAR_EXTRACTOS)
    limpiarDistribucion(
      @Param('id', ParseIntPipe) id: number,
      @Param('id_staging', ParseIntPipe) idStaging: number,
      @Request() req: any,
    ) {
      return this.importacionService.limpiarDistribucion(id, idStaging, req.user.id_empresa);
    }
  
    /**
     * POST /api/banco/importacion/:id/consolidar
     * Paso 4 — mueve staging → movimiento_bancario de forma atómica.
     * Acción irreversible — el estado pasa a CONSOLIDADO.
     */
    @Post(':id/consolidar')
    @Permisos(Permiso.IMPORTAR_EXTRACTOS)
    consolidar(
      @Param('id', ParseIntPipe) id: number,
      @Request() req: any,
    ) {
      return this.importacionService.consolidar(id, req.user.id_empresa);
    }
  }