# Instalación Cliente Go - Windows

## Compilar

```bash
cd client
GOOS=windows GOARCH=amd64 go build -o ups-client.exe .
```

## Instalar como servicio (NSSM)

### Con NSSM

```powershell
# Descargar nssm
Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile nssm.zip
Expand-Archive nssm.zip -DestinationPath nssm

# Copiar binario
Copy-Item ups-client.exe "C:\Program Files\UPS Client\"

# Crear directorio si no existe
New-Item -ItemType Directory -Force -Path "C:\Program Files\UPS Client"

# Instalar servicio
.\nssm\nssm-2.24\win64\nssm.exe install UPSClient "C:\Program Files\UPS Client\ups-client.exe"

# Configurar variables de entorno
.\nssm\nssm-2.24\win64\nssm.exe set UPSClient AppEnvironmentExtra "SERVER_URL=http://192.168.1.100:3000"

# Iniciar servicio
.\nssm\nssm-2.24\win64\nssm.exe start UPSClient
```

### Con SC (Native Windows)

```powershell
# Crear servicio
sc create UPSClient binPath= "C:\Program Files\UPS Client\ups-client.exe"
sc config UPSClient start= auto

# Configurar variables de entorno
sc failure UPSClient reset= 864000 actions= restart/60000/restart/60000/restart/60000

# Iniciar
sc start UPSClient
```

## Configuración

Crea un archivo `ups-client.env` en el directorio del ejecutable:

```env
SERVER_URL=http://192.168.1.100:3000
PROXMOX_ENABLED=false
```

O configura las variables del sistema:
```powershell
[System.Environment]::SetEnvironmentVariable("SERVER_URL", "http://192.168.1.100:3000", "Machine")
```

## Comandos

```powershell
# Ver estado
sc query UPSClient

# Iniciar
sc start UPSClient

# Detener
sc stop UPSClient

# Reiniciar
sc stop UPSClient && sc start UPSClient

# Desinstalar
sc delete UPSClient
```

## Notas

- Ejecute como Administrador
- El cliente necesita permisos de Administrador para ejecutar `shutdown /s`