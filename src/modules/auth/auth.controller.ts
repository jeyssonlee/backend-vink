import { Controller, Post, Body, UnauthorizedException, UseGuards, Get, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';


@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    const user = await this.authService.validarUsuario(body.correo, body.clave);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.authService.login(user);
  }

  @Get('me/permisos')
@UseGuards(JwtAuthGuard)
async obtenerMisPermisos(@Request() req) {
  // Si es ROOT, retorna un array con el string especial 'ROOT'
  // El frontend interpreta ROOT como "todos los permisos"
  if (req.user.rol === 'ROOT') {
    return { rol: 'ROOT', permisos: ['ROOT'] };
  }

  const permisos = await this.authService.obtenerPermisosPorRol(req.user.rol);
  return { rol: req.user.rol, permisos };
}

}