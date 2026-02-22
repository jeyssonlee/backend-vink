import { Module } from '@nestjs/common'; // Única importación de Module necesaria
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitConfigModule } from './infrastructure/rabbitmq/rabbit.module'; 
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
import { MonitorDolarModule } from './modules/utilidades/monitor-dolar/monitor-dolar.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env', // El nombre exacto de tu archivo
      isGlobal: true, // Para que esté disponible en todos los módulos (Cobranzas, Ventas, etc.)
    }),
    //  Configuración de Base de Datos (PostgreSQL Central) [cite: 19, 28]
   ScheduleModule.forRoot(),
   TypeOrmModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => ({
      type: 'postgres',
      host: configService.get<string>('DB_HOST'),
      port: configService.get<number>('DB_PORT'),
      username: configService.get<string>('DB_USER'),
      password: configService.get<string>('DB_PASSWORD'),
      database: configService.get<string>('DB_NAME'),
      autoLoadEntities: true,
      synchronize: configService.get<string>('DB_SYNC') === 'true',
    }),
  }),
  

    //Configuracion para guardar los comprobante de cobranzas
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'), // Busca la carpeta uploads en la raíz
      serveRoot: '/uploads', // La URL será http://localhost:3000/uploads/...
      exclude: ['/api/(.*)'],
    }),

    //  Configuración Global de RabbitMQ [cite: 57, 62]
    RabbitConfigModule,

    //  Tus Módulos del ERP [cite: 68]
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
    CobranzasModule,
    MonitorDolarModule,
    DashboardModule 
     ],
})
export class AppModule {}