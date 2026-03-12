import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from 'src/modules/core/usuarios/entities/usuarios.entity';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Rol } from './roles/entities/rol.entity';
import { PermisosGuard } from './guards/permisos.guard';
import {Vendedor} from 'src/modules/ventas/vendedores/entities/vendedor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Rol, Vendedor]),
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  providers: [
     AuthService,
     JwtStrategy,
     PermisosGuard,
    ],
  controllers: [AuthController],
  exports: [AuthService, PermisosGuard], // Exportamos por si acaso
})
export class AuthModule {}