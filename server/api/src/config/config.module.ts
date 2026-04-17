import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      validationSchema: Joi.object({
        SERVER_PORT: Joi.number().default(3000),
        UPS_NAME: Joi.string().default('ups'),
        NUT_UPS_HOST: Joi.string().default('localhost'),
        NUT_UPS_PORT: Joi.number().default(3493),
        POLL_INTERVAL: Joi.number().default(5000),
        LOW_BATTERY_THRESHOLD: Joi.number().default(20),
        POWER_LOST_THRESHOLD: Joi.number().default(2),
        MOCK_MODE: Joi.boolean().default(false),
      }),
      isGlobal: true,
    }),
  ],
})
export class ConfigModule {}