export type ConfigType = "wireguard" | "ssh" | "watchdog" | "mtu" | "usb" | "cloudflare";

export interface ConfigVariable {
  key: string;
  label: string;
  defaultValue: string;
  placeholder: string;
  description: string;
}

export interface CodeSegment {
  id: string;
  name: string;
  category: ConfigType;
  fileTarget: string;
  description: string;
  codeTemplate: string; // contains variables like {{MTU}}, {{ENDPOINT}}, etc.
  explanation: string;
  variables: ConfigVariable[];
}

export interface DiagnosticResult {
  passed: boolean;
  metric: string;
  value: string;
  recommendation: string;
}

export const PRESET_SEGMENTS: CodeSegment[] = [
  {
    id: "wg-keepalive",
    name: "WireGuard Tunnel Peer Keepalive",
    category: "wireguard",
    fileTarget: "/etc/wireguard/wg0.conf (Peer Section)",
    description: "Keeps NAT firewalls and routing tables active by sending regular, low-overhead handshake pings.",
    codeTemplate: `[Interface]
PrivateKey = {{CLIENT_PRIVATE_KEY}}
Address = {{CLIENT_TUNNEL_IP}}/24
DNS = {{DNS_SERVER}}
MTU = {{MTU_SIZE}}

[Peer]
PublicKey = {{SERVER_PUBLIC_KEY}}
Endpoint = {{SERVER_ENDPOINT_IP}}:{{SERVER_PORT}}
AllowedIPs = 0.0.0.0/0, ::/0
# CRITICAL: Keepalive handshake sent every X seconds (recommended 25)
PersistentKeepalive = {{KEEPALIVE_INTERVAL}}`,
    explanation: "Firewalls and NAT gateways drop idle routing states after a few minutes. Setting PersistentKeepalive ensures a tiny UDP packet is sent at specified intervals, maintaining active mappings so incoming traffic is never blocked.",
    variables: [
      { key: "CLIENT_PRIVATE_KEY", label: "Client Private Key", defaultValue: "aGF2ZV9hX3dvbmRlcmZ1bF9kYXlfMTIzNDU2Nzg5MA==", placeholder: "Base64 Key", description: "Your local client private key." },
      { key: "CLIENT_TUNNEL_IP", label: "Client Tunnel IP", defaultValue: "10.0.0.2", placeholder: "e.g., 10.0.0.2", description: "Internal IP of your client inside the WireGuard subnet." },
      { key: "DNS_SERVER", label: "DNS Server", defaultValue: "1.1.1.1", placeholder: "e.g., 1.1.1.1", description: "DNS server inside or outside the tunnel." },
      { key: "MTU_SIZE", label: "MTU Size", defaultValue: "1420", placeholder: "1280 to 1420", description: "1420 is optimum for IPv4 WG tunnels to prevent fragmentation overhead." },
      { key: "SERVER_PUBLIC_KEY", label: "Server Public Key", defaultValue: "c2VydmVyX3B1YmxpY19rZXlfY29uZmlnXzEyMzQ1Njc4OQ==", placeholder: "Base64 Key", description: "Your WireGuard server's public key." },
      { key: "SERVER_ENDPOINT_IP", label: "Server Endpoint IP/Host", defaultValue: "203.0.113.50", placeholder: "Domain or Public IP", description: "Public IP address or hostname of your WireGuard server." },
      { key: "SERVER_PORT", label: "Server Port", defaultValue: "51820", placeholder: "51820", description: "WireGuard UDP port." },
      { key: "KEEPALIVE_INTERVAL", label: "Keepalive Interval (seconds)", defaultValue: "25", placeholder: "e.g., 25", description: "Send handshake keepalive every X seconds (21-25 is optimal)." }
    ]
  },
  {
    id: "wg-watchdog-script",
    name: "WireGuard Auto-Recovery Watchdog",
    category: "watchdog",
    fileTarget: "/usr/local/bin/wg-watchdog.sh",
    description: "An automated bash watchdog that monitors interface ping states and re-initializes WireGuard on packet-loss detection.",
    codeTemplate: `#!/usr/bin/env bash
# WireGuard Tunnel Persistence Watchdog
# Runs via crontab every minute to prevent permanent tunnel collapse.

INTERFACE="{{WG_INTERFACE}}"
GATEWAY_IP="{{MONITOR_IP}}"
MAX_FAILURES={{MAX_ATTEMPTS}}
LOG_FILE="/var/log/wg-watchdog.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking connectivity on $INTERFACE to $GATEWAY_IP..."

# Try to ping the gateway through the specific interface
if ping -c 1 -W 3 -I "$INTERFACE" "$GATEWAY_IP" >/dev/null 2>&1; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WireGuard Tunnel OK"
    exit 0
fi

# Link might be stalled. Re-try up to MAX_FAILURES
fail_count=1
while [ $fail_count -lt $MAX_FAILURES ]; do
    sleep 2
    if ping -c 1 -W 3 -I "$INTERFACE" "$GATEWAY_IP" >/dev/null 2>&1; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Recovered on try $fail_count"
        exit 0
    fi
    fail_count=$((fail_count + 1))
done

# If we reach here, the tunnel is dead. Reload it.
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Connection lost on $INTERFACE after $MAX_FAILURES attempts. Restarting link..." >> "$LOG_FILE"

# Restarting using systemd or wg-quick
if command -v systemctl >/dev/null 2>&1; then
    systemctl restart "wg-quick@$INTERFACE" >> "$LOG_FILE" 2>&1
else
    wg-quick down "$INTERFACE" >> "$LOG_FILE" 2>&1
    sleep 2
    wg-quick up "$INTERFACE" >> "$LOG_FILE" 2>&1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Tunnel re-initialized." >> "$LOG_FILE"`,
    explanation: "Sometimes MTU blackholes, routing shifts, or peer endpoint rotations stall the tunnel even with KeepAlive. This script pings an internal endpoint (like the remote gateway or DNS), and if it detects packet loss, re-boots the interface to force DNS resolution and routing state refresh.",
    variables: [
      { key: "WG_INTERFACE", label: "WireGuard Interface Name", defaultValue: "wg0", placeholder: "wg0", description: "The local system name of your WireGuard interface." },
      { key: "MONITOR_IP", label: "Subnet Target IP to Ping", defaultValue: "10.0.0.1", placeholder: "e.g., 10.0.0.1", description: "The internal IP of the remote WireGuard server to test link health." },
      { key: "MAX_ATTEMPTS", label: "Max Ping Failures Before Restart", defaultValue: "3", placeholder: "3", description: "Number of consecutive failures before triggering interface restart." }
    ]
  },
  {
    id: "ssh-client-config",
    name: "SSH Persistent Connection Configuration",
    category: "ssh",
    fileTarget: "~/.ssh/config (Client Local)",
    description: "Enables low-level TCP keepalives and serveralive signals inside the SSH protocol layers.",
    codeTemplate: `Host {{HOST_ALIAS}}
    HostName {{REMOTE_IP_OR_HOST}}
    User {{SSH_USER}}
    Port {{SSH_PORT}}
    IdentityFile ~/.ssh/{{IDENTITY_FILE}}
    
    # TCP Keepalive & Server Monitoring settings
    TCPKeepAlive yes
    ServerAliveInterval {{ALIVE_INTERVAL}}
    ServerAliveCountMax {{ALIVE_COUNT_MAX}}
    
    # Multiplexing (optional, keeps master socket alive for speedy parallel connections)
    ControlMaster auto
    ControlPath ~/.ssh/sockets/%r@%h:%p
    ControlPersist 4h`,
    explanation: "Without configurations, a router or firewall drops idle TCP ports. ServerAliveInterval instructs the client to send null packets every X seconds. If ServerAliveCountMax sequential handshakes are unanswered, the client closes the dead socket immediately, letting auto-reconnect scripts trigger.",
    variables: [
      { key: "HOST_ALIAS", label: "Host Connection Name", defaultValue: "secure-node", placeholder: "e.g., production-server", description: "Convenient shorthand name for starting connections." },
      { key: "REMOTE_IP_OR_HOST", label: "Remote Host IP/Domain", defaultValue: "203.0.113.60", placeholder: "e.g., 192.168.1.10", description: "IP Address or SSH server domain." },
      { key: "SSH_USER", label: "SSH Username", defaultValue: "ubuntu", placeholder: "e.g., root", description: "Remote terminal user account." },
      { key: "SSH_PORT", label: "SSH Port", defaultValue: "22", placeholder: "22", description: "Server port where sshd daemon listens." },
      { key: "IDENTITY_FILE", label: "SSH Key Filename", defaultValue: "id_rsa", placeholder: "id_ed25519", description: "Name of the local private key stored in ~/.ssh/." },
      { key: "ALIVE_INTERVAL", label: "ServerAliveInterval (seconds)", defaultValue: "15", placeholder: "15", description: "Send keepalive packet every X seconds of inactivity." },
      { key: "ALIVE_COUNT_MAX", label: "ServerAliveCountMax (failures)", defaultValue: "3", placeholder: "3", description: "Number of lost keepalives before closing connection." }
    ]
  },
  {
    id: "ssh-autossh-service",
    name: "AutoSSH Highly Stable Tunnel Service",
    category: "ssh",
    fileTarget: "/etc/systemd/system/ssh-tunnel.service",
    description: "An ultra-robust, automatic SSH remote/local port forwarding link monitored continuously via systemd.",
    codeTemplate: `[Unit]
Description=AutoSSH Robust Persistent Tunnel
After=network.target network-online.target wg-quick@wg0.service
Wants=network-online.target

[Service]
Type=simple
Environment="AUTOSSH_GATETIME=0"
Environment="AUTOSSH_PORT=0"
User={{SYSTEM_USER}}
ExecStart=/usr/bin/autossh -M 0 -N -o "ServerAliveInterval={{ALIVE_INTERVAL}}" -o "ServerAliveCountMax={{ALIVE_COUNT_MAX}}" -o "ExitOnForwardFailure=yes" -i /home/{{SYSTEM_USER}}/.ssh/{{IDENTITY_FILE}} -L {{LOCAL_PORT}}:127.0.0.1:{{REMOTE_PORT}} {{SSH_USER}}@{{REMOTE_HOST}} -p {{SSH_PORT}}

Restart=always
RestartSec=5
TimeoutStartSec=10

[Install]
WantedBy=multi-user.target`,
    explanation: "This systemd script leverages the 'autossh' daemon. AUTOSSH_GATETIME=0 ensures that if the server is offline during initial boot, autossh does not exit, but continuously retries. Restart=always handles crashes or network dropouts instantly.",
    variables: [
      { key: "SYSTEM_USER", label: "Local Linux System User", defaultValue: "pi", placeholder: "e.g. pi", description: "The username running this local service daemon." },
      { key: "IDENTITY_FILE", label: "Identity Private Key Filename", defaultValue: "id_rsa", placeholder: "id_rsa", description: "Private SSH Key stored in ~/.ssh/." },
      { key: "LOCAL_PORT", label: "Local Bound Port (Forwarding)", defaultValue: "8080", placeholder: "8080", description: "The local port to bind and forward." },
      { key: "REMOTE_PORT", label: "Remote Bound Port", defaultValue: "8080", placeholder: "8080", description: "The port you wish to access on the remote server." },
      { key: "SSH_USER", label: "Remote SSH Username", defaultValue: "ubuntu", placeholder: "ubuntu", description: "Username on remote server." },
      { key: "REMOTE_HOST", label: "Remote Host IP/Host", defaultValue: "203.0.113.60", placeholder: "remote.host.com", description: "Target server address." },
      { key: "SSH_PORT", label: "Remote SSH Server Port", defaultValue: "22", placeholder: "22", description: "SSHD Listening port." },
      { key: "ALIVE_INTERVAL", label: "ServerAliveInterval", defaultValue: "15", placeholder: "15", description: "Seconds between client-side pings." },
      { key: "ALIVE_COUNT_MAX", label: "ServerAliveCountMax", defaultValue: "3", placeholder: "3", description: "Missed responses allowed before restarting." }
    ]
  },
  {
    id: "gateway-watchdog",
    name: "Multi-Gateway Internet Watchdog",
    category: "watchdog",
    fileTarget: "/usr/local/bin/internet-watchdog.sh",
    description: "A shell script that polls multiple public DNS/gateway IPs and automatically restarts interfaces or triggers routing lease renewals.",
    codeTemplate: `#!/usr/bin/env bash
# Dual-IP Internet Gateway Reconnect Daemon

DNS_A="1.1.1.1" # Cloudflare Public DNS
DNS_B="8.8.8.8" # Google Public DNS
INTERFACE="{{LOCAL_IFACE}}"

# Check connectivity
check_ping() {
    ping -c 1 -W 2 -I "$INTERFACE" "$1" >/dev/null 2>&1
}

if check_ping "$DNS_A" || check_ping "$DNS_B"; then
    echo "[$(date)] Network connectivity active."
    exit 0
fi

# If initial ping fails, wait 10s and retry to prevent false triggers
sleep 10
if check_ping "$DNS_A" || check_ping "$DNS_B"; then
    echo "[$(date)] Recovered naturally after delay."
    exit 0
fi

echo "[$(date)] WAN Disconnection detected on $INTERFACE. Initiating restoration protocols..." >> /var/log/internet-watchdog.log

# 1. Reset/Flush routing table cache
ip route flush cache >> /var/log/internet-watchdog.log 2>&1

# 2. Release & Renew DHCP lease
if command -v dhclient >/dev/null 2>&1; then
    dhclient -r "$INTERFACE" >> /var/log/internet-watchdog.log 2>&1
    sleep 2
    dhclient "$INTERFACE" >> /var/log/internet-watchdog.log 2>&1
elif command -v ip >/dev/null 2>&1; then
    ip link set "$INTERFACE" down
    sleep 2
    ip link set "$INTERFACE" up
fi

# 3. Check if we have recovered
sleep 5
if check_ping "$DNS_A"; then
    echo "[$(date)] RESTORED: Connectivity recovered successfully." >> /var/log/internet-watchdog.log
else
    echo "[$(date)] FAILURE: Still offline. Retrying next cycle." >> /var/log/internet-watchdog.log
fi`,
    explanation: "This watchdog monitors WAN connectivity. If public DNS points are entirely unreachable, it assumes the local DHCP state or router gateway path has stalled. It restarts the local hardware link or restarts DHCP negotiation to force router lease updates.",
    variables: [
      { key: "LOCAL_IFACE", label: "Local WAN Interface", defaultValue: "eth0", placeholder: "wlan0 or eth0", description: "The physical local interface connected to your router/modem." }
    ]
  },
  {
    id: "mtu-mss-calibration",
    name: "MTU / MSS Optimization Engine Script",
    category: "mtu",
    fileTarget: "Manual Calibration script",
    description: "Interactive helper script that determines the maximum non-fragmented packet size (MTU) across your specific ISP network routing pathways.",
    codeTemplate: `#!/usr/bin/env bash
# MTU Sweep/Calibration Utility
# Finds the maximum MTU value that can traverse your ISP network without fragmentation.

TARGET="{{SWEEP_HOST}}"
echo "=== Starting MTU Path Discovery to $TARGET ==="

# Base MTU sizes to test
# 1500 (Standard Ethernet), 1492 (PPPoE/DSL), 1420 (WireGuard over Standard), 1280 (IPv6 Minimum)
test_sizes=(1472 1464 1412 1392 1372 1360 1252)

for data_size in "\${test_sizes[@]}"; do
    # ping data_size + 28 bytes header = MTU size
    mtu=$((data_size + 28))
    echo -n "Testing MTU $mtu (payload: $data_size)... "
    
    # -M do specifies Don't Fragment flag (DF)
    # On macOS, use -D instead of -M do
    if [[ "$OSTYPE" == "darwin"* ]]; then
        ping -c 1 -D -s "$data_size" "$TARGET" >/dev/null 2>&1
    else
        ping -c 1 -M do -s "$data_size" "$TARGET" >/dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        echo "SUCCESS (No Fragmentation)"
        echo ""
        echo ">>> Optimal WireGuard MTU recommendations:"
        echo ">>> IPv4 MTU: $((mtu - 40)) bytes (Conservative: $((mtu - 60)) bytes)"
        echo ">>> IPv6 MTU: $((mtu - 60)) bytes (Conservative: $((mtu - 80)) bytes)"
        exit 0
    else
        echo "FAILED (Requires Fragmentation)"
    fi
done

echo "MTU Sweep complete. If all failed, fall back to minimum MTU = 1280 (safest choice)."`,
    explanation: "Encapsulating packets inside Wireguard (UDP) or SSH (TCP) adds byte headers. If the final packet exceeds your ISP's MTU (typically 1500 or 1492), it gets fragmented, causing massive latency or flat-out dropping. This calibration script tests MTUs with the 'Don't Fragment' bit active to find the true network ceiling.",
    variables: [
      { key: "SWEEP_HOST", label: "Remote Target to Test", defaultValue: "1.1.1.1", placeholder: "e.g., 1.1.1.1", description: "Public IP or remote server IP to run the ping sweep against." }
    ]
  },
  {
    id: "usb-tether-setup",
    name: "USB Tethering Setup & Routing",
    category: "usb",
    fileTarget: "/etc/network/interfaces.d/usb-tether (Linux)",
    description: "Configures automatic interface detection, routing table bindings, and DNS overrides for tethered USB networks (RNDIS / CDC_ETHER).",
    codeTemplate: `# USB Tethering Persistent Interface Config
# Prevents network drops when USB connection flaps or cellular rotates IP.

INTERFACE="{{USB_IFACE}}"
SUBNET="{{PHONE_SUBNET}}"
GATEWAY="{{PHONE_GATEWAY}}"

# 1. Force interface dhcp with lease timeouts
auto $INTERFACE
iface $INTERFACE inet dhcp
    # Aggressive DHCP request timeouts for fluid failovers
    backoff-time 2
    reboot 5
    retry 2
    select-timeout 3

# 2. Add route metric adjustments to prioritize or failover
# Metric > 100 deprioritizes below physical ethernet/Wi-Fi unless tunnel is active
up ip route add $SUBNET dev $INTERFACE proto kernel scope link src {{LOCAL_IP}} metric {{INTERFACE_METRIC}}
up ip route add default via $GATEWAY dev $INTERFACE metric {{INTERFACE_METRIC}}`,
    explanation: "USB tethering over Android (RNDIS) or iPhone (Apple USBMux/CDC) often resets DHCP leases and rotates local subnets (usually 192.168.42.x or 172.20.10.x). This template forces system interfaces to automatically re-bind the lease and configures route metrics, ensuring stable tunnel overlays without causing local gateway collision.",
    variables: [
      { key: "USB_IFACE", label: "USB Interface Name", defaultValue: "usb0", placeholder: "usb0 or enp0s20u2", description: "The physical system name of the USB network interface." },
      { key: "PHONE_SUBNET", label: "Tether Subnet Range", defaultValue: "192.168.42.0/24", placeholder: "e.g., 192.168.42.0/24", description: "The subnet assigned by your device (usually 192.168.42.0/24 for Android)." },
      { key: "PHONE_GATEWAY", label: "Tether Gateway IP", defaultValue: "192.168.42.129", placeholder: "e.g., 192.168.42.129", description: "The router/phone IP within the tethering subnet." },
      { key: "LOCAL_IP", label: "Desired Client IP", defaultValue: "192.168.42.50", placeholder: "e.g., 192.168.42.50", description: "IP of your laptop in the tether subnet." },
      { key: "INTERFACE_METRIC", label: "Routing Route Metric", defaultValue: "150", placeholder: "150", description: "Higher metrics lower priority, letting tunnels route over it smoothly." }
    ]
  },
  {
    id: "usb-udev-rule",
    name: "Auto-Hotplug USB Network Rule",
    category: "usb",
    fileTarget: "/etc/udev/rules.d/99-usb-tether.rules",
    description: "A udev rule to automatically trigger network initialization scripts the micro-second a RNDIS or CDC_ETHER USB cable is plugged in.",
    codeTemplate: `# Auto-initialize tethered network interfaces on hotplug
# Matches standard Android (RNDIS) and Apple (USBMux) USB network class drivers
SUBSYSTEM=="net", ACTION=="add", DRIVERS=="rndis_host|cdc_ether|cdc_ncm", NAME="{{IFACE_TARGET_NAME}}", RUN+="/usr/local/bin/usb-tether-hotplug.sh %k"`,
    explanation: "Under standard Linux distributions, tethering over USB requires manual activation from the phone. This udev rule detects the hotplug event of compatible rndis_host, cdc_ether, or cdc_ncm drivers and runs a trigger script to bind the DHCP daemon immediately, avoiding manual terminal configurations.",
    variables: [
      { key: "IFACE_TARGET_NAME", label: "Force Interface Name", defaultValue: "usb0", placeholder: "usb0", description: "The system name to assign to any matched USB network device." }
    ]
  },
  {
    id: "ollama-mesh-binding",
    name: "Ollama Mesh API Service Override",
    category: "ssh",
    fileTarget: "/etc/systemd/system/ollama.service.d/override.conf",
    description: "Forces Ollama to bind to custom Tailscale or local network interfaces, exposing its endpoint for remote brain orchestration.",
    codeTemplate: `[Service]
# Configures Ollama to bind to your specific Tailscale or mesh IP (Default: {{OLLAMA_BIND_IP}})
Environment="OLLAMA_HOST={{OLLAMA_BIND_IP}}:{{OLLAMA_BIND_PORT}}"`,
    explanation: "By default, Ollama only listens to local loopback (127.0.0.1). Creating a systemd override binds it to your Tailscale mesh IP (e.g. 100.96.247.22) or all interfaces (0.0.0.0) so the Galaxy Tab S9 remote controller can access LLM models securely.",
    variables: [
      { key: "OLLAMA_BIND_IP", label: "Ollama Binding IP / Host", defaultValue: "100.96.247.22", placeholder: "100.x.x.x or 0.0.0.0", description: "The specific local IP or Tailscale IP to listen on." },
      { key: "OLLAMA_BIND_PORT", label: "Ollama Port", defaultValue: "11434", placeholder: "11434", description: "Ollama API server listening port." }
    ]
  },
  {
    id: "termux-dragon-home",
    name: "Termux Remote Brain Auto-Tunnel (dragon_home)",
    category: "ssh",
    fileTarget: "~/.ssh/dragon_home (Termux Client)",
    description: "Termux shell script allowing the Galaxy Tab S9 to securely tunnel Pieces OS ports (5323 / 39300) and forward SSH agent identities with a simple code word.",
    codeTemplate: `#!/data/data/com.termux/files/usr/bin/bash
# Auto-tunnel to main Ubuntu Hub with secure port forwarding
# Forwards local Pieces OS client-side ports to the central engine
echo "Connecting to Dragon Home ({{HUBNAME}})..."

# Forwarding Pieces Local API ports (5323 & 39300) over secure Tailscale tunnel
ssh -A -L 5323:127.0.0.1:5323 -L 39300:127.0.0.1:39300 {{HUB_USER}}@{{HUB_TAILSCALE_IP}}`,
    explanation: "This script should be saved in $PREFIX/bin/dragon_home on Termux and made executable. It handles port forwarding for Pieces OS and forwards SSH keys from ssh-agent, enabling passwordless authentication.",
    variables: [
      { key: "HUBNAME", label: "Hub Shorthand Name", defaultValue: "Dragon Home", placeholder: "Dragon Home", description: "Simple label for connection output." },
      { key: "HUB_USER", label: "Remote SSH Username", defaultValue: "dragon-succubi", placeholder: "dragon-succubi", description: "User account on your Ubuntu hub laptop." },
      { key: "HUB_TAILSCALE_IP", label: "Hub Tailscale IP", defaultValue: "100.96.247.22", placeholder: "100.x.x.x", description: "Tailscale IP of your Ubuntu hub laptop." }
    ]
  },
  {
    id: "ubuntu-aspm-stability",
    name: "HP/Realtek PCIe ASPM Stability GRUB Fix",
    category: "watchdog",
    fileTarget: "/etc/default/grub (Kernel Parameters)",
    description: "Stops kernel panic reboot loops on HP laptops running Realtek Wi-Fi/Bluetooth cards (rtw89_core / RTL8852BE) by turning off Active State Power Management.",
    codeTemplate: `# Add 'pcie_aspm=off' to prevent Realtek rtw89_core PCIe low-power state lockups
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash pcie_aspm=off"

# To apply:
# 1. Edit /etc/default/grub
# 2. Run: sudo update-grub
# 3. Reboot your Ubuntu Hub machine`,
    explanation: "HP laptops running Realtek chips often trigger a hardware PCIe lockup and ACPI reboot watchdog trip when the system transitions the network card to low power. Passing pcie_aspm=off in GRUB disables state transitions, curing random shutdowns.",
    variables: []
  },
  {
    id: "systemd-openssh-lockin",
    name: "Systemd OpenSSH Service Activation Lock-In",
    category: "ssh",
    fileTarget: "/usr/local/bin/ssh-activation-lock.sh",
    description: "Disables the problematic systemd ssh.socket listener and forces a dedicated, persistent ssh.service daemon to prevent immediate connection-closed errors.",
    codeTemplate: `#!/usr/bin/env bash
# Fixes 'Instant Closed' connection drops caused by systemd socket activation failures

echo "Stopping and disabling ssh.socket..."
sudo systemctl stop ssh.socket
sudo systemctl disable ssh.socket

echo "Enabling and starting persistent ssh.service..."
sudo systemctl enable ssh.service
sudo systemctl start ssh.service

# Ensure Tailscale built-in SSH bouncer doesn't intercept
echo "Disabling Tailscale interceptor bouncer..."
sudo tailscale set --ssh=false

echo "Checking SSH daemon status:"
sudo systemctl status ssh | grep "Active:"`,
    explanation: "Ubuntu Desktop uses systemd socket activation (ssh.socket) by default, which frequently drops connection handshakes under containerized or Snap sandboxes. Disabling the socket and enforcing a persistent daemon, while shutting down Tailscale SSH interception, restores standard SSH reliability.",
    variables: []
  },
  {
    id: "cloudflare-warp-zerotrust",
    name: "Cloudflare 1.1.1.1 & Zero Trust Gateway Secure DNS Tunnel",
    category: "wireguard",
    fileTarget: "/etc/cloudflare-warp/warp.conf",
    description: "Configures secure Cloudflare DNS-over-HTTPS (DoH) or enrolls the device into a custom Cloudflare Zero Trust Gateway account for network-wide security, routing, and malware block policies.",
    codeTemplate: `# Cloudflare WARP Client & Zero Trust Integration Blueprint
# Secures all DNS queries over HTTPS and enforces Gateway policies

[Client]
# Enrolls device into Cloudflare Teams / Zero Trust organization account
Organization = "{{CLOUDFLARE_TEAMS_ORG}}"

# Enforce DNS-over-HTTPS (DoH) protocol for lookup safety
DNSOverHTTPS = "enabled"
DoHEndpoint = "https://{{CLOUDFLARE_TEAMS_ORG}}.cloudflare-gateway.com/dns-query"

# Cryptographic fallback nameservers (Malware-filtering 1.1.1.3 / 1.0.0.3)
PrimaryResolver = "{{PRIMARY_DNS}}"
SecondaryResolver = "{{SECONDARY_DNS}}"

# Virtual Interface specifications
TunnelMode = "warp_routing"
MTU = "{{MTU_SIZE}}"
LocalBypassSubnets = "10.0.0.0/8, 192.168.0.0/16, 100.64.0.0/10"`,
    explanation: "By routing nameserver queries via HTTPS over the Cloudflare edge network, DNS poisoning and snooping are completely mitigated. Enrolling your Zero Trust Gateway account gives you complete malware logging, content control, and a secure corporate-grade overlay network.",
    variables: [
      { key: "CLOUDFLARE_TEAMS_ORG", label: "Cloudflare Teams Org ID", defaultValue: "dragon-security-hub", placeholder: "e.g., dragon-security-hub", description: "Your Cloudflare Zero Trust team subdomain name." },
      { key: "PRIMARY_DNS", label: "Primary secure DNS IP", defaultValue: "1.1.1.3", placeholder: "e.g., 1.1.1.3", description: "Primary nameserver. Use 1.1.1.3 for Malware and Adult block, or 1.1.1.1 for standard." },
      { key: "SECONDARY_DNS", label: "Secondary secure DNS IP", defaultValue: "1.0.0.3", placeholder: "e.g., 1.0.0.3", description: "Secondary nameserver. Use 1.0.0.3 for Malware and Adult block, or 1.0.0.1 for standard." },
      { key: "MTU_SIZE", label: "Secure WARP MTU Size", defaultValue: "1280", placeholder: "e.g., 1280", description: "MTU threshold. 1280-1360 is recommended to avoid UDP fragmentation over WAN carrier links." }
    ]
  },
  {
    id: "wg-network-security",
    name: "WireGuard Network Security & Hardened DNS Profile",
    category: "wireguard",
    fileTarget: "/etc/wireguard/wg0.conf (Interface Section)",
    description: "Configures WireGuard interface with hardened DNS routing (using Cloudflare 1.1.1.1 or 1.1.1.3) to safeguard traffic from DNS spoofing and malware.",
    codeTemplate: `[Interface]
PrivateKey = {{CLIENT_PRIVATE_KEY}}
Address = {{CLIENT_TUNNEL_IP}}/24
MTU = {{MTU_SIZE}}

# Cryptographically Secure DNS Endpoint (1.1.1.1 or 1.1.1.3)
DNS = {{HARDENED_DNS}}

[Peer]
PublicKey = {{SERVER_PUBLIC_KEY}}
Endpoint = {{SERVER_ENDPOINT_IP}}:{{SERVER_PORT}}
AllowedIPs = {{ALLOWED_IPS}}`,
    explanation: "Securing the nameserver queries is critical when tunneling traffic. Setting your WireGuard client's DNS to 1.1.1.1 provides standard ultra-fast lookup privacy, while 1.1.1.3 (Cloudflare for Families) dynamically filters malware, botnets, and adult content at the resolver level before a single packet is routed.",
    variables: [
      { key: "CLIENT_PRIVATE_KEY", label: "Client Private Key", defaultValue: "aGF2ZV9hX3dvbmRlcmZ1bF9kYXlfMTIzNDU2Nzg5MA==", placeholder: "Base64 Key", description: "Your local client private key." },
      { key: "CLIENT_TUNNEL_IP", label: "Client Tunnel IP", defaultValue: "10.0.0.2", placeholder: "e.g., 10.0.0.2", description: "Internal IP of your client inside the WireGuard subnet." },
      { key: "MTU_SIZE", label: "MTU Size", defaultValue: "1420", placeholder: "1280 to 1420", description: "Maximum transmission unit to prevent fragmentation overhead." },
      { key: "HARDENED_DNS", label: "Hardened DNS Resolver", defaultValue: "1.1.1.3", placeholder: "1.1.1.1 or 1.1.1.3", description: "Cloudflare Secure Resolver. Use 1.1.1.1 for pure privacy/speed, or 1.1.1.3 for malware domain filtering." },
      { key: "SERVER_PUBLIC_KEY", label: "Server Public Key", defaultValue: "c2VydmVyX3B1YmxpY19rZXlfY29uZmlnXzEyMzQ1Njc4OQ==", placeholder: "Base64 Key", description: "Your remote WireGuard server's public key." },
      { key: "SERVER_ENDPOINT_IP", label: "Server Endpoint IP/Host", defaultValue: "203.0.113.50", placeholder: "Domain or Public IP", description: "Public IP address or hostname of your WireGuard server." },
      { key: "SERVER_PORT", label: "Server Port", defaultValue: "51820", placeholder: "51820", description: "WireGuard UDP port." },
      { key: "ALLOWED_IPS", label: "Allowed IPs (Routing)", defaultValue: "0.0.0.0/0", placeholder: "0.0.0.0/0", description: "IPs to route through the secure tunnel. Use 0.0.0.0/0 for full tunnel routing." }
    ]
  },
  {
    id: "cloudflare-tunnel-infra",
    name: "Cloudflare Secure Tunnel Infrastructure (cloudflared)",
    category: "cloudflare",
    fileTarget: "/etc/cloudflared/config.yml",
    description: "Establishes an outbound secure tunnel to Cloudflare Edge. Perfect for exposing local hosts privately.",
    codeTemplate: `tunnel: {{TUNNEL_ID}}
credentials-file: {{CREDENTIALS_FILE}}

# Egress routing mapping for OmniNetwork_Optimizer system nodes
ingress:
  - hostname: {{HOSTNAME}}
    service: http://localhost:{{LOCAL_PORT}}
  - service: http_status:404`,
    explanation: "Cloudflare Tunnel (cloudflared) provides a direct, secure path between your local server and Cloudflare Edge. Because it is egress-only, you do not need to open inbound firewall ports or maintain static public IP addresses. Credentials are key-authorized.",
    variables: [
      { key: "TUNNEL_ID", label: "Tunnel ID (UUID)", defaultValue: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d", placeholder: "e.g., UUID format", description: "The unique identifier of your registered cloudflared tunnel." },
      { key: "CREDENTIALS_FILE", label: "Credentials File Path", defaultValue: "/etc/cloudflared/1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d.json", placeholder: "e.g., path to file.json", description: "Absolute path to the JSON key file representing your cloudflared tunnel credentials." },
      { key: "HOSTNAME", label: "Public Routing Hostname", defaultValue: "tunnel.dragonshaw82.me", placeholder: "e.g., host.domain.com", description: "The DNS record registered and managed under your Cloudflare account to route to this endpoint." },
      { key: "LOCAL_PORT", label: "Proxy Target Local Port", defaultValue: "3000", placeholder: "e.g., 3000 or 8080", description: "The local port of the daemon running on your host (e.g., Node server or internal proxy)." }
    ]
  }
];
