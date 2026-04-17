import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ClientInfo } from '../../shared/interfaces/ups.types';

interface ClientStore {
  clients: ClientInfo[];
  authorizedClients: string[];
}

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);
  private readonly storePath: string;
  private store: ClientStore;

  constructor(private configService: ConfigService) {
    this.storePath = join(process.cwd(), 'data', 'clients.json');
    this.store = this.loadStore();
  }

  private loadStore(): ClientStore {
    try {
      if (existsSync(this.storePath)) {
        const data = readFileSync(this.storePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.logger.error(`Failed to load client store: ${error.message}`);
    }
    return { clients: [], authorizedClients: [] };
  }

  private saveStore(): void {
    try {
      const dir = require('path').dirname(this.storePath);
      if (!existsSync(dir)) {
        require('fs').mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.storePath, JSON.stringify(this.store, null, 2));
    } catch (error) {
      this.logger.error(`Failed to save client store: ${error.message}`);
    }
  }

  addClient(client: ClientInfo): void {
    const existing = this.store.clients.find(c => c.id === client.id);
    if (!existing) {
      this.store.clients.push(client);
      this.saveStore();
    }
  }

  removeClient(clientId: string): void {
    this.store.clients = this.store.clients.filter(c => c.id !== clientId);
    this.saveStore();
  }

  getClients(): ClientInfo[] {
    return this.store.clients;
  }

  authorizeClient(hostname: string): void {
    if (!this.store.authorizedClients.includes(hostname)) {
      this.store.authorizedClients.push(hostname);
      this.saveStore();
    }
  }

  isAuthorized(hostname: string): boolean {
    return this.store.authorizedClients.includes(hostname);
  }

  getAuthorizedClients(): string[] {
    return this.store.authorizedClients;
  }
}