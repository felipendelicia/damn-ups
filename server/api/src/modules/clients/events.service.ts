import { Injectable, Logger } from '@nestjs/common';

interface PendingEvent {
  clientId: string;
  event: object;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private pendingEvents: Map<string, object[]> = new Map();
  private registeredClients: Set<string> = new Set();

  registerClient(clientId: string): void {
    this.registeredClients.add(clientId);
    this.pendingEvents.set(clientId, []);
    this.logger.log(`Client registered: ${clientId}`);
  }

  removeClient(clientId: string): void {
    this.registeredClients.delete(clientId);
    this.pendingEvents.delete(clientId);
    this.logger.log(`Client removed: ${clientId}`);
  }

  getClients(): string[] {
    return Array.from(this.registeredClients);
  }

  heartbeat(clientId: string): void {
    if (this.registeredClients.has(clientId)) {
      const events = this.pendingEvents.get(clientId) || [];
      events.push({ event: 'HEARTBEAT_ACK', timestamp: new Date() });
      this.pendingEvents.set(clientId, events);
    }
  }

  getEvents(clientId: string): object[] {
    const events = this.pendingEvents.get(clientId) || [];
    this.pendingEvents.set(clientId, []);
    return events;
  }

  broadcast(event: object): void {
    this.logger.warn(`Broadcasting event to ${this.registeredClients.size} clients`);
    for (const clientId of this.registeredClients) {
      const events = this.pendingEvents.get(clientId) || [];
      events.push(event);
      this.pendingEvents.set(clientId, events);
    }
  }

  powerLost(upsStatus: object): void {
    this.broadcast({ event: 'POWER_LOST', upsStatus, timestamp: new Date() });
  }

  shutdownOrder(reason: string): void {
    this.broadcast({ event: 'SHUTDOWN_ORDER', reason, timestamp: new Date() });
  }

  upsStatusUpdate(status: object): void {
    this.broadcast({ event: 'UPS_STATUS_UPDATE', ...status });
  }
}