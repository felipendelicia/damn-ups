import { Controller, Get, Post, Body } from '@nestjs/common';
import { ConfigStoreService } from './config.module';

@Controller('config')
export class ConfigController {
  constructor(private configStore: ConfigStoreService) {}

  @Get()
  getConfig() {
    return this.configStore.getConfig();
  }

  @Post()
  updateConfig(@Body() updates: any) {
    return this.configStore.updateConfig(updates);
  }
}