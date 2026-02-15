import { Test, TestingModule } from '@nestjs/testing';
import { FacturasService } from './facturas.service';
import { ProductosService } from 'src/modules/inventario/productos/productos.service';
import { DataSource, QueryRunner, EntityManager } from 'typeorm';
import { MetodoPago, EstadoFactura } from './entities/factura.entity';
import { Cliente } from '../clientes/entities/clientes.entity';
import { Producto } from 'src/modules/inventario/productos/entities/producto.entity';
import { Factura } from './entities/factura.entity';

describe('FacturasService', () => {
  let service: FacturasService;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let manager: EntityManager;

  beforeEach(async () => {
    // Mocks
    manager = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      query: jest.fn(),
      update: jest.fn(),
    } as any;

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: manager,
    } as any;

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      getRepository: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacturasService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: ProductosService,
          useValue: {
              finalizarSalida: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FacturasService>(FacturasService);
  });

  it('should calculate correct price from precio_base when precio_personalizado is missing', async () => {
    const idEmpresa = 'empresa-uuid';
    const idCliente = 'cliente-uuid';
    const idProducto = 'producto-uuid';
    const precioBase = 100;

    // Mock Cliente and Producto
    (manager.findOne as jest.Mock).mockImplementation(async (entity, options) => {
       if (entity === Cliente) {
           return { id_cliente: idCliente };
       }
       if (entity === Producto) {
           // THIS IS THE KEY: We return a product with precio_base but undefined precios
           // simulating failed relation load or just not requested
           return {
               id_producto: idProducto,
               nombre: 'Test Product',
               precio_base: precioBase,
               precios: undefined,
               empresa: { id: idEmpresa }
           };
       }
       if (entity === Factura) {
           // For finding duplicate or last number
           return null;
       }
       // For finding almacenes in some cases if using findOne (logic uses query mostly for almacenes)
       // logic: const almacenVenta = await queryRunner.manager.findOne(Almacen, ...
       if (typeof entity === 'function' && entity.name === 'Almacen') {
           return { id_almacen: 'almacen-uuid' };
       }
       return null;
    });

    // Mock Costo query
    (manager.query as jest.Mock).mockImplementation(async (query, params) => {
        if (query.includes('SELECT costo_unitario')) {
            return [{ costo_unitario: 50 }];
        }
        if (query.includes('UPDATE inventarios')) {
            return [];
        }
        return [];
    });

    // Mock Create/Save to capture details
    (manager.create as jest.Mock).mockImplementation((entity, data) => data);
    (manager.save as jest.Mock).mockImplementation(async (data) => ({ ...data, id_factura: 'new-id' }));

    const dto = {
        id_empresa: idEmpresa,
        id_cliente: idCliente,
        metodo_pago: MetodoPago.EFECTIVO,
        items: [
            {
                id_producto: idProducto,
                cantidad: 1,
                // precio_personalizado is MISSING
            }
        ]
    };

    const result = await service.crear(dto as any);

    const factura = result.data as any;
    const detalle = factura.detalles[0];

    // EXPECTATION: Price should be 100 (precio_base)
    // CURRENT BUG: It will be 0 because it reads from undefined `precios`
    expect(detalle.precio_unitario).toBe(precioBase);
  });
});
