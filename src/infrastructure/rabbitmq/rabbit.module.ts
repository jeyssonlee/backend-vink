import { Global, Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';

@Global()
@Module({
  imports: [
    RabbitMQModule.forRoot({
      exchanges: [{ name: 'exchange.sync', type: 'topic' }],
      uri: 'amqp://localhost:5672',
      connectionInitOptions: { wait: false },
    }),
  ],
  exports: [RabbitMQModule], // Exportamos para que todos lo vean
})
export class RabbitConfigModule {}