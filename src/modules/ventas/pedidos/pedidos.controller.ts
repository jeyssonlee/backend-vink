import {
  Controller, Post, Get, Patch, Body, Param,
  UseGuards, Req, Query,
} from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto, RechazarPedidoDto, FacturarLoteDto } from './dto/create-pedido.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PermisosGuard } from 'src/modules/auth/guards/permisos.guard';
import { Permisos } from 'src/modules/auth/decorators/permisos.decorator';
import { Permiso } from 'src/modules/auth/permisos.enum';

@Controller('pedidos')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  // ----------------------------------------------------------------
  // CREAR PEDIDO WEB (BORRADOR — sin stock)
  // POST /pedidos
  // ----------------------------------------------------------------
  @Post()
  @Permisos(Permiso.CREAR_PEDIDOS)
  async crear(@Body() dto: CreatePedidoDto, @Req() req: any) {
    dto.id_empresa = req.user.id_empresa;
    return await this.pedidosService.crearPedidoWeb(dto, req.user.id_vendedor, req.user.id_empresa);
  }

  // ----------------------------------------------------------------
  // ENVIAR PEDIDO: BORRADOR/RECHAZADO → ENVIADO (aparta stock)
  // PATCH /pedidos/:id/enviar
  // ----------------------------------------------------------------
  @Patch(':id/enviar')
  @Permisos(Permiso.CREAR_PEDIDOS)
  async enviar(@Param('id') id: string, @Req() req: any) {
    return await this.pedidosService.enviarPedido(id, req.user.id_empresa);
  }

  // ----------------------------------------------------------------
  // EDITAR PEDIDO (cualquier estado editable)
  // PATCH /pedidos/:id
  // ----------------------------------------------------------------
  @Patch(':id')
  @Permisos(Permiso.EDITAR_PEDIDOS)
  async editar(@Param('id') id: string, @Body() dto: CreatePedidoDto, @Req() req: any) {
    return await this.pedidosService.editarPedido(id, dto, req.user.id_empresa);
  }

  // ----------------------------------------------------------------
  // REVISAR PEDIDO: ENVIADO → REVISADO
  // PATCH /pedidos/:id/revisar
  // ----------------------------------------------------------------
  @Patch(':id/revisar')
  @Permisos(Permiso.REVISAR_PEDIDOS)
  async revisar(@Param('id') id: string, @Req() req: any) {
    return await this.pedidosService.revisarPedido(id, req.user.sub, req.user.id_empresa);
  }

  // ----------------------------------------------------------------
  // RECHAZAR PEDIDO: ENVIADO/REVISADO → RECHAZADO (libera stock)
  // PATCH /pedidos/:id/rechazar
  // ----------------------------------------------------------------
  @Patch(':id/rechazar')
  @Permisos(Permiso.REVISAR_PEDIDOS)
  async rechazar(
    @Param('id') id: string,
    @Body() dto: RechazarPedidoDto,
    @Req() req: any,
  ) {
    return await this.pedidosService.rechazarPedido(id, dto, req.user.sub, req.user.id_empresa);
  }

  // ----------------------------------------------------------------
  // ANULAR PEDIDO
  // PATCH /pedidos/:id/anular
  // ----------------------------------------------------------------
  @Patch(':id/anular')
  @Permisos(Permiso.EDITAR_PEDIDOS)
  async anular(@Param('id') id: string, @Req() req: any) {
    return await this.pedidosService.anularPedido(id, req.user.id_empresa);
  }

  // ----------------------------------------------------------------
  // MARCAR COMO FACTURADO (lote)
  // POST /pedidos/facturar-lote
  // ----------------------------------------------------------------
  @Post('facturar-lote')
  @Permisos(Permiso.FACTURAR_PEDIDOS)
  async facturarLote(@Body() dto: FacturarLoteDto, @Req() req: any) {
    return await this.pedidosService.marcarComoFacturado(dto, req.user.id_empresa);
  }

  // ----------------------------------------------------------------
  // BANDEJA DE REVISIÓN — pedidos ENVIADOS
  // GET /pedidos/bandeja?vendedorId=&ciudad=
  // ----------------------------------------------------------------
  @Get('bandeja')
  @Permisos(Permiso.REVISAR_PEDIDOS)
  async bandeja(
    @Req() req: any,
    @Query('vendedorId') vendedorId?: string,
    @Query('ciudad') ciudad?: string,
  ) {
    return await this.pedidosService.obtenerBandeja(req.user.id_empresa, { vendedorId, ciudad });
  }

  // ----------------------------------------------------------------
  // PEDIDOS REVISADOS — para pantalla de facturación
  // GET /pedidos/revisados?vendedorId=&ciudad=&clienteId=
  // ----------------------------------------------------------------
  @Get('revisados')
  @Permisos(Permiso.FACTURAR_PEDIDOS)
  async revisados(
    @Req() req: any,
    @Query('vendedorId') vendedorId?: string,
    @Query('ciudad') ciudad?: string,
    @Query('clienteId') clienteId?: string,
  ) {
    return await this.pedidosService.obtenerPedidosRevisados(
      req.user.id_empresa,
      { vendedorId, ciudad, clienteId },
    );
  }

  // ----------------------------------------------------------------
  // MIS PEDIDOS — el vendedor ve solo los suyos
  // GET /pedidos/mis-pedidos?estado=
  // ----------------------------------------------------------------
  @Get('mis-pedidos')
  @Permisos(Permiso.VER_PEDIDOS)
  async misPedidos(@Req() req: any, @Query('estado') estado?: string) {
    return await this.pedidosService.obtenerMisPedidos(
      req.user.id_vendedor,
      req.user.id_empresa,
      estado,
    );
  }

  // ----------------------------------------------------------------
  // LISTADO GENERAL (admin ve todos)
  // GET /pedidos?estado=
  // ----------------------------------------------------------------
  @Get()
  @Permisos(Permiso.VER_PEDIDOS)
  async listar(@Req() req: any, @Query('estado') estado?: string) {
    return await this.pedidosService.obtenerTodos(req.user.id_empresa, estado);
  }

  // ----------------------------------------------------------------
  // DETALLE DE UN PEDIDO
  // GET /pedidos/:id
  // ----------------------------------------------------------------
  @Get(':id')
  @Permisos(Permiso.VER_PEDIDOS)
  async detalle(@Param('id') id: string, @Req() req: any) {
    return await this.pedidosService.obtenerDetalle(id, req.user.id_empresa);
  }

  // ----------------------------------------------------------------
  // BACKWARD COMPAT APP MÓVIL — completar venta
  // PATCH /pedidos/:id_local/completar
  // ----------------------------------------------------------------
  @Patch(':id_local/completar')
  @Permisos(Permiso.CREAR_VENTAS)
  async completar(@Param('id_local') idLocal: string, @Req() req: any) {
    return await this.pedidosService.completarVenta(idLocal, req.user.id_empresa);
  }
}
