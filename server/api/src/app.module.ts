import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule } from './modules/config/config.module';
import { AppService } from './app.service';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { ClientsModule } from './modules/clients/clients.module';
import { EventsModule } from './modules/clients/events.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'web'),
      exclude: ['/api*'],
    }),
    ConfigModule,
    MonitoringModule,
    GatewayModule,
    ClientsModule,
    EventsModule,
  ],
  providers: [AppService],
})
export class AppModule {}