export interface UpsStatus {
  upsName: string;
  voltage: number;
  load: number;
  batteryCharge: number;
  timeRemaining: number;
  status: 'OL' | 'OB' | 'OL CHRG' | 'OB DISCHRG' | 'OFFLINE';
  lastUpdate: Date;
}

export interface ClientInfo {
  id: string;
  hostname: string;
  ip: string;
  connectedAt: Date;
  lastHeartbeat: Date;
}

export interface PowerLostEvent {
  event: 'POWER_LOST';
  upsStatus: UpsStatus;
  timestamp: Date;
}

export interface ShutdownOrderEvent {
  event: 'SHUTDOWN_ORDER';
  reason: string;
  timestamp: Date;
}

export interface ClientRegisterPayload {
  hostname: string;
  os: string;
}

export interface ClientRegisterResponse {
  clientId: string;
  serverTime: Date;
}

export interface UpsEventMap {
  POWER_LOST: PowerLostEvent;
  SHUTDOWN_ORDER: ShutdownOrderEvent;
  UPS_STATUS_UPDATE: UpsStatus;
  CLIENT_REGISTERED: ClientInfo;
  CLIENT_DISCONNECTED: string;
}