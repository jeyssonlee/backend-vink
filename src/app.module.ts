import { Module } from '@nestjs/common'; // Única importación de Module necesaria
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitConfigModule } from './infrastructure/rabbitmq/rabbit.module'; 
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

// Importación de tus módulos funcionales
import { ClientesModule } from './modules/ventas/clientes/clientes.module';
import { VendedoresModule } from './modules/ventas/vendedores/vendedores.module';
import { EmpresasModule } from './modules/core/empresa/empresas.module';
import { ProductosModule } from './modules/inventario/productos/productos.module';
import { PedidosModule } from './modules/ventas/pedidos/pedidos.module';
import { SyncModule } from './modules/sync/sync.module';
import { ComprasModule } from './modules/inventario/compras/compras.module';
import { UsuariosModule } from './modules/core/usuarios/usuarios.module';
import { AuthModule } from './modules/auth/auth.module';
import { SemillaModule } from './semilla/semilla.module';
import { ProveedoresModule } from './modules/inventario/proveedores/proveedores.module';
import { HoldingModule } from './modules/core/holding/holding.module';
import { SucursalModule } from './modules/core/sucursal/sucursales.module';
import { RolesModule } from './modules/auth/roles/roles.module';
import { AlmacenesModule } from './modules/inventario/almacenes/almacenes.module';
import { KardexModule } from './modules/inventario/kardex/kardex.module';
import { FacturasModule } from './modules/ventas/facturas/facturas.module';
import { CobranzasModule } from './modules/cobranzas/cobranzas.module';


@Module({
  imports: [
    // 1. Configuración de Base de Datos (PostgreSQL Central) [cite: 19, 28]
   ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'soporte',
      password: 'soporte',
      database: 'erp_hub',
      autoLoadEntities: true,
      synchronize: true,
      dropSchema: false,
    }),

    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'), // Busca la carpeta uploads en la raíz
      serveRoot: '/uploads', // La URL será http://localhost:3000/uploads/...
      exclude: ['/api/(.*)'],
    }),

    // 2. Configuración Global de RabbitMQ [cite: 57, 62]
    RabbitConfigModule,

    // 3. Tus Módulos del ERP [cite: 68]
    ClientesModule,
    VendedoresModule,
    EmpresasModule,
    ProductosModule,
    PedidosModule,
    SyncModule,  
    ComprasModule,
    ProveedoresModule,
    UsuariosModule,
    AuthModule,
    SemillaModule, 
    HoldingModule,
    SucursalModule,
    RolesModule,
    AlmacenesModule,
    KardexModule,
    FacturasModule,
    CobranzasModule 
     ],
})
export class AppModule {}