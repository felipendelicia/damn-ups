import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigStoreService, ServerConfig } from './config-store.service';
import { ConfigController } from './config.controller';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      validationSchema: null,
      isGlobal: true,
    }),
  ],
  controllers: [ConfigController],
  providers: [ConfigStoreService],
  exports: [ConfigStoreService],
})
export class ConfigModule {}
export { ConfigStoreService, ServerConfig };