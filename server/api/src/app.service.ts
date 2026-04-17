import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { MonitoringService } from './modules/monitoring/monitoring.service';
import { UpsGateway } from './modules/gateway/ups.gateway';
import { ConfigStoreService } from './modules/config/config.module';
import { EventsService } from './modules/clients/events.service';
import { UpsStatus, PowerLostEvent, ShutdownOrderEvent } from './shared/interfaces/ups.types';

const APP_NAME = 'Damn! Ups';
const APP_VERSION = '1.0.0';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);
  private isShuttingDown = false;
  private currentUpsStatus: UpsStatus | null = null;
  private consecutivePowerLost = 0;

  constructor(
    private configService: ConfigService,
    private configStore: ConfigStoreService,
    private monitoringService: MonitoringService,
    private upsGateway: UpsGateway,
    private eventsService: EventsService,
  ) {}

  private pollTimer: NodeJS.Timeout | null = null;

  async onModuleInit() {
    const config = this.configStore.getConfig();
    this.logger.log(`⚡ ${APP_NAME} v${APP_VERSION} started`);
    this.logger.log(`Config: threshold=${config.powerLostThreshold}, poll=${config.pollInterval}ms, mock=${config.mockMode}`);
    
    // Register callback for config changes
    this.configStore.setOnConfigChange(() => this.restartPolling());
    
    await this.pollUpsStatus();
    this.startPolling();
  }

  async onModuleDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.logger.log('UPS Monitoring Server stopped');
  }

  private startPolling() {
    const config = this.configStore.getConfig();
    const interval = config.pollInterval || 5000;
    
    if (this.pollTimer) clearInterval(this.pollTimer);
    
    this.pollTimer = setInterval(() => {
      this.pollUpsStatus();
    }, interval);
  }

  restartPolling() {
    this.startPolling();
  }

  private async pollUpsStatus() {
    try {
      const config = this.configStore.getConfig();
      
      // Update monitoring with config
      this.monitoringService.updateThresholds(config.powerLostThreshold, config.lowBatteryThreshold);
      
      const status = await this.monitoringService.getUpsStatus();
      
      if (status) {
        this.currentUpsStatus = status;
        this.upsGateway.emitUpsStatusUpdate(status);
    this.eventsService.upsStatusUpdate(status);

        if (this.monitoringService.checkPowerLost(status)) {
          this.handlePowerLost(status);
        }

        if (this.monitoringService.isLowBattery(status)) {
          this.logger.warn(`Low battery: ${status.batteryCharge}%`);
        }
      } else {
        this.logger.warn('UPS status unavailable');
      }
    } catch (error) {
      this.logger.error(`Polling error: ${error.message}`);
    }
  }

  private async handlePowerLost(status: UpsStatus) {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    this.consecutivePowerLost++;
    
    this.logger.error(`🚨 POWER_LOST threshold reached! (${this.consecutivePowerLost})`);

    const powerLostEvent: PowerLostEvent = {
      event: 'POWER_LOST',
      upsStatus: status,
      timestamp: new Date(),
    };

    this.upsGateway.emitPowerLost(powerLostEvent);
    this.eventsService.powerLost(status);

    await this.delay(5000);

    const shutdownEvent: ShutdownOrderEvent = {
      event: 'SHUTDOWN_ORDER',
      reason: 'Power lost and threshold reached',
      timestamp: new Date(),
    };

    this.upsGateway.emitShutdownOrder(shutdownEvent);
    this.eventsService.shutdownOrder('Power lost and threshold reached');
    this.logger.error('🔴 Shutdown order sent to all clients');
  }

  getUpsStatus(): UpsStatus | null {
    return this.currentUpsStatus;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}