# Damn! Ups

Sistema distribuido de monitoreo y control de energía UPS con shutdown automático.

## Inicio Rápido

### 1. Configuración

```bash
# Servidor
cp server/.env.example server/.env

# Cliente
cp client/.env.example client/.env

# Docker
cp .env.docker.example .env
```

### 2. Desarrollo

```bash
# Terminal 1: API
cd server/api
npm install
MOCK_MODE=true npm run start:dev

# Terminal 2: Frontend
cd server/web
npm install
npm start
```

### 3. Producción

```bash
# Docker
docker-compose up -d --build

# Cliente Go
cd client
go build -o ups-client .
./install.sh install
```

## Estructura

```
damn-ups/
├── .env.docker.example    # Docker
├── server/
│   ├── .env.example      # Servidor
│   ├── api/              # NestJS
│   └── web/              # React
├── client/
│   ├── .env.example      # Cliente Go
│   ├── main.go
│   └── install.sh
├── shared/
└── README.md
```

## Configuración

### Servidor (`server/.env`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| SERVER_PORT | 3000 | Puerto HTTP |
| UPS_NAME | ups | Nombre UPS en NUT |
| POLL_INTERVAL | 5000 | Ms entre polls |
| POWER_LOST_THRESHOLD | 2 | Readings para shutdown |
| LOW_BATTERY_THRESHOLD | 20 | % batería baja |
| MOCK_MODE | false | Modo simulación |

**Nota:** NUT detecta UPS automáticamente. Verificar con:
```bash
upsc -l  # Listar UPS disponibles
```

### Cliente (`client/.env`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| SERVER_URL | http://localhost:3000 | URL servidor |
| RECONNECT_INTERVAL | 5000 | Ms reconexión |
| HEARTBEAT_INTERVAL | 30000 | Ms heartbeat |
| PROXMOX_ENABLED | false | Apagar VMs Proxmox |
| PROXMOX_HOST | localhost | Host Proxmox |
| SHUTDOWN_DELAY | 5000 | Ms antes de shutdown |

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/ups/status` | Estado UPS |
| GET | `/api/clients` | Clientes conectados |
| GET | `/api/config` | Configuración |
| POST | `/api/config` | Actualizar config |

## WebSocket

- Conectar a: `ws://localhost:3000/socket.io/?EIO=4&transport=websocket`

Eventos:
- `CLIENT_REGISTER`, `CLIENT_HEARTBEAT` (cliente → servidor)
- `POWER_LOST`, `SHUTDOWN_ORDER`, `UPS_STATUS_UPDATE` (servidor → cliente)

## URLs

| Servicio | URL |
|----------|-----|
| Web | http://localhost:8080 |
| API | http://localhost:3000/api |

## Docker

```bash
docker-compose up -d
```

---

## Licencia

MIT