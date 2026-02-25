

export class ClienteBasicoDto {
    id_cliente: string;
    razon_social: string;
    rif: string;
    limite_credito_monto: number;
    estatus: string;
    tipo_precio: string;
    telefono: string;
  }
  
  export class KpisFinancierosDto {
    deuda_viva: number;
    ticket_promedio: number;
    total_comprado: number;
    total_ganancia: number;
  }
  
  export class EvolucionCompraDto {
    mes: string;
    total: number;
  }
  
  export class TopProductoDto {
    name: string; // Adaptado para Recharts
    cantidad: number;
    total_dinero: number;
  }
  
  export class MetodoPagoGraficaDto {
    name: string; // Adaptado para Recharts
    total: number;
  }
  
  export class GraficasFichaClienteDto {
    evolucion_compras: EvolucionCompraDto[];
    top_productos: TopProductoDto[];
    metodos_pago: MetodoPagoGraficaDto[];
  }
  
  // ESTE ES EL DTO PRINCIPAL QUE EXPORTAMOS
  export class FichaClienteResponseDto {
    cliente: ClienteBasicoDto;
    kpis: KpisFinancierosDto;
    graficas: GraficasFichaClienteDto;
  }