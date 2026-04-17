import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface ServerConfig {
  powerLostThreshold: number;
  lowBatteryThreshold: number;
  pollInterval: number;
  mockMode: boolean;
}

@Injectable()
export class ConfigStoreService {
  private readonly logger = new Logger(ConfigStoreService.name);
  private configPath: string;
  private config: ServerConfig;
  private readonly mockModeEnv: boolean;
  private onConfigChange: (() => void) | null = null;

  constructor(private configService: ConfigService) {
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    this.configPath = join(dataDir, 'server-config.json');
    
    this.mockModeEnv = this.configService.get<boolean>('MOCK_MODE', false);
    this.config = this.loadConfig();
    
    if (this.mockModeEnv) {
      this.logger.warn('MOCK MODE enabled from environment');
    }
  }

  private loadConfig(): ServerConfig {
    const defaults: ServerConfig = {
      powerLostThreshold: this.configService.get<number>('POWER_LOST_THRESHOLD', 2),
      lowBatteryThreshold: this.configService.get<number>('LOW_BATTERY_THRESHOLD', 20),
      pollInterval: this.configService.get<number>('POLL_INTERVAL', 5000),
      mockMode: this.mockModeEnv,
    };

    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        const saved = JSON.parse(data);
        this.logger.log('Loaded config from file');
        return { ...defaults, ...saved, mockMode: this.mockModeEnv };
      }
    } catch (error) {
      this.logger.error(`Failed to load config: ${error.message}`);
    }

    return defaults;
  }

  getConfig(): ServerConfig {
    return this.config;
  }

  setOnConfigChange(callback: () => void) {
    this.onConfigChange = callback;
  }

  updateConfig(updates: Partial<ServerConfig>): ServerConfig {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    this.logger.log(`Config updated: ${JSON.stringify(updates)}`);
    
    if (this.onConfigChange) {
      this.onConfigChange();
    }
    
    return this.config;
  }

  private saveConfig(): void {
    try {
      const dir = join(process.cwd(), 'data');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      this.logger.error(`Failed to save config: ${error.message}`);
    }
  }
}