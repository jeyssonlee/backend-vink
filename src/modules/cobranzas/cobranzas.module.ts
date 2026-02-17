import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CobranzasService } from './cobranzas.service';
import { CobranzasController } from './cobranzas.controller';

// Entidades Propias
import { Cobranza } from './entities/cobranza.entity';
import { CobranzaMetodo } from './entities/cobranza-metodo.entity';
import { CobranzaFactura } from './entities/cobranza-factura.entity';

// Entidades Externas (Necesarias para validar y actualizar)
import { Factura } from '../ventas/facturas/entities/factura.entity'; // ⚠️ Ajusta ruta
import { Usuario } from '../core/usuarios/entities/usuarios.entity'; // ⚠️ Ajusta ruta

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cobranza,
      CobranzaMetodo,
      CobranzaFactura,
      Factura,
      Usuario
    ])
  ],
  controllers: [CobranzasController],
  providers: [CobranzasService],
  exports: [CobranzasService]
})
export class CobranzasModule {}