# Damn! Ups - Windows Installer Script

param(
    [Parameter(Position=0)]
    [string]$Command = "help",
    
    [Parameter(Position=1)]
    [string]$Arg1 = ""
)

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_NAME = "damn-ups"
$BINARY_NAME = "ups-client.exe"
$SERVICE_NAME = "DamnUps"

function Write-LogInfo { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Green }
function Write-LogWarn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-LogError { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Show-Usage {
    Write-Host @"
Uso: .\install.ps1 <comando> [argumentos]

Comandos:
  install     Instalar servicio (usa NSSM)
  uninstall  Desinstalar servicio
  start      Iniciar servicio
  stop       Detener servicio
  restart    Reiniciar servicio
  status     Ver estado del servicio
  build      Compilar cliente Go
  help       Mostrar esta ayuda

Ejemplos:
  .\install.ps1 install
  .\install.ps1 build
  .\install.ps1 status

"@
}

function Test-GoInstalled {
    try {
        $goVersion = & go version 2>&1
        return $true
    } catch {
        return $false
    }
}

function Build-Client {
    Write-LogInfo "Compilando cliente Go..."
    
    Set-Location $SCRIPT_DIR
    
    if (-not (Test-Path "go.mod")) {
        Write-LogError "No se encontró go.mod"
        return $false
    }
    
    & go mod tidy
    
    $env:GOOS = "windows"
    $env:GOARCH = "amd64"
    
    & go build -o $BINARY_NAME .
    
    if ($LASTEXITCODE -eq 0) {
        Write-LogInfo "Cliente compilado: $BINARY_NAME"
        return $true
    } else {
        Write-LogError "Error compilando"
        return $false
    }
}

function Install-Service {
    if (-not (Test-GoInstalled)) {
        Write-LogError "Go no está instalado"
        return $false
    }
    
    $buildResult = Build-Client
    if (-not $buildResult) { return $false }
    
    Write-LogInfo "Instalando servicio $SERVICE_NAME..."
    
    # Buscar NSSM
    $nssmPath = $null
    if (Test-Path ".\nssm\nssm-2.24\win64\nssm.exe") {
        $nssmPath = ".\nssm\nssm-2.24\win64\nssm.exe"
    } elseif (Test-Path "C:\nssm\nssm-2.24\win64\nssm.exe") {
        $nssmPath = "C:\nssm\nssm-2.24\win64\nssm.exe"
    } else {
        Write-LogWarn "NSSM no encontrado. descargando..."
        Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile "nssm.zip"
        Expand-Archive -Path "nssm.zip" -DestinationPath "nssm" -Force
        $nssmPath = ".\nssm\nssm-2.24\win64\nssm.exe"
    }
    
    # Crear directorio
    $installDir = "C:\Program Files\$APP_NAME"
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    
    # Copiar binario
    Copy-Item $BINARY_NAME $installDir\ -Force
    
    # Instalar servicio
    & $nssmPath install $SERVICE_NAME "$installDir\$BINARY_NAME"
    
    # Configurar recuperación automática
    & $nssmPath set $SERVICE_NAME AppRestartDelay 5000
    
    # Iniciar servicio
    Start-Service $SERVICE_NAME
    
    Write-LogInfo "Servicio instalado"
    Write-LogInfo "Usa 'Get-Service $SERVICE_NAME' para ver el estado"
}

function Uninstall-Service {
    Write-LogInfo "Desinstalando servicio $SERVICE_NAME..."
    
    # Buscar NSSM
    $nssmPath = $null
    if (Test-Path ".\nssm\nssm-2.24\win64\nssm.exe") {
        $nssmPath = ".\nssm\nssm-2.24\win64\nssm.exe"
    } elseif (Test-Path "C:\nssm\nssm-2.24\win64\nssm.exe") {
        $nssmPath = "C:\nssm\nssm-2.24\win64\nssm.exe"
    }
    
    if ($nssmPath) {
        Stop-Service $SERVICE_NAME -ErrorAction SilentlyContinue
        & $nssmPath remove $SERVICE_NAME confirm
    } else {
        # Usar sc
        Stop-Service $SERVICE_NAME -ErrorAction SilentlyContinue
        sc.exe delete $SERVICE_NAME
    }
    
    # Eliminar archivos
    $installDir = "C:\Program Files\$APP_NAME"
    if (Test-Path $installDir) {
        Remove-Item $installDir -Recurse -Force
    }
    
    Write-LogInfo "Servicio desinstalado"
}

function Start-ServiceCmd {
    Start-Service $SERVICE_NAME
    Write-LogInfo "Servicio iniciado"
}

function Stop-ServiceCmd {
    Stop-Service $SERVICE_NAME
    Write-LogInfo "Servicio detenido"
}

function Restart-ServiceCmd {
    Restart-Service $SERVICE_NAME
    Write-LogInfo "Servicio reiniciado"
}

function Status-ServiceCmd {
    Get-Service $SERVICE_NAME
}

switch ($Command) {
    "install" { Install-Service }
    "uninstall" { Uninstall-Service }
    "start" { Start-ServiceCmd }
    "stop" { Stop-ServiceCmd }
    "restart" { Restart-ServiceCmd }
    "status" { Status-ServiceCmd }
    "build" { Build-Client }
    "help" { Show-Usage }
    default { Show-Usage }
}