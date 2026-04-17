# Damn! Ups

Sistema distribuido de monitoreo y control de energía UPS con shutdown automático.

## Descripción

Damn! Ups es un sistema que monitorea equipos UPS conectados vía NUT (Network UPS Tools) y ejecuta apagado automático en máquinas clientes cuando se detecta corte de energía.

### Características

- 🌐 **API REST** + WebSocket en tiempo real
- 🎨 **Frontend Web** para visualización
- 🖥️ **Clientes Go** multi-plataforma (Linux/Windows)
- 🔌 **Soporte Proxmox** - Apaga VMs antes del shutdown
- 🔄 **Auto-reconexión** en clientes
- 🎭 **Modo Mock** para desarrollo sin UPS

## Arquitectura

```
                    ┌─────────────────────┐
                    │   NUT (upsc)        │
                    │ USB HID Device      │
                    └─────────┬──────────-┘
                              │
                    ┌─────────▼──────────┐
                    │   API NestJS       │ :3000
                    │  (server/api)      │
                    ├─────────────────---┤
                    │ ◉ WebSocket        │
                    │ ◉ REST API         │
                    │ ◉ Mock Mode        │
                    │ ◉ SQLite           │
                    └─────────┬────────--┘
                              │
              ┌───────────────┼───────────┐
              │                           │
        ┌─────▼─────┐         ┌─────▼─────┐
        │ React     │:8080    │ Go Client │
        │ Web       │         │ (Linux)   │
        └─────────--┘         │(Windows)  │
                              └──────────-┘
```

## Estructura

```
damn-ups/
├── server/
│   ├── api/           # Servidor NestJS
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── monitoring/   # Monitoreo UPS
│   │   │   │   ├── gateway/      # WebSocket
│   │   │   │   └── clients/    # Registro clientes
│   │   │   └── app.service.ts
│   │   └── Dockerfile
│   └── web/          # Frontend React
│       └── src/
├── client/           # Cliente Go
│   ├── main.go
│   └── ups-client.service
└── README.md
```

---

# Instalación

## Requisitos

| Componente | Requisito |
|-----------|-----------|
| API | Node.js 18+ |
| Frontend | Node.js 18+ |
| Cliente Go | Go 1.21+ |
| UPS | NUT instalado |

### Instalar NUT

```bash
# Linux (Ubuntu/Debian)
sudo apt install nut

# macOS
brew install nut
```

---

## Desarrollo

### 1. API NestJS

```bash
cd server/api
npm install
npm run start:dev
```

**Con Mock (sin UPS física):**
```bash
MOCK_MODE=true npm run start:dev
```

**Puertos:**
- API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000`

### 2. Frontend React

```bash
cd server/web
npm install
npm start
```

**Puerto:** `http://localhost:8080`

---

## Cliente Go

### Compilar

```bash
cd client
go mod tidy

# Linux
go build -o ups-client .

# Windows
GOOS=windows GOARCH=amd64 go build -o ups-client.exe
```

### Ejecutar

```bash
# Con servidor
SERVER_URL=http://localhost:3000 ./ups-client

# Con Proxmox
PROXMOX_ENABLED=true PROXMOX_HOST=192.168.1.100 ./ups-client
```

### Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| SERVER_URL | http://localhost:3000 | URL del servidor |
| PROXMOX_ENABLED | false | Habilitar shutdown VMs |
| PROXMOX_HOST | localhost | Host Proxmox |
| PROXMOX_USER | root@pam | Usuario |
| PROXMOX_TOKEN_ID | | Token ID |
| PROXMOX_TOKEN_SECRET | | Token Secret |
| RECONNECT_INTERVAL | 5000 | Ms reconexión |
| HEARTBEAT_INTERVAL | 30000 | Ms heartbeat |

---

# Uso

## Iniciar todo

```bash
# Terminal 1: API (Mock)
cd server/api
MOCK_MODE=true npm run start:dev

# Terminal 2: Frontend
cd server/web
npm start

# Terminal 3: Cliente (opcional)
cd client
go run main.go
```

## URLs

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:8080 |
| API | http://localhost:3000/api |
| UPS Status | http://localhost:3000/api/ups/status |
| Clientes | http://localhost:3000/api/clients |

---

# Cómo funciona

## 1. Monitoreo UPS

El servidor ejecuta `upsc ups` cada 5 segundos (configurable):

```typescript
// monitoring.service.ts
const { stdout } = await execAsync(`upsc ${this.upsName}`);
const status = this.parseUpsOutput(stdout);
```

## 2. Detección de corte

Después de 2 lecturas consecutivas en estado "OB" (On Battery):

```typescript
if (status.status.startsWith('OB')) {
  consecutivePowerLost++;
  if (consecutivePowerLost >= threshold) {
    emitPowerLost();
  }
}
```

## 3. Eventos

```
Servidor UPS                       Clientes
    │                              │
    ├────── POWER_LOST ──────────► │
    │   (evento de warning)        │
    │                              │
    ├──── SHUTDOWN_ORDER ────────► │
    │   (5 segundos después)       │
    │                              │
    │                      ┌──────▼─────┐
    │                      │ shutdown   │
    │                      │ sistema    │
    │                      └───────────-┘
```

## 4. Shutdown Proxmox

Si `PROXMOX_ENABLED=true`, el cliente:

1. Lista VMs en ejecución: `qm list`
2. Envía shutdown a cada VM: `qm shutdown <vmid>`
3. Espera hasta que todas se detengan (timeout 120s)
4. Ejecuta shutdown del sistema

---

# API Reference

## REST Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/ups/status` | Estado actual UPS |
| GET | `/api/clients` | Clientes conectados |

## WebSocket Events

### Client → Server

| Event | Payload |
|-------|---------|
| `CLIENT_REGISTER` | `{ hostname, os }` |
| `CLIENT_HEARTBEAT` | - |

### Server → Client

| Event | Payload |
|-------|---------|
| `POWER_LOST` | `{ event, upsStatus, timestamp }` |
| `SHUTDOWN_ORDER` | `{ event, reason, timestamp }` |
| `UPS_STATUS_UPDATE` | `{ ...UpsStatus }` |

---

# Docker - Servidor

## Construir imagen

```bash
docker build -t damn-ups:latest -f server/api/Dockerfile .
```

## Ejecutar

```bash
# Con MOCK mode (desarrollo sin UPS)
docker run -d -p 3000:3000 -p 8080:8080 -e MOCK_MODE=true damn-ups:latest

# Con UPS física
docker run -d -p 3000:3000 -p 8080:8080 --device=/dev/usb/hiddev0 damn-ups:latest
```

---

# Cliente Go

Scripts de instalación en `client/install.sh` (Linux) y `client/install.ps1` (Windows).

## Cliente (Linux)

```bash
cd client
./install.sh build       # Compilar cliente Go
./install.sh install   # Instalar servicio systemd
./install.sh uninstall # Desinstalar servicio
./install.sh status    # Ver estado
./install.sh start   # Iniciar
./install.sh stop    # Detener
./install.sh restart # Reiniciar
```

## Cliente (Windows)

```powershell
cd client
.\install.ps1 build      # Compilar cliente Go
.\install.ps1 install  # Instalar servicio NSSM
.\install.ps1 uninstall # Desinstalar servicio
.\install.ps1 status   # Ver estado
.\install.ps1 start  # Iniciar
.\install.ps1 stop  # Detener
```

---

# Docker

```yaml
# docker-compose.yml
version: '3.8'
services:
  damn-ups:
    build: ./server/api
    ports:
      - "3000:3000"
    environment:
      - SERVER_PORT=3000
      - MOCK_MODE=true
    privileged: true
```

```bash
docker-compose up -d
```

---

# Troubleshooting

## Error: upsc not found

```bash
# Instalar NUT
sudo apt install nut
```

## Puerto en uso

```bash
# Ver proceso
lsof -i :3000

# Matar proceso
kill -9 <PID>
```

## Cliente no conecta

```bash
# Verificar API
curl http://localhost:3000/api/ups/status

# Ver logs del cliente
./ups-client
```

---

# Licencia

MIT