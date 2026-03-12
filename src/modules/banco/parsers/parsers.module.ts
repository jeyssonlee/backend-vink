import { Module } from '@nestjs/common';
import { BankParserRegistry } from './bank-parser.registry';

/**
 * Ubicación: src/modules/banco/parsers/
 *
 * Exporta BankParserRegistry para uso en el wizard de importación (Sprint 2).
 * No tiene controller — es un módulo de infraestructura puro.
 */
@Module({
  providers: [BankParserRegistry],
  exports: [BankParserRegistry],
})
export class ParsersModule {}