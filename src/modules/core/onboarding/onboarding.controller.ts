import { Controller, Post, Body, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { OnboardingEmpresaDto, OnboardingHoldingDto } from './dto/onboarding.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Permisos } from '../../auth/decorators/permisos.decorator';
import { Permiso } from '../../auth/permisos.enum';

@Controller('onboarding')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('empresa')
  @Permisos(Permiso.EDITAR_EMPRESA)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  crearEmpresa(@Body() dto: OnboardingEmpresaDto) {
    return this.onboardingService.crearEmpresaSimple(dto);
  }

  @Post('holding')
  @Permisos(Permiso.EDITAR_EMPRESA)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  crearHolding(@Body() dto: OnboardingHoldingDto) {
    return this.onboardingService.crearHolding(dto);
  }
}