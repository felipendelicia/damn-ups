package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

var (
	serverURL     = getEnv("SERVER_URL", "http://localhost:3000")
	reconnectInterval = 5000
	heartbeatInterval = 30000
	proxmoxEnabled    = getEnv("PROXMOX_ENABLED", "false") == "true"
	proxmoxHost       = getEnv("PROXMOX_HOST", "localhost")
	proxmoxUser       = getEnv("PROXMOX_USER", "root@pam")
	proxmoxTokenID    = getEnv("PROXMOX_TOKEN_ID", "")
	proxmoxTokenSecret = getEnv("PROXMOX_TOKEN_SECRET", "")
	isShuttingDown    = false
)

type UpsStatus struct {
	UpsName        string `json:"upsName"`
	Voltage        float64 `json:"voltage"`
	Load          float64 `json:"load"`
	BatteryCharge float64 `json:"batteryCharge"`
	TimeRemaining int     `json:"timeRemaining"`
	Status        string  `json:"status"`
	LastUpdate    time.Time `json:"lastUpdate"`
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
}

type ClientInfo struct {
	ID             string    `json:"id"`
	Hostname       string    `json:"hostname"`
	IP             string    `json:"ip"`
	ConnectedAt    time.Time `json:"connectedAt"`
	LastHeartbeat  time.Time `json:"lastHeartbeat"`
}

func main() {
	log.Printf("UPS Client starting on %s...", runtime.GOOS)
	connect()
}

func connect() {
	wsURL := strings.Replace(serverURL, "http", "ws", 1) + "/socket.io/?EIO=4&transport=websocket"
	
	log.Printf("Connecting to %s", wsURL)
	
	c, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		log.Printf("Connection error: %v. Reconnecting in %dms", err, reconnectInterval)
		time.AfterFunc(time.Duration(reconnectInterval)*time.Millisecond, connect)
		return
	}
	defer c.Close()

	log.Println("Connected to server")

	err = c.WriteJSON(map[string]interface{}{
		"type": "CLIENT_REGISTER",
		"payload": ClientRegisterPayload{
			Hostname: getHostname(),
			OS:       runtime.GOOS,
		},
	})
	if err != nil {
		log.Printf("Failed to register: %v", err)
		return
	}

	go heartbeat(c)

	for {
		var msg map[string]interface{}
		err := c.ReadJSON(&msg)
		if err != nil {
			log.Printf("Read error: %v. Reconnecting...", err)
			time.AfterFunc(time.Duration(reconnectInterval)*time.Millisecond, connect)
			return
		}

		handleMessage(msg)
	}
}

func heartbeat(c *websocket.Conn) {
	ticker := time.NewTicker(time.Duration(heartbeatInterval) * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		err := c.WriteJSON(map[string]interface{}{"type": "CLIENT_HEARTBEAT"})
		if err != nil {
			return
		}
	}
}

func handleMessage(msg map[string]interface{}) {
	eventType, ok := msg["event"].(string)
	if !ok {
		return
	}

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
		log.Printf("UPS Status: %s, Battery: %.0f%%", status.Status, status.BatteryCharge)
	}
}

func handlePowerLost(event PowerLostEvent) {
	log.Printf("POWER_LOST event: %s", event.UpsStatus.Status)
}

func handleShutdownOrder(event ShutdownOrderEvent) {
	if isShuttingDown {
		log.Println("Shutdown already in progress, ignoring order")
		return
	}
	
	isShuttingDown = true
	log.Printf("SHUTDOWN_ORDER received: %s", event.Reason)

	if proxmoxEnabled {
		shutdownProxmoxVms()
	}

	shutdownSystem()
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

	for _, vmid := range runningVMs {
		log.Printf("Shutting down VM %s...", vmid)
		cmd := exec.Command("qm", "shutdown", vmid)
		err := cmd.Run()
		if err != nil {
			log.Printf("Failed to shutdown VM %s: %v", vmid, err)
		}
	}

	waitForVmsToStop(runningVMs)
}

func waitForVmsToStop(vmidList []string) {
	maxWait := 120 * time.Second
	pollInterval := 5 * time.Second
	startTime := time.Now()

	for time.Since(startTime) < maxWait {
		time.Sleep(pollInterval)

		cmd := exec.Command("qm", "list")
		output, err := cmd.Output()
		if err != nil {
			continue
		}

		lines := strings.Split(string(output), "\n")
		stillRunning := 0

		for _, line := range lines {
			fields := strings.Fields(line)
			if len(fields) >= 3 {
				for _, vmid := range vmidList {
					if fields[0] == vmid && fields[2] == "running" {
						stillRunning++
					}
				}
			}
		}

		if stillRunning == 0 {
			log.Println("All VMs stopped")
			return
		}

		log.Printf("Waiting for %d VMs to stop...", stillRunning)
	}

	log.Println("Timeout waiting for VMs to stop")
}

func shutdownSystem() {
	log.Println("Shutting down system...")

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("shutdown", "/s", "/t", "0")
	case "linux":
		cmd = exec.Command("shutdown", "now")
	default:
		log.Printf("Unsupported platform: %s", runtime.GOOS)
		os.Exit(1)
	}

	err := cmd.Run()
	if err != nil {
		log.Printf("Shutdown command failed: %v", err)
		os.Exit(1)
	}
}

func getHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return hostname
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}