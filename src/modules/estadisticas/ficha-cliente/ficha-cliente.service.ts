import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// ⚠️ Ajusta las rutas relativas según tu estructura de carpetas
import { Cliente } from 'src/modules/ventas/clientes/entities/clientes.entity';
import { Factura, EstadoFactura } from 'src/modules/ventas/facturas/entities/factura.entity';
import { FacturaDetalle } from 'src/modules/ventas/facturas/entities/factura-detalle.entity';
import { CobranzaMetodo } from 'src/modules/cobranzas/entities/cobranza-metodo.entity';
import { EstadoCobranza } from 'src/modules/cobranzas/entities/cobranza.entity';

@Injectable()
export class FichaClienteService {
  constructor(
    @InjectRepository(Cliente) private clienteRepo: Repository<Cliente>,
    @InjectRepository(Factura) private facturaRepo: Repository<Factura>,
    @InjectRepository(FacturaDetalle) private detalleRepo: Repository<FacturaDetalle>,
    @InjectRepository(CobranzaMetodo) private metodosPagoRepo: Repository<CobranzaMetodo>,
  ) {}

  async obtenerDatosFicha(idCliente: string, idEmpresa: string) {
    // 1. Validamos que el cliente exista y pertenezca a la empresa actual
    const cliente = await this.clienteRepo.findOne({
      where: { id_cliente: idCliente, id_empresa: idEmpresa },
    });

    if (!cliente) {
      throw new NotFoundException('El cliente no existe o no pertenece a esta empresa');
    }

    // 2. Ejecutamos todos los cálculos analíticos en PARALELO para máxima velocidad
    const [
      kpisGenerales,
      deudaVivaResult,
      topProductos,
      metodosPago,
      evolucionMensual
    ] = await Promise.all([

      // A. KPIs Generales (Ticket Promedio, Total Comprado, Total Ganancia)
      this.facturaRepo.createQueryBuilder('f')
        .select('AVG(f.total_pagar)', 'ticket_promedio')
        .addSelect('SUM(f.total_pagar)', 'total_comprado')
        .addSelect('SUM(f.total_ganancia)', 'total_ganancia')
        .where('f.id_cliente = :idCliente', { idCliente })
        .andWhere('f.id_empresa = :idEmpresa', { idEmpresa })
        .andWhere('f.estado NOT IN (:...estadosInvalidos)', { 
          estadosInvalidos: [EstadoFactura.BORRADOR, EstadoFactura.ANULADA] 
        })
        .getRawOne(),

      // B. Deuda Viva (Solo facturas pendientes o con abonos parciales)
      this.facturaRepo.createQueryBuilder('f')
        .select('SUM(f.saldo_pendiente)', 'deuda_viva')
        .where('f.id_cliente = :idCliente', { idCliente })
        .andWhere('f.id_empresa = :idEmpresa', { idEmpresa })
        .andWhere('f.estado IN (:...estadosDeuda)', { 
          estadosDeuda: [EstadoFactura.PENDIENTE, EstadoFactura.PARCIAL] 
        })
        .getRawOne(),

      // C. Gráfica: Top 5 Productos (Agrupados por nombre)
      this.detalleRepo.createQueryBuilder('fd')
        .innerJoin('fd.factura', 'f')
        .select('fd.nombre_producto', 'producto')
        .addSelect('SUM(fd.cantidad)', 'cantidad')
        .addSelect('SUM(fd.total_linea)', 'total_dinero')
        .where('f.id_cliente = :idCliente', { idCliente })
        .andWhere('f.id_empresa = :idEmpresa', { idEmpresa })
        .andWhere('f.estado NOT IN (:...estadosInvalidos)', { 
          estadosInvalidos: [EstadoFactura.BORRADOR, EstadoFactura.ANULADA] 
        })
        .groupBy('fd.nombre_producto')
        .orderBy('cantidad', 'DESC')
        .limit(5)
        .getRawMany(),

      // D. Gráfica: Hábitos de Pago (Agrupados por método de pago)
      this.metodosPagoRepo.createQueryBuilder('cm')
        .innerJoin('cm.cobranza', 'c')
        .select('cm.metodo', 'metodo')
        .addSelect('SUM(cm.monto)', 'total')
        .where('c.id_cliente = :idCliente', { idCliente })
        .andWhere('c.id_empresa = :idEmpresa', { idEmpresa })
        // Solo sumamos los pagos que ya fueron aplicados exitosamente
        .andWhere('c.estado = :estadoCobranza', { estadoCobranza: EstadoCobranza.APLICADA })
        .groupBy('cm.metodo')
        .orderBy('total', 'DESC')
        .getRawMany(),

      // E. Gráfica: Evolución Mensual de Compras (Últimos 6 meses)
      this.facturaRepo.createQueryBuilder('f')
        .select("TO_CHAR(f.fecha_emision, 'YYYY-MM')", 'mes') // Formato YYYY-MM
        .addSelect('SUM(f.total_pagar)', 'total')
        .where('f.id_cliente = :idCliente', { idCliente })
        .andWhere('f.id_empresa = :idEmpresa', { idEmpresa })
        .andWhere('f.estado NOT IN (:...estadosInvalidos)', { 
          estadosInvalidos: [EstadoFactura.BORRADOR, EstadoFactura.ANULADA] 
        })
        .andWhere("f.fecha_emision >= NOW() - INTERVAL '6 MONTHS'") // Filtro nativo de Postgres
        .groupBy("TO_CHAR(f.fecha_emision, 'YYYY-MM')")
        .orderBy('mes', 'ASC')
        .getRawMany()
    ]);

    // 3. Formateamos y retornamos el DTO limpio para el Frontend
    return {
      cliente: {
        id_cliente: cliente.id_cliente,
        razon_social: cliente.razon_social,
        rif: cliente.rif,
        // Usamos Number() por si el motor de BD lo devuelve como string
        limite_credito_monto: Number(cliente.limite_credito_monto || 0),
        estatus: cliente.estatus,
        tipo_precio: cliente.tipo_precio,
        telefono: cliente.numero_telefonico
      },
      kpis: {
        deuda_viva: Number(deudaVivaResult?.deuda_viva || 0),
        ticket_promedio: Number(kpisGenerales?.ticket_promedio || 0),
        total_comprado: Number(kpisGenerales?.total_comprado || 0),
        total_ganancia: Number(kpisGenerales?.total_ganancia || 0),
      },
      graficas: {
        evolucion_compras: evolucionMensual.map(e => ({ 
          mes: e.mes, 
          total: Number(e.total) 
        })),
        top_productos: topProductos.map(p => ({ 
          name: p.producto, // Lo llamamos 'name' porque a Recharts le gusta por defecto
          cantidad: Number(p.cantidad), 
          total_dinero: Number(p.total_dinero) 
        })),
        metodos_pago: metodosPago.map(m => ({ 
          name: m.metodo, 
          total: Number(m.total) 
        }))
      }
    };
  }
}