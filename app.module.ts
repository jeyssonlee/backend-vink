import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    // 1. Cargar variables de entorno
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    // 2. Configuración de PostgreSQL (TypeORM)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASS'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true, // Carga automáticamente las clases con @Entity()
        synchronize: false,    // ¡IMPORTANTE! Mantener en false en producción. Usa migraciones.
      }),
      inject: [ConfigService],
    }),

    // 3. Configuración de RabbitMQ
    RabbitMQModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    exchanges: [
      {
        name: 'exchange.sync',
        type: 'topic', // Permite ruteo flexible basado en patrones
      },
    ],
    uri: configService.get<string>('RABBITMQ_URL'),
    connectionInitOptions: { wait: true },
  }),
  inject: [ConfigService],
}),
  ],
})
export class AppModule {}