import { Test, TestingModule } from '@nestjs/testing';
import { CobranzasController } from './cobranzas.controller';
import { CobranzasService } from './cobranzas.service';
import { BadRequestException } from '@nestjs/common';

describe('CobranzasController', () => {
  let controller: CobranzasController;
  let service: CobranzasService;

  const mockCobranzasService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CobranzasController],
      providers: [
        {
          provide: CobranzasService,
          useValue: mockCobranzasService,
        },
      ],
    }).compile();

    controller = module.get<CobranzasController>(CobranzasController);
    service = module.get<CobranzasService>(CobranzasService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createWithUpload', () => {
    it('should create a cobranza with the correct URL when file is provided', async () => {
      const file = {
        filename: 'unique-id.jpg',
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        path: '/tmp/unique-id.jpg',
        size: 1024,
      } as any;

      const body = {
        data: JSON.stringify({
          monto: 100,
          id_cliente: '1',
        }),
      };

      const user = {
        id_usuario: 'user1',
        id_empresa: 'company1',
      };

      await controller.createWithUpload(file, body, user);

      expect(service.create).toHaveBeenCalledWith(expect.objectContaining({
        monto: 100,
        id_cliente: '1',
        id_vendedor: 'user1',
        id_empresa: 'company1',
        url_comprobante: '/comprobantes/unique-id.jpg',
      }));
    });

    it('should create a cobranza with null URL when file is not provided', async () => {
      const body = {
        data: JSON.stringify({
          monto: 100,
          id_cliente: '1',
        }),
      };

      const user = {
        id_usuario: 'user1',
        id_empresa: 'company1',
      };

      await controller.createWithUpload(undefined, body, user);

      expect(service.create).toHaveBeenCalledWith(expect.objectContaining({
        monto: 100,
        url_comprobante: null,
      }));
    });

    it('should throw BadRequestException if data is missing', async () => {
       const user = { id_usuario: '1' };
       await expect(controller.createWithUpload(undefined, {}, user)).rejects.toThrow(BadRequestException);
    });
  });
});
