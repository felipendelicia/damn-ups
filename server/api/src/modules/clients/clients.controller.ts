import { Controller, Get } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientInfo } from '../../shared/interfaces/ups.types';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  getClients(): ClientInfo[] {
    return this.clientsService.getClients();
  }
}