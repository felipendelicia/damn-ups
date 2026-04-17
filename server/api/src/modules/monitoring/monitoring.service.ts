import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { UpsStatus } from '../../shared/interfaces/ups.types';

const execAsync = promisify(exec);

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly upsName: string;
  private lastPowerLostCount = 0;
  private consecutivePowerLost = 0;
  private powerLostThreshold: number;
  private lowBatteryThreshold: number;
  private mockMode: boolean;
  private mockStatusCycle = 0;

  constructor(private configService: ConfigService) {
    this.upsName = this.configService.get<string>('UPS_NAME', 'ups');
    this.powerLostThreshold = this.configService.get<number>('POWER_LOST_THRESHOLD', 2);
    this.lowBatteryThreshold = this.configService.get<number>('LOW_BATTERY_THRESHOLD', 20);
    this.mockMode = this.configService.get<boolean>('MOCK_MODE', false);
    
    if (this.mockMode) {
      this.logger.warn('MOCK MODE enabled - Simulating UPS data');
    }
  }

  updateThresholds(powerLost: number, lowBattery: number): void {
    this.powerLostThreshold = powerLost;
    this.lowBatteryThreshold = lowBattery;
    this.logger.log(`Updated thresholds: powerLost=${powerLost}, lowBattery=${lowBattery}`);
  }

  async getUpsStatus(): Promise<UpsStatus | null> {
    if (this.mockMode) {
      return this.getMockStatus();
    }

    try {
      const { stdout } = await execAsync(`upsc ${this.upsName}`);
      return this.parseUpsOutput(stdout);
    } catch (error) {
      this.logger.error(`Failed to get UPS status: ${error.message}`);
      return null;
    }
  }

  private getMockStatus(): UpsStatus {
    this.mockStatusCycle++;
    
    const statuses: UpsStatus['status'][] = ['OL', 'OL CHRG', 'OB', 'OB DISCHRG', 'OL'];
    const status = statuses[this.mockStatusCycle % 5];
    
    const batteryMap: Record<UpsStatus['status'], number> = {
      'OL': 100,
      'OL CHRG': 85,
      'OB': 75,
      'OB DISCHRG': 50,
      'OFFLINE': 0,
    };

    return {
      upsName: this.upsName,
      voltage: status.startsWith('OB') ? 0 : 220.5,
      load: 35 + Math.random() * 10,
      batteryCharge: batteryMap[status] || 100,
      timeRemaining: status.startsWith('OB') ? 30 + Math.floor(Math.random() * 20) : 999,
      status,
      lastUpdate: new Date(),
    };
  }

  private parseUpsOutput(output: string): UpsStatus {
    const lines = output.split('\n');
    const data: Record<string, string> = {};

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        data[key.trim()] = valueParts.join(':').trim();
      }
    }

    const voltage = parseFloat(data['input.voltage'] || data['battery.voltage'] || '0');
    const load = parseFloat(data['ups.load'] || '0');
    const batteryCharge = parseFloat(data['battery.charge'] || '0');
    const timeRemaining = parseInt(data['battery.runtime'] || '0', 10) / 60;
    const status = this.mapStatus(data['ups.status'] || 'UNKNOWN');

    return {
      upsName: this.upsName,
      voltage,
      load,
      batteryCharge,
      timeRemaining: Math.round(timeRemaining),
      status,
      lastUpdate: new Date(),
    };
  }

  private mapStatus(statusStr: string): UpsStatus['status'] {
    const status = statusStr.toUpperCase();
    if (status.includes('OL') && status.includes('CHRG')) return 'OL CHRG';
    if (status.includes('OL')) return 'OL';
    if (status.includes('OB') && status.includes('DISCHRG')) return 'OB DISCHRG';
    if (status.includes('OB')) return 'OB';
    return 'OFFLINE';
  }

  checkPowerLost(status: UpsStatus): boolean {
    const isOnBattery = status.status.startsWith('OB');
    
    if (isOnBattery) {
      this.consecutivePowerLost++;
      this.logger.warn(`Power lost detected! (${this.consecutivePowerLost}/${this.powerLostThreshold})`);
    } else {
      if (this.consecutivePowerLost > 0) {
        this.logger.log('Power restored');
      }
      this.consecutivePowerLost = 0;
    }

    return this.consecutivePowerLost >= this.powerLostThreshold;
  }

  resetPowerLostCounter(): void {
    this.consecutivePowerLost = 0;
  }

  isLowBattery(status: UpsStatus): boolean {
    return status.batteryCharge < this.lowBatteryThreshold;
  }
}