#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="damn-ups"
BINARY_NAME="ups-client"
SERVICE_NAME="damn-ups"
PORT=3000
WEB_PORT=8080

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    echo "Uso: $0 <comando>"
    echo ""
    echo "Comandos:"
    echo "  install     Instalar servicio systemd"
    echo "  uninstall  Desinstalar servicio"
    echo "  start      Iniciar servicio"
    echo "  stop       Detener servicio"
    echo "  restart    Reiniciar servicio"
    echo "  status     Ver estado del servicio"
    echo "  build      Compilar cliente Go"
    echo "  help       Mostrar ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 install        # Instalar con valores por defecto"
    echo "  $0 install 3001   # Instalar en puerto 3001"
    echo "  $0 uninstall      # Desinstalar servicio"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Este script debe ejecutarse como root"
        exit 1
    fi
}

check_go() {
    if ! command -v go &> /dev/null; then
        log_error "Go no está instalado"
        exit 1
    fi
}

build_client() {
    log_info "Compilando cliente Go..."
    cd "$SCRIPT_DIR"
    
    if [ ! -f "go.mod" ]; then
        log_error "No se encontró go.mod"
        exit 1
    fi
    
    go mod tidy
    GOOS=linux go build -o "$BINARY_NAME" .
    
    log_info "Cliente compilado: $BINARY_NAME"
}

install_service() {
    check_root
    build_client
    
    local custom_port="${1:-$PORT}"
    
    log_info "Instalando servicio $SERVICE_NAME..."
    
    # Copiar binario
    cp "$BINARY_NAME" /usr/local/bin/
    chmod +x /usr/local/bin/$BINARY_NAME
    
    # Copiar servicio
    cp "$SERVICE_NAME.service" "/etc/systemd/system/$SERVICE_NAME.service"
    
    # Crear directorio de la app
    mkdir -p /opt/$APP_NAME
    cp "$BINARY_NAME" /opt/$APP_NAME/
    
    # Configurar variables
    cat > /opt/$APP_NAME/env << EOF
SERVER_URL=http://localhost:$custom_port
EOF
    
    # Recargar systemd
    systemctl daemon-reload
    
    # Habilitar e iniciar
    systemctl enable $SERVICE_NAME
    systemctl start $SERVICE_NAME
    
    log_info "Servicio instalado y iniciado en puerto $custom_port"
    log_info "Usa 'systemctl status $SERVICE_NAME' para ver el estado"
}

uninstall_service() {
    check_root
    
    log_info "Desinstalando servicio $SERVICE_NAME..."
    
    systemctl stop $SERVICE_NAME 2>/dev/null || true
    systemctl disable $SERVICE_NAME 2>/dev/null || true
    
    rm -f "/etc/systemd/system/$SERVICE_NAME.service"
    rm -rf /opt/$APP_NAME
    rm -f /usr/local/bin/$BINARY_NAME
    
    systemctl daemon-reload
    
    log_info "Servicio desinstalado"
}

start_service() {
    systemctl start $SERVICE_NAME
    log_info "Servicio iniciado"
}

stop_service() {
    systemctl stop $SERVICE_NAME
    log_info "Servicio detenido"
}

restart_service() {
    systemctl restart $SERVICE_NAME
    log_info "Servicio reiniciado"
}

status_service() {
    systemctl status $SERVICE_NAME
}

case "$1" in
    install)
        install_service "$2"
        ;;
    uninstall)
        uninstall_service
        ;;
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        restart_service
        ;;
    status)
        status_service
        ;;
    build)
        build_client
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        usage
        ;;
esac