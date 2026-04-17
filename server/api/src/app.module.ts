import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule } from './config/config.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { ClientsModule } from './modules/clients/clients.module';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}