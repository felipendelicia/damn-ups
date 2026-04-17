import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ClientInfo, UpsStatus, ShutdownOrderEvent, PowerLostEvent, ClientRegisterPayload, ClientRegisterResponse } from '../../shared/interfaces/ups.types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class UpsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(UpsGateway.name);
  private clients: Map<string, ClientInfo> = new Map();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      this.logger.log(`Client disconnected: ${clientInfo.hostname} (${client.id})`);
      this.clients.delete(client.id);
      this.server.emit('CLIENT_DISCONNECTED', client.id);
    }
  }

  @SubscribeMessage('CLIENT_REGISTER')
  handleRegister(client: Socket, payload: ClientRegisterPayload): ClientRegisterResponse {
    const clientInfo: ClientInfo = {
      id: client.id,
      hostname: payload.hostname,
      ip: client.handshake.address || 'unknown',
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
    };

    this.clients.set(client.id, clientInfo);
    this.logger.log(`Client registered: ${payload.hostname} (${client.id})`);
    
    this.server.emit('CLIENT_REGISTERED', clientInfo);
    
    return {
      clientId: client.id,
      serverTime: new Date(),
    };
  }

  @SubscribeMessage('CLIENT_HEARTBEAT')
  handleHeartbeat(client: Socket) {
    const clientInfo = this.clients.get(client.id);
    if (clientInfo) {
      clientInfo.lastHeartbeat = new Date();
    }
  }

  getConnectedClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  emitPowerLost(event: PowerLostEvent): void {
    this.logger.warn('Emitting POWER_LOST event to all clients');
    this.server.emit('POWER_LOST', event);
  }

  emitShutdownOrder(event: ShutdownOrderEvent): void {
    this.logger.warn('Emitting SHUTDOWN_ORDER event to all clients');
    this.server.emit('SHUTDOWN_ORDER', event);
  }

  emitUpsStatusUpdate(status: UpsStatus): void {
    this.server.emit('UPS_STATUS_UPDATE', status);
  }
}