import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

// 🚀 Entidades: Ajusta las rutas según la estructura exacta de tus carpetas
import { Factura } from '../ventas/facturas/entities/factura.entity';
import { Cliente } from '../ventas/clientes/entities/clientes.entity';
import { Producto } from '../inventario/productos/entities/producto.entity';
import { EstadoFactura } from '../ventas/facturas/entities/factura.entity'; 

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Factura)
    private readonly facturaRepo: Repository<Factura>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    // Si no tienes la entidad Producto aún, puedes comentar temporalmente estas dos líneas
    @InjectRepository(Producto)
    private readonly productoRepo: Repository<Producto>,
  ) {}

  async obtenerResumenKpis() {
    this.logger.log('Calculando KPIs reales desde la base de datos...');

    try {
      // 1. Obtener la fecha de inicio y fin del mes actual
      const fechaInicioMes = new Date();
      fechaInicioMes.setDate(1);
      fechaInicioMes.setHours(0, 0, 0, 0);

      const fechaFinMes = new Date();
      fechaFinMes.setMonth(fechaFinMes.getMonth() + 1);
      fechaFinMes.setDate(0);
      fechaFinMes.setHours(23, 59, 59, 999);

      // 2. Ejecutar todas las consultas en paralelo
      const [
        resultadoIngresos, 
        totalVentasMes, 
        totalClientes, 
        totalProductos
      ] = await Promise.all([
        
        // KPI 1: Suma de los ingresos. Usamos 'total_pagar' que viene de tu Entidad
        this.facturaRepo.createQueryBuilder('factura')
          .select('SUM(factura.total_pagar)', 'total')
          // Opcional: Solo sumar las facturas que no estén anuladas ni en borrador
          .where('factura.estado NOT IN (:...estados)', { 
            estados: [EstadoFactura.BORRADOR, EstadoFactura.ANULADA] 
          })
          .getRawOne(),

        // KPI 2: Cantidad de facturas emitidas este mes (usando 'fecha_emision')
        this.facturaRepo.count({
          where: {
            fecha_emision: Between(fechaInicioMes, fechaFinMes)
          }
        }),

        // KPI 3: Total de clientes registrados
        this.clienteRepo.count(),

        // KPI 4: Total de productos en catálogo (Si no tienes esto aún, pon un 0 estático temporalmente)
        this.productoRepo.count()
      ]);

      // 3. Retornar los datos
      return {
        // Formateamos a número por si la BD devuelve un string o null
        ingresosTotales: Number(resultadoIngresos?.total || 0),
        ventasMes: totalVentasMes,
        clientesActivos: totalClientes,
        actividadReciente: totalProductos 
      };

    } catch (error) {
      this.logger.error('Error calculando KPIs del dashboard', error);
      return { ingresosTotales: 0, ventasMes: 0, clientesActivos: 0, actividadReciente: 0 };
    }
  }
}