import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle,
  Activity,
  Zap,
  TrendingUp,
  Smartphone,
  Laptop,
  Download,
  Upload,
  RefreshCw,
  Cpu,
  FileText,
  Radio,
  Server,
  Network,
  Share2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User } from "firebase/auth";

interface NetworkOverviewDashboardProps {
  simulationActive: boolean;
  natTimeoutOccurred: boolean;
  selectedCategory: string;
  variableValues: Record<string, string>;
  simConfig?: { keepalive: number; interval: number; timeout: number };
}

export function NetworkOverviewDashboard({
  simulationActive,
  natTimeoutOccurred,
  selectedCategory,
  variableValues,
  simConfig = { keepalive: 25, interval: 3, timeout: 30 }
}: NetworkOverviewDashboardProps) {
  // Live simulated metrics for traffic volume
  const [totalTrafficBytes, setTotalTrafficBytes] = useState<number>(314159265); // ~314 MB start
  const [currentSpeedKbps, setCurrentSpeedKbps] = useState<number>(4500);

  useEffect(() => {
    let intervalId: any;
    if (simulationActive && !natTimeoutOccurred) {
      intervalId = setInterval(() => {
        const randSpeed = Math.floor(Math.random() * 8000) + 1200; // 1.2 to 9.2 Mbps
        setCurrentSpeedKbps(randSpeed);
        setTotalTrafficBytes((prev) => prev + Math.floor((randSpeed * 1024) / 8)); // Add bytes
      }, 1000);
    } else if (natTimeoutOccurred) {
      setCurrentSpeedKbps(0);
    } else {
      // Nominal idle traffic
      intervalId = setInterval(() => {
        const idleSpeed = Math.floor(Math.random() * 120) + 15; // 15 to 135 Kbps
        setCurrentSpeedKbps(idleSpeed);
        setTotalTrafficBytes((prev) => prev + Math.floor((idleSpeed * 1024) / 8));
      }, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [simulationActive, natTimeoutOccurred]);

  // Compute stats
  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const getHealthScore = () => {
    if (natTimeoutOccurred) return 42;
    if (!simulationActive) return 92;
    // active and optimized
    const keepalive = Number(variableValues["KEEPALIVE_INTERVAL"] || simConfig.keepalive);
    if (keepalive > 0 && keepalive <= 25) {
      return 100;
    } else if (keepalive > 25 && keepalive <= 60) {
      return 85;
    } else {
      return 68; // no keepalive or excessive
    }
  };

  const healthScore = getHealthScore();
  const activeTunnelsCount = natTimeoutOccurred ? 0 : simulationActive ? 3 : 1;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 border-b border-white/10 shrink-0">
      
      {/* Metric 1: Tunnel Status & Topology Map Overview */}
      <div className="bg-[#0a0a0a] p-5 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl"></div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider font-mono flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Network className="h-3 w-3 text-blue-500" /> Active Tunnels
            </span>
            <span className="text-[9px] px-1 bg-blue-500/10 text-blue-400 font-mono rounded">
              Topology: Multi-Path
            </span>
          </span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-extralight text-white font-mono">
              {activeTunnelsCount}
            </span>
            <span className="text-xs text-gray-500 font-mono">/ 4 Active</span>
          </div>
        </div>

        <div className="mt-3.5 space-y-2">
          {/* Active list visual indicator */}
          <div className="flex gap-1.5 overflow-x-auto py-0.5">
            <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
              natTimeoutOccurred 
                ? "bg-red-500/10 text-red-400 border-red-500/20" 
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}>
              {selectedCategory === "wireguard" ? "WireGuard: RUNNING" : "WireGuard: IDLE"}
            </span>
            <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${
              natTimeoutOccurred
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
            }`}>
              SSH Tunnel: ENCRYPTED
            </span>
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border bg-black/40 text-gray-500 border-white/5">
              Watchdog: ARMED
            </span>
          </div>
          <div className="text-[8.5px] font-mono text-gray-500 flex items-center justify-between">
            <span>Primary Gateway:</span>
            <span className="text-gray-300 font-bold">{variableValues["TUNNEL_IP"] || "10.0.0.2"}</span>
          </div>
        </div>
      </div>

      {/* Metric 2: Live Traffic Volume Monitor */}
      <div className="bg-[#0a0a0a] p-5 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl"></div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider font-mono flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-purple-500" /> Live Data Exchanged
            </span>
            <span className="text-[9px] text-purple-400 font-mono animate-pulse">
              {currentSpeedKbps > 1000 ? `${(currentSpeedKbps/1000).toFixed(1)} Mbps` : `${currentSpeedKbps} Kbps`}
            </span>
          </span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-extralight text-white font-mono tracking-tight">
              {formatBytes(totalTrafficBytes)}
            </span>
            <span className="text-[9px] text-gray-500 font-mono">TX/RX Sum</span>
          </div>
        </div>

        <div className="h-1 w-full bg-gray-900 rounded-full mt-3.5 overflow-hidden relative">
          <div 
            className="h-full bg-purple-500 transition-all duration-1000"
            style={{ width: `${Math.min(100, (currentSpeedKbps / 8000) * 100)}%` }}
          ></div>
        </div>
        <div className="text-[8.5px] font-mono text-gray-500 flex items-center justify-between mt-2.5">
          <span>Buffer Optimization:</span>
          <span className="text-purple-300 font-bold">Ring Buffers Activated</span>
        </div>
      </div>

      {/* Metric 3: Optimization & Health Score */}
      <div className="bg-[#0a0a0a] p-5 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl"></div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider font-mono flex items-center gap-1.5">
            <ShieldCheck className={`h-3 w-3 ${natTimeoutOccurred ? "text-red-500" : "text-emerald-500"}`} /> 
            Network Health Score
          </span>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className={`text-3xl font-mono ${natTimeoutOccurred ? "text-red-500" : "text-emerald-400"}`}>
              {healthScore}%
            </span>
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
              {natTimeoutOccurred ? "CRITICAL" : "OPTIMIZED"}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 mt-3.5">
          <div className="h-1 w-full bg-gray-900 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${
                natTimeoutOccurred ? "bg-red-500" : "bg-emerald-400"
              }`}
              style={{ width: `${healthScore}%` }}
            ></div>
          </div>
          <div className="text-[8.5px] font-mono text-gray-500 flex items-center justify-between pt-1">
            <span>Keepalive Frequency:</span>
            <span className={`${natTimeoutOccurred ? "text-red-400 font-bold" : "text-gray-300"}`}>
              {simConfig.keepalive <= 0 
                ? "Handshakes Disabled!" 
                : `${simConfig.keepalive}s Interval`}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}

// Interfaces for our custom Heartbeat Monitor Home Screen Widget (Mobile & Desktop modes)
interface HeartbeatWidgetProps {
  simulationActive: boolean;
  natTimeoutOccurred: boolean;
  selectedCategory: string;
}

export function HeartbeatWidget({
  simulationActive,
  natTimeoutOccurred,
  selectedCategory
}: HeartbeatWidgetProps) {
  const [widgetPlatform, setWidgetPlatform] = useState<"android" | "macos" | "linux" | "desktop">("android");
  const [pulseBeats, setPulseBeats] = useState<number[]>(Array(15).fill(40));

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseBeats((prev) => {
        const next = [...prev.slice(1)];
        if (natTimeoutOccurred) {
          next.push(20 + Math.random() * 8); // Flatline/stalled low activity
        } else {
          // Dynamic heartbeat pattern
          const base = simulationActive ? 75 : 45;
          const noise = Math.sin(Date.now() / 600) * 15 + Math.random() * 10;
          next.push(base + noise);
        }
        return next;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [simulationActive, natTimeoutOccurred]);

  const latestVal = Math.round(pulseBeats[pulseBeats.length - 1]);

  return (
    <div className="bg-[#0b0b0b] border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 relative overflow-hidden">
      {/* Background glow depending on status */}
      <div className={`absolute top-0 right-0 w-36 h-36 rounded-full blur-3xl opacity-10 ${
        natTimeoutOccurred ? "bg-red-500" : "bg-emerald-400"
      }`} />

      {/* Header and Platform Selector */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex flex-col">
          <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
            Port-Forward Heartbeat Widget
          </h3>
          <span className="text-[8.5px] text-gray-500 font-mono uppercase mt-0.5">Condensed Home Screen View</span>
        </div>

        {/* Platform selection pills */}
        <div className="flex bg-black/60 p-0.5 rounded-lg border border-white/5">
          {(["android", "macos", "linux", "desktop"] as const).map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => setWidgetPlatform(platform)}
              className={`px-2 py-1 rounded text-[8px] font-mono font-bold uppercase transition cursor-pointer ${
                widgetPlatform === platform
                  ? "bg-emerald-500 text-black shadow-sm"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {platform}
            </button>
          ))}
        </div>
      </div>

      {/* Widget Container View - Simulating specific platform UI frames */}
      <div className="flex flex-col items-center justify-center p-3 py-4 bg-black/40 rounded-xl border border-white/5 relative min-h-[160px]">
        
        {/* Android 2x2 Widget Mock */}
        {widgetPlatform === "android" && (
          <div className="w-full max-w-[200px] bg-[#141414] border border-[#262626] rounded-3xl p-4 flex flex-col justify-between aspect-square text-left shadow-lg ring-4 ring-black/40 relative">
            <div className="flex items-center justify-between">
              <span className="text-[9px] bg-black/40 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono uppercase">
                2x2 Widget
              </span>
              <Smartphone className="h-3.5 w-3.5 text-gray-500" />
            </div>
            
            <div className="space-y-1 my-3">
              <span className="text-[10px] text-gray-500 font-mono uppercase block leading-none">Tunnel Beat</span>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-mono font-bold ${natTimeoutOccurred ? "text-red-500" : "text-emerald-400"}`}>
                  {natTimeoutOccurred ? "Flat" : `${latestVal}ms`}
                </span>
                <span className="text-[8px] text-gray-500 font-mono">RTT</span>
              </div>
            </div>

            <div className="h-8 flex items-end gap-0.5 w-full bg-black/20 p-1.5 rounded">
              {pulseBeats.slice(-8).map((beat, idx) => (
                <div
                  key={idx}
                  className={`w-full transition-all duration-300 rounded-t ${
                    natTimeoutOccurred ? "bg-red-500/50" : "bg-emerald-400"
                  }`}
                  style={{ height: `${Math.min(100, (beat / 150) * 100)}%` }}
                />
              ))}
            </div>
            
            <div className="absolute bottom-2 right-4 text-[7px] text-gray-600 font-mono uppercase">
              Android OS
            </div>
          </div>
        )}

        {/* macOS Dashboard Widget Mock */}
        {widgetPlatform === "macos" && (
          <div className="w-full max-w-[240px] bg-[#181818]/90 backdrop-blur border border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-xl ring-1 ring-white/5">
            <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <div className="w-2 h-2 rounded-full bg-green-500" />
              </div>
              <span className="text-[8px] text-gray-400 font-mono uppercase tracking-wider">macOS Notification Center</span>
            </div>

            <div className="grid grid-cols-2 gap-4 my-2.5">
              <div className="flex flex-col justify-center">
                <span className="text-[8px] text-gray-500 font-mono uppercase">Gateway Heartbeat</span>
                <span className={`text-xl font-mono font-extralight ${natTimeoutOccurred ? "text-red-400" : "text-emerald-400"}`}>
                  {natTimeoutOccurred ? "STALLED" : "ACTIVE"}
                </span>
              </div>
              <div className="flex flex-col justify-center text-right">
                <span className="text-[8px] text-gray-500 font-mono uppercase">Loss Rate</span>
                <span className="text-xl font-mono text-white">
                  {natTimeoutOccurred ? "98%" : "0.01%"}
                </span>
              </div>
            </div>

            <div className="h-6 flex items-center justify-between px-1 bg-black/30 rounded border border-white/5">
              <span className="text-[8px] text-gray-500 font-mono">Pinging 1.1.1.1</span>
              <span className="text-[8px] text-emerald-400 font-mono">✓ Online</span>
            </div>
          </div>
        )}

        {/* Linux Custom Systray Widget Mock */}
        {widgetPlatform === "linux" && (
          <div className="w-full max-w-[280px] bg-[#0c0d12] border border-[#2b2b3a] rounded p-3 font-mono text-xs text-[#00ff66] shadow-md relative">
            <div className="flex items-center justify-between border-b border-[#2b2b3a] pb-1.5 mb-2">
              <span className="text-[8px] uppercase tracking-wider text-gray-400">i3/Waybar Custom Widget Indicator</span>
              <span className="text-[8px] text-gray-500">v0.9.1</span>
            </div>
            <div className="space-y-1.5 text-[10px]">
              <div className="flex justify-between">
                <span>[system.tunnels.wireguard]</span>
                <span className={natTimeoutOccurred ? "text-red-500" : "text-green-400"}>
                  {natTimeoutOccurred ? "CRITICAL" : "OK"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>[gateway.rtt_average]</span>
                <span className="text-white">{natTimeoutOccurred ? "ERR_TIMEOUT" : `${latestVal} ms`}</span>
              </div>
              <div className="flex justify-between">
                <span>[nat.inactivity_secs]</span>
                <span className="text-yellow-400">30s limit</span>
              </div>
            </div>
            <div className="mt-2.5 pt-1.5 border-t border-[#2b2b3a] text-[8px] text-gray-500 text-center uppercase">
              Configured via i3 blocks & bar daemons
            </div>
          </div>
        )}

        {/* Desktop Advanced HUD Widget */}
        {widgetPlatform === "desktop" && (
          <div className="w-full space-y-3 p-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Laptop className="h-4 w-4 text-blue-400" />
                <span className="text-[10px] text-gray-300 font-mono uppercase font-bold">Advanced Desktop Dashboard HUD</span>
              </div>
              <span className="text-[8px] px-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded font-mono font-bold uppercase tracking-widest">
                Raw Telemetry
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-left font-mono">
              <div className="bg-black/50 p-2.5 rounded border border-white/5 space-y-1">
                <span className="text-[8px] text-gray-500 uppercase block">Active MTU</span>
                <span className="text-xs text-white font-bold">1420 Octets</span>
              </div>
              <div className="bg-black/50 p-2.5 rounded border border-white/5 space-y-1">
                <span className="text-[8px] text-gray-500 uppercase block">Keepalive Sent</span>
                <span className="text-xs text-white font-bold">2,104 Handshakes</span>
              </div>
            </div>

            {/* Simulated terminal logging output */}
            <div className="p-2 bg-black text-[#00ff66] rounded font-mono text-[8px] h-12 overflow-y-auto border border-white/5 space-y-0.5 leading-none text-left">
              <div>[SYSTEM] Listening on interfaces: wg0, enp3s0</div>
              <div>[PING] RTT baseline to 1.1.1.1 average: {latestVal}ms</div>
              {natTimeoutOccurred && <div className="text-red-500 font-bold animate-pulse">[ERR_FAIL] ISP Dropped mapping session!</div>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Full-Featured Migration & Clone Asset Portal Component
// Prepares and formats all stored configurations, notes, and keys for direct integration with the next app!
interface MigrationPortalProps {
  user: User | null;
  variableValues: Record<string, string>;
}

export function MigrationPortal({
  user,
  variableValues
}: MigrationPortalProps) {
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Core metadata configurations to migrate seamlessly
  const getMigrationPayload = () => {
    return {
      appName: "OmniNetwork_Optimizer Workspace",
      migratedAt: new Date().toISOString(),
      ownerEmail: user?.email || "DragonShaw82@gmail.com",
      environment: {
        firebaseProjectId: "gen-lang-client-0391676042",
        region: "us-west1",
        authenticationProvider: "Google OAuth"
      },
      systemConfigurations: {
        ...variableValues,
        HARDENED_DNS_PREFERRED: variableValues["HARDENED_DNS"] || "1.1.1.1",
        TUNNEL_IP: variableValues["TUNNEL_IP"] || "10.0.0.2",
        DNS_SERVER: variableValues["DNS_SERVER"] || "1.1.1.1"
      },
      assetManifest: [
        { path: "/src/components/NetworkDashboardExpansion.tsx", type: "Core Component Expansion", scope: "Network Overview & Heartbeat Widgets" },
        { path: "/src/components/KeepNotesWorkspace.tsx", type: "Google Keep Sync & Runbook Editor", scope: "Notes database and Drive Backup integrations" },
        { path: "/src/components/ContactsAlertsWorkspace.tsx", type: "Gmail & Contacts monitoring", scope: "Emergency dispatch and contact rules" }
      ],
      cloudDurableSchema: {
        notesCollection: {
          schema: "id (string), title (string), content (text), isLocked (boolean), tags (array), category (string), userId (string), updatedAt (timestamp)"
        },
        alertsCollection: {
          schema: "id (string), displayName (string), email (string), phoneNumber (string), isAlertEnabled (boolean), assignedTunnels (array), department (string)"
        }
      }
    };
  };

  const handleCopyManifest = () => {
    const payload = JSON.stringify(getMigrationPayload(), null, 2);
    navigator.clipboard.writeText(payload);
    setCopiedManifest(true);
    setTimeout(() => setCopiedManifest(false), 3000);
  };

  const handleDownloadPayload = () => {
    setDownloading(true);
    const payload = JSON.stringify(getMigrationPayload(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `omninetwork_optimizer_migration_clone_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setTimeout(() => setDownloading(false), 1500);
  };

  return (
    <div className="bg-[#0b0b0b] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4 font-mono text-xs relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />

      {/* Title */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex flex-col">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Share2 className="h-4 w-4 text-blue-400" />
            Clone & Migration Data Portal
          </h3>
          <span className="text-[8.5px] text-gray-500 uppercase mt-0.5">Prepare Assets For Next-Gen Workspace</span>
        </div>
        <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20 uppercase tracking-wider">
          Isolated Scope
        </span>
      </div>

      <p className="text-[10px] text-gray-400 leading-relaxed">
        To prevent cross-pollinating or contaminating the foundational mother app core, all system configurations, database schema metadata, and assets are packaged here. Download the migration package to boot your next app instantly!
      </p>

      {/* Blueprint metadata preview */}
      <div className="p-3 bg-black/40 border border-white/5 rounded-lg space-y-2">
        <div className="flex items-center justify-between text-[10px] text-gray-400 border-b border-white/5 pb-1">
          <span>Migration Manifest Profile</span>
          <span className="text-gray-500">JSON</span>
        </div>
        <div className="space-y-1 text-[9px] text-gray-500 leading-normal">
          <div className="flex justify-between">
            <span>Authentication:</span>
            <span className="text-emerald-400">Google Workspace Ready</span>
          </div>
          <div className="flex justify-between">
            <span>Primary DNS:</span>
            <span className="text-blue-400">1.1.1.1 (Cloudflare Hardened)</span>
          </div>
          <div className="flex justify-between">
            <span>Assets Cataloged:</span>
            <span className="text-purple-400">3 Isolated Modules</span>
          </div>
        </div>
      </div>

      {/* Export operations */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleCopyManifest}
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-black hover:bg-[#151515] border border-white/10 text-gray-300 rounded font-bold uppercase transition cursor-pointer"
        >
          {copiedManifest ? "✓ Copied Manifest" : "Copy Blueprint"}
        </button>
        <button
          type="button"
          onClick={handleDownloadPayload}
          disabled={downloading}
          className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-500 hover:bg-blue-400 text-black font-bold uppercase rounded transition cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          {downloading ? "Packaging..." : "Export Clone JSON"}
        </button>
      </div>

    </div>
  );
}
