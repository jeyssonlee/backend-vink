import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user; // Esto viene de tu JwtStrategy.validate()

    // Si pedimos un campo específico (@GetUser('id_empresa')) lo devolvemos
    if (data) {
      return user && user[data];
    }
    
    // Si no, devolvemos el objeto entero { id_usuario, email, id_empresa, rol... }
    return user;
  },
);