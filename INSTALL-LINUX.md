# Instalación Cliente Go - Linux

## Compilar

```bash
cd client
go mod tidy
GOOS=linux go build -o ups-client .
```

## Instalar como servicio systemd

```bash
# Copiar binario
sudo cp ups-client /usr/local/bin/

# Copiar servicio
sudo cp ups-client.service /etc/systemd/system/
sudo cp ups-client.service /etc/systemd/system/ups-client.service

# Recargar systemd
sudo systemctl daemon-reload

# Iniciar servicio
sudo systemctl enable ups-client
sudo systemctl start ups-client

# Ver estado
sudo systemctl status ups-client
```

## Configuración

### Variables de entorno

Edita el servicio o crea `/etc/default/ups-client`:

```bash
SERVER_URL=http://192.168.1.100:3000
PROXMOX_ENABLED=false
PROXMOX_HOST=localhost
```

### Con systemd

```bash
sudo systemctl edit ups-client
```

Añade:

```ini
[Service]
Environment="SERVER_URL=http://192.168.1.100:3000"
Environment="PROXMOX_ENABLED=false"
```

## Comandos útiles

```bash
# Ver logs
sudo journalctl -u ups-client -f

# Reiniciar
sudo systemctl restart ups-client

# Detener
sudo systemctl stop ups-client

# Desinstalar
sudo systemctl stop ups-client
sudo systemctl disable ups-client
sudo rm /etc/systemd/system/ups-client.service
sudo rm /usr/local/bin/ups-client
```

## Permisos

El cliente necesita permisos para ejecutar shutdown:

```bash
# En sistemas con sudo
echo "username ALL=(ALL) NOPASSWD: /sbin/shutdown" | sudo tee /etc/sudoers.d/shutdown

# O agregar al grupo systemd
sudo usermod -aG systemd-halt username
```