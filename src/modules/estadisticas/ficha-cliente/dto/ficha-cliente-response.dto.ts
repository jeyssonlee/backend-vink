

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
    facturas: FacturaBasicaDto[];
  }

  export class FacturaBasicaDto {
    id_factura: string;
    numero_factura: string;
    fecha_emision: Date;
    total: number;
    saldo_pendiente: number;
    estado: string;
  }

  export class PagoBasicoDto {
    id_cobranza: string;
    numero_recibo: string;
    fecha: Date;
    monto: number;
    estado: string;
  }