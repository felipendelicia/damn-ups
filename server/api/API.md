# Damn! Ups - API Reference

## Base URL

```
http://localhost:3000/api
```

## Endpoints

### GET /ups/status

Get current UPS status.

**Response:**
```json
{
  "upsName": "ups",
  "voltage": 220.5,
  "load": 35.2,
  "batteryCharge": 100,
  "timeRemaining": 999,
  "status": "OL",
  "lastUpdate": "2026-04-17T12:00:00.000Z"
}
```

### GET /clients

Get connected clients.

**Response:**
```json
{
  "clients": [
    {
      "id": "abc123",
      "hostname": "server-01",
      "ip": "192.168.1.100",
      "connectedAt": "2026-04-17T12:00:00.000Z",
      "lastHeartbeat": "2026-04-17T12:00:05.000Z"
    }
  ]
}
```

## WebSocket Events

### Client → Server

#### CLIENT_REGISTER

Register client with server.

```json
{
  "type": "CLIENT_REGISTER",
  "payload": {
    "hostname": "server-01",
    "os": "linux",
    "version": "1.0.0"
  }
}
```

#### CLIENT_HEARTBEAT

Send heartbeat.

```json
{
  "type": "CLIENT_HEARTBEAT",
  "os": "linux",
  "status": "online"
}
```

### Server → Client

#### POWER_LOST

Power loss detected.

```json
{
  "event": "POWER_LOST",
  "upsStatus": {
    "upsName": "ups",
    "voltage": 0,
    "load": 35.2,
    "batteryCharge": 85,
    "timeRemaining": 45,
    "status": "OB",
    "lastUpdate": "2026-04-17T12:00:00.000Z"
  },
  "timestamp": "2026-04-17T12:00:00.000Z"
}
```

#### SHUTDOWN_ORDER

Shutdown order received.

```json
{
  "event": "SHUTDOWN_ORDER",
  "reason": "Power lost and threshold reached",
  "timestamp": "2026-04-17T12:00:05.000Z"
}
```

#### UPS_STATUS_UPDATE

UPS status update.

```json
{
  "upsName": "ups",
  "voltage": 220.5,
  "load": 35.2,
  "batteryCharge": 100,
  "timeRemaining": 999,
  "status": "OL",
  "lastUpdate": "2026-04-17T12:00:00.000Z"
}
```

## Status Values

| Status | Description |
|--------|------------|
| OL | On Line (AC power) |
| OL CHRG | On Line Charging |
| OB | On Battery |
| OB DISCHRG | On Battery Discharging |
| OFFLINE | Offline |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| SERVER_PORT | 3000 | HTTP port |
| UPS_NAME | ups | NUT UPS name |
| MOCK_MODE | false | Mock UPS data |
| POWER_LOST_THRESHOLD | 2 | Readings before shutdown |
| LOW_BATTERY_THRESHOLD | 20 | Battery % for warning |
| POLL_INTERVAL | 5000 | UPS poll interval (ms) |