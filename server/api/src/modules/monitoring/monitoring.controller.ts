import { Controller, Get } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { UpsStatus } from '../../shared/interfaces/ups.types';

@Controller('ups')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('status')
  async getStatus(): Promise<UpsStatus | { error: string }> {
    const status = await this.monitoringService.getUpsStatus();
    if (!status) {
      return { error: 'Unable to connect to UPS' };
    }
    return status;
  }
}