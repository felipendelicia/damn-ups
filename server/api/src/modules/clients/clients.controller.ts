import { Controller, Get, Post, Body, Headers, Query } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { EventsService } from './events.service';
import { ClientInfo, ClientRegisterPayload } from '../../shared/interfaces/ups.types';

@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly eventsService: EventsService,
  ) {}

  @Get()
  getClients(): ClientInfo[] {
    return this.clientsService.getClients();
  }

  @Post('register')
  register(@Body() payload: ClientRegisterPayload): { clientId: string; serverTime: Date } {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    this.eventsService.registerClient(clientId);
    
    const clientInfo: ClientInfo = {
      id: clientId,
      hostname: payload.hostname,
      ip: 'unknown',
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      os: payload.os,
      version: payload.version || '1.0.0',
    };
    this.clientsService.addClient(clientInfo);
    
    return { clientId, serverTime: new Date() };
  }

  @Post('heartbeat')
  heartbeat(@Headers('x-client-id') clientId: string): { ok: boolean } {
    this.eventsService.heartbeat(clientId);
    return { ok: true };
  }

  @Get('events')
  getEvents(@Query('clientId') clientId: string): object[] {
    return this.eventsService.getEvents(clientId);
  }
}