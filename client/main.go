package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"
)

var (
	// Config
	configPath = flag.String("config", "", "Path to config file")
	logPath   = flag.String("log", "", "Log file path")
	debug    = flag.Bool("debug", false, "Debug mode")
	version  = flag.Bool("version", false, "Show version")

	// Runtime config (can be overridden by config file)
	serverURL       = getEnvDefault("SERVER_URL", "http://localhost:3000")
	reconnectMs     = getEnvInt("RECONNECT_INTERVAL", 5000)
	heartbeatMs     = getEnvInt("HEARTBEAT_INTERVAL", 30000)
	proxmoxEnabled = getEnvDefault("PROXMOX_ENABLED", "false") == "true"
	proxmoxHost    = getEnvDefault("PROXMOX_HOST", "localhost")
	proxmoxUser   = getEnvDefault("PROXMOX_USER", "root@pam")
	proxmoxTokenID    = getEnvDefault("PROXMOX_TOKEN_ID", "")
	proxmoxTokenSecret = getEnvDefault("PROXMOX_TOKEN_SECRET", "")
	shutdownDelay = getEnvInt("SHUTDOWN_DELAY", 5000)

	// Runtime state
	isShuttingDown  bool
	connected    bool
	reconnectTries int
	maxReconnectTries = 10
)

const (
	appName    = "Damn! Ups"
	appVersion = "1.0.0"
)

type Config struct {
	ServerURL       string `json:"serverUrl"`
	ReconnectMs    int    `json:"reconnectIntervalMs"`
	HeartbeatMs   int    `json:"heartbeatIntervalMs"`
	Proxmox      ProxmoxConfig `json:"proxmox"`
	Shutdown    ShutdownConfig `json:"shutdown"`
}

type ProxmoxConfig struct {
	Enabled     bool   `json:"enabled"`
	Host        string `json:"host"`
	User        string `json:"user"`
	TokenID     string `json:"tokenId"`
	TokenSecret string `json:"tokenSecret"`
}

type ShutdownConfig struct {
	DelayMs int `json:"delayMs"`
	Linux  string `json:"linux"`
	Windows string `json:"windows"`
}

type UpsStatus struct {
	UpsName        string    `json:"upsName"`
	Voltage      float64   `json:"voltage"`
	Load         float64   `json:"load"`
	BatteryCharge float64   `json:"batteryCharge"`
	TimeRemaining int      `json:"timeRemaining"`
	Status      string    `json:"status"`
	LastUpdate   time.Time `json:"lastUpdate"`
}

type PowerLostEvent struct {
	Event     string    `json:"event"`
	UpsStatus UpsStatus `json:"upsStatus"`
	Timestamp time.Time `json:"timestamp"`
}

type ShutdownOrderEvent struct {
	Event     string    `json:"event"`
	Reason   string   `json:"reason"`
	Timestamp time.Time `json:"timestamp"`
}

type ClientRegisterPayload struct {
	Hostname string `json:"hostname"`
	OS       string `json:"os"`
	Version  string `json:"version"`
}

func main() {
	flag.Parse()

	if *version {
		fmt.Printf("%s v%s\n", appName, appVersion)
		return
	}

	// Setup logging
	setupLogging()

	// Load config
	loadConfig()

	log.Printf("%s v%s starting on %s", appName, appVersion, runtime.GOOS)
	log.Printf("Server: %s", serverURL)

	// Setup signal handler
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Received shutdown signal")
		isShuttingDown = true
		os.Exit(0)
	}()

	connect()
}

func setupLogging() {
	if *logPath != "" {
		f, err := os.OpenFile(*logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			log.Printf("Warning: Cannot open log file: %v", err)
		} else {
			log.SetOutput(f)
			log.SetFlags(log.Ldate | log.Ltime | log.Lmicroseconds)
		}
	}

	if *debug {
		// Override for debug
	}
}

func loadConfig() {
	if *configPath == "" {
		*configPath = getEnvDefault("CONFIG_PATH", "")
	}

	if *configPath != "" && fileExists(*configPath) {
		data, err := os.ReadFile(*configPath)
		if err != nil {
			log.Printf("Warning: Cannot read config: %v", err)
			return
		}

		var cfg Config
		if err := json.Unmarshal(data, &cfg); err != nil {
			log.Printf("Warning: Invalid config: %v", err)
			return
		}

		// Apply config
		if cfg.ServerURL != "" {
			serverURL = cfg.ServerURL
		}
		if cfg.ReconnectMs > 0 {
			reconnectMs = cfg.ReconnectMs
		}
		if cfg.HeartbeatMs > 0 {
			heartbeatMs = cfg.HeartbeatMs
		}
		if cfg.Proxmox.Enabled {
			proxmoxEnabled = cfg.Proxmox.Enabled
			proxmoxHost = cfg.Proxmox.Host
			proxmoxUser = cfg.Proxmox.User
			proxmoxTokenID = cfg.Proxmox.TokenID
			proxmoxTokenSecret = cfg.Proxmox.TokenSecret
		}
		if cfg.Shutdown.DelayMs > 0 {
			shutdownDelay = cfg.Shutdown.DelayMs
		}

		log.Printf("Loaded config from %s", *configPath)
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

var clientID string

func connect() {
	for {
		if reconnectTries >= maxReconnectTries && maxReconnectTries > 0 {
			log.Printf("Max reconnect tries (%d) reached, giving up", maxReconnectTries)
			os.Exit(1)
		}

		log.Printf("Connecting to %s (attempt %d)", serverURL, reconnectTries+1)

		// Register via REST API
		payload := ClientRegisterPayload{
			Hostname: getHostname(),
			OS:       runtime.GOOS,
			Version:  appVersion,
		}
		payloadBytes, _ := json.Marshal(payload)
		resp, err := http.Post(
			serverURL+"/api/clients/register",
			"application/json",
			bytes.NewBuffer(payloadBytes),
		)
		if err != nil || resp.StatusCode < 200 || resp.StatusCode >= 300 {
			reconnectTries++
			retryDelay := time.Duration(reconnectMs) * time.Millisecond
			log.Printf("Connection failed: %v. Retrying in %dms", err, retryDelay)
			time.Sleep(retryDelay)
			continue
		}
		defer resp.Body.Close()

		var registerResp struct {
			ClientID   string    `json:"clientId"`
			ServerTime time.Time `json:"serverTime"`
		}
		json.NewDecoder(resp.Body).Decode(&registerResp)
		clientID = registerResp.ClientID

		connected = true
		reconnectTries = 0
		log.Printf("Registered as %s", clientID)

		// Start heartbeat
		go heartbeatLoop()

		// Poll for events
		pollEvents()
	}
}

func heartbeatLoop() {
	ticker := time.NewTicker(time.Duration(heartbeatMs) * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		if !connected {
			return
		}
		req, _ := http.NewRequest("POST", serverURL+"/api/clients/heartbeat", nil)
		req.Header.Set("X-Client-ID", clientID)
		client := &http.Client{Timeout: 5000}
		_, err := client.Do(req)
		if err != nil {
			log.Printf("Heartbeat failed: %v", err)
			connected = false
			return
		}
	}
}

func pollEvents() {
	pollInterval := 2 * time.Second
	for connected {
		resp, err := http.Get(serverURL + "/api/clients/events?clientId=" + clientID)
		if err != nil {
			time.Sleep(pollInterval)
			continue
		}
		var events []map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&events)
		resp.Body.Close()

		for _, event := range events {
			handleMessage(event)
		}
		time.Sleep(pollInterval)
	}
	connect()
}

func handleMessage(msg map[string]interface{}) {
	eventType, _ := msg["event"].(string)

	switch eventType {
	case "POWER_LOST":
		var event PowerLostEvent
		if data, ok := msg["upsStatus"]; ok {
			jsonBytes, _ := json.Marshal(data)
			json.Unmarshal(jsonBytes, &event.UpsStatus)
		}
		handlePowerLost(event)

	case "SHUTDOWN_ORDER":
		var event ShutdownOrderEvent
		if reason, ok := msg["reason"].(string); ok {
			event.Reason = reason
		}
		handleShutdownOrder(event)

	case "UPS_STATUS_UPDATE":
		var status UpsStatus
		jsonBytes, _ := json.Marshal(msg)
		json.Unmarshal(jsonBytes, &status)
		log.Printf("UPS: %s | Battery: %.0f%% | Load: %.0f%% | Time: %dm",
			status.Status, status.BatteryCharge, status.Load, status.TimeRemaining)
	}
}

func handlePowerLost(event PowerLostEvent) {
	log.Printf("⚠️ POWER_LOST: %s (%.0f%% battery)",
		event.UpsStatus.Status, event.UpsStatus.BatteryCharge)
}

func handleShutdownOrder(event ShutdownOrderEvent) {
	if isShuttingDown {
		log.Println("Shutdown already in progress, ignoring order")
		return
	}

	isShuttingDown = true
	log.Printf("🔴 SHUTDOWN_ORDER received: %s", event.Reason)

	// Optional delay before shutdown
	if shutdownDelay > 0 {
		log.Printf("Waiting %dms before shutdown...", shutdownDelay)
		time.Sleep(time.Duration(shutdownDelay) * time.Millisecond)
	}

	// Shutdown Proxmox VMs if enabled
	if proxmoxEnabled {
		log.Println("Shutdown Proxmox VMs...")
		shutdownProxmoxVms()
	}

	// Shutdown system
	log.Println("Shutting down system...")
	shutdownOS()
}

func shutdownProxmoxVms() {
	log.Println("Checking for running VMs...")

	cmd := exec.Command("qm", "list")
	output, err := cmd.Output()
	if err != nil {
		log.Printf("Failed to get VM list: %v", err)
		return
	}

	lines := strings.Split(string(output), "\n")
	var runningVMs []string

	for i, line := range lines {
		if i == 0 || strings.TrimSpace(line) == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 3 && fields[2] == "running" {
			runningVMs = append(runningVMs, fields[0])
		}
	}

	if len(runningVMs) == 0 {
		log.Println("No running VMs")
		return
	}

	log.Printf("Found %d running VMs: %v", len(runningVMs), runningVMs)

	// Shutdown each VM
	for _, vmid := range runningVMs {
		log.Printf("Shutdown VM %s...", vmid)
		cmd := exec.Command("qm", "shutdown", vmid)
		err := cmd.Run()
		if err != nil {
			log.Printf("Failed to shutdown VM %s: %v", vmid, err)
		}
	}

	// Wait for VMs to stop
	waitForVmsToStop(runningVMs)
}

func waitForVmsToStop(vmidList []string) {
	maxWait := 120 * time.Second
	pollInterval := 5 * time.Second
	deadline := time.Now().Add(maxWait)

	for time.Now().Before(deadline) {
		time.Sleep(pollInterval)

		cmd := exec.Command("qm", "list")
		output, err := cmd.Output()
		if err != nil {
			continue
		}

		running := 0
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			fields := strings.Fields(line)
			if len(fields) >= 3 {
				for _, vmid := range vmidList {
					if fields[0] == vmid && fields[2] == "running" {
						running++
					}
				}
			}
		}

		if running == 0 {
			log.Println("All VMs stopped")
			return
		}
		log.Printf("Waiting for %d VMs...", running)
	}
	log.Println("Timeout waiting for VMs")
}

func shutdownOS() {
	var cmd *exec.Cmd
	var err error

	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("shutdown", "/s", "/t", "30", "/c", "\"UPS power failure - system shutting down\"")
	case "linux":
		// Try systemctl first, then fallback to shutdown
		cmd = exec.Command("systemctl", "poweroff")
		err = cmd.Run()
		if err != nil {
			log.Printf("systemctl poweroff failed: %v, trying shutdown now", err)
			cmd = exec.Command("shutdown", "+1", "\"UPS power failure\"")
		}
	default:
		log.Printf("Unsupported platform: %s", runtime.GOOS)
		os.Exit(1)
	}

	if err == nil {
		err = cmd.Run()
		if err != nil {
			log.Printf("Shutdown command completed: %v", err)
		}
	}

	// If we get here, shutdown didn't work
	log.Println("Shutdown failed or not implemented for this OS")
	os.Exit(1)
}

func getHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return hostname
}

func getEnvDefault(key, def string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return def
}

func getEnvInt(key string, def int) int {
	if val := os.Getenv(key); val != "" {
		var n int
		if _, err := fmt.Sscanf(val, "%d", &n); err == nil {
			return n
		}
	}
	return def
}