import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { MonitoringService } from './modules/monitoring/monitoring.service';
import { UpsGateway } from './modules/gateway/ups.gateway';
import { UpsStatus, PowerLostEvent, ShutdownOrderEvent } from './shared/interfaces/ups.types';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);
  private isShuttingDown = false;
  private currentUpsStatus: UpsStatus | null = null;
  private pollingInterval: NodeJS.Timeout;

  constructor(
    private configService: ConfigService,
    private monitoringService: MonitoringService,
    private upsGateway: UpsGateway,
  ) {}

  async onModuleInit() {
    this.logger.log('UPS Monitoring Server started');
    await this.pollUpsStatus();
  }

  async onModuleDestroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    this.logger.log('UPS Monitoring Server stopped');
  }

  @Interval(5000)
  async pollUpsStatus() {
    try {
      const status = await this.monitoringService.getUpsStatus();
      
      if (status) {
        this.currentUpsStatus = status;
        this.upsGateway.emitUpsStatusUpdate(status);

        if (this.monitoringService.checkPowerLost(status)) {
          this.handlePowerLost(status);
        }

        if (this.monitoringService.isLowBattery(status)) {
          this.logger.warn(`Low battery: ${status.batteryCharge}%`);
        }
      }
    } catch (error) {
      this.logger.error(`Polling error: ${error.message}`);
    }
  }

  private async handlePowerLost(status: UpsStatus) {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    this.logger.error('POWER_LOST threshold reached! Initiating shutdown sequence...');

    const powerLostEvent: PowerLostEvent = {
      event: 'POWER_LOST',
      upsStatus: status,
      timestamp: new Date(),
    };

    this.upsGateway.emitPowerLost(powerLostEvent);

    await this.delay(5000);

    const shutdownEvent: ShutdownOrderEvent = {
      event: 'SHUTDOWN_ORDER',
      reason: 'Power lost and threshold reached',
      timestamp: new Date(),
    };

    this.upsGateway.emitShutdownOrder(shutdownEvent);
    this.logger.warn('Shutdown order sent to all clients');
  }

  getUpsStatus(): UpsStatus | null {
    return this.currentUpsStatus;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}