import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';

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
    private readonly dataSource: DataSource,
  ) {}

  async obtenerResumenKpis(idEmpresa: string) {
    try {
      const fechaInicioMes = new Date();
      fechaInicioMes.setDate(1);
      fechaInicioMes.setHours(0, 0, 0, 0);
  
      const fechaFinMes = new Date();
      fechaFinMes.setMonth(fechaFinMes.getMonth() + 1);
      fechaFinMes.setDate(0);
      fechaFinMes.setHours(23, 59, 59, 999);
  
      const [resultadoIngresos, totalVentasMes, totalClientes, totalProductos] = await Promise.all([
  
        this.facturaRepo.createQueryBuilder('factura')
          .select('SUM(factura.total_pagar)', 'total')
          .where('factura.estado NOT IN (:...estados)', {
            estados: [EstadoFactura.BORRADOR, EstadoFactura.ANULADA]
          })
          .andWhere('factura.id_empresa = :idEmpresa', { idEmpresa }) // 👈
          .getRawOne(),
  
        this.facturaRepo.count({
          where: {
            fecha_emision: Between(fechaInicioMes, fechaFinMes),
            empresa: { id: idEmpresa } as any // 👈
          }
        }),
  
        this.clienteRepo.count({
          where: { empresa: { id: idEmpresa } as any } // 👈
        }),
  
        this.productoRepo.count({
          where: { empresa: { id: idEmpresa } as any } // 👈
        }),
      ]);
  
      return {
        ingresosTotales: Number(resultadoIngresos?.total || 0),
        ventasMes: totalVentasMes,
        clientesActivos: totalClientes,
        actividadReciente: totalProductos,
      };
  
    } catch (error) {
      this.logger.error('Error calculando KPIs del dashboard', error);
      return { ingresosTotales: 0, ventasMes: 0, clientesActivos: 0, actividadReciente: 0 };
    }
  }

  async obtenerResumenRoot() {
    const [totalHoldings, totalEmpresas, totalUsuarios, totalVendedores] = await Promise.all([
      this.dataSource.query(`SELECT COUNT(*) FROM holdings`),
      this.dataSource.query(`SELECT COUNT(*) FROM empresas`),
      this.dataSource.query(`SELECT COUNT(*) FROM usuarios`),
      this.dataSource.query(`SELECT COUNT(*) FROM vendedores`),
    ]);
  
    const empresas = await this.dataSource.query(`
      SELECT e.id, e.razon_social, e.rif, e.activa, e.created_at,
             h.nombre as holding_nombre
      FROM empresas e
      LEFT JOIN holdings h ON e.id_holding = h.id_holding
      ORDER BY e.created_at DESC
    `);
  
    return {
      kpis: {
        holdings: Number(totalHoldings[0].count),
        empresas: Number(totalEmpresas[0].count),
        usuarios: Number(totalUsuarios[0].count),
        vendedores: Number(totalVendedores[0].count),
      },
      empresas,
    };
  }
}