import { Module, Global } from '@nestjs/common';
import { UpsGateway } from './ups.gateway';

@Global()
@Module({
  providers: [UpsGateway],
  exports: [UpsGateway],
})
export class GatewayModule {}