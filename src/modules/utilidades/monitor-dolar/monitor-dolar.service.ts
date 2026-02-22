import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MonitorDolarService {
  private readonly logger = new Logger(MonitorDolarService.name);

  async obtenerTasaBcv() {
    this.logger.log('Consultando tasa BCV actual desde API externa...');
    
    try {
      // 🚀 FUTURO: Aquí consultarás tu base de datos (tabla historial)
      // 🚀 PRESENTE: Fetch a API pública de Dólar Venezuela
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      
      if (!response.ok) {
        throw new Error(`Error HTTP de la API externa: ${response.status}`);
      }
      
      const data = await response.json();
      const tasaOficial = data.promedio;

      return {
        success: true,
        origen: 'API_EXTERNA',
        tasa: tasaOficial,
        fecha_actualizacion: data.datetime 
      };
    } catch (error: any) {
      this.logger.error('Error obteniendo tasa BCV, activando fallback de emergencia', error.message);
      
      // Fallback para que el sistema nunca se detenga si la API se cae
      return {
        success: false,
        origen: 'FALLBACK',
        tasa: 65.50 // Cambia esto al valor que consideres prudente como salvavidas
      };
    }
  }
}