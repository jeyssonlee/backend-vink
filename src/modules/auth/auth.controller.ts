import {
  Controller, Post, Body, Get,
  UnauthorizedException, UseGuards, Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    const user = await this.authService.validarUsuario(body.correo, body.clave);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    return this.authService.login(user);
  }

  /**
   * POST /api/auth/seleccionar-empresa
   * Usado en el selector post-login (token provisional) y en el switcher
   * del sidebar (token completo). Ambos casos emiten un JWT nuevo.
   */
  @Post('seleccionar-empresa')
  @UseGuards(JwtAuthGuard)
  async seleccionarEmpresa(@Request() req: any, @Body() body: { id_empresa: string }) {
    if (!body.id_empresa) throw new UnauthorizedException('id_empresa requerido');
    return this.authService.seleccionarEmpresa(req.user.id_usuario, body.id_empresa);
  }

  /**
   * GET /api/auth/mis-empresas
   * Devuelve la lista de empresas a las que tiene acceso el usuario actual.
   * Usada por el switcher del sidebar para saber si debe mostrarse o no.
   */
  @Get('mis-empresas')
  @UseGuards(JwtAuthGuard)
  async misEmpresas(@Request() req: any) {
    return this.authService.obtenerEmpresasParaSwitcher(req.user.id_usuario);
  }

  @Get('me/permisos')
  @UseGuards(JwtAuthGuard)
  async obtenerMisPermisos(@Request() req) {
    if (req.user.rol === 'ROOT') {
      return { rol: 'ROOT', permisos: ['ROOT'] };
    }
    const permisos = await this.authService.obtenerPermisosPorRol(req.user.rol);
    return { rol: req.user.rol, permisos };
  }
}