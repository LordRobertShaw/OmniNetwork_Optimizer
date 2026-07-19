# OmniNetwork_Optimizer - Migration & Isolation Blueprint

This document specifies the precise isolation architecture implemented to keep the foundational **Mother App Core** pure, while preparing all assets, structures, and schemas for seamless migration and integration with your next expanded app.

---

## 1. Compartmentalization & Isolation Strategy

To prevent contamination or cross-pollination of the mother app's core routing/optimization features, all advanced metrics, widget engines, and migration capabilities are localized within an isolated module:

- **Isolated File Path**: `/src/components/NetworkDashboardExpansion.tsx`
- **Contamination Guard**: No external side-effects or inline modifications are made to primary routing systems. High-impact telemetry works downstream of active simulation states.

---

## 2. Documented Assets & Clone Specs (The "Clone Forms")

Below are the exact specs to migrate these modules into the next app without complications:

### A. NetworkOverviewDashboard
- **Dependencies**: `lucide-react`, `motion/react`
- **Props Schema**:
  ```typescript
  interface NetworkOverviewDashboardProps {
    simulationActive: boolean;
    natTimeoutOccurred: boolean;
    selectedCategory: string;
    variableValues: Record<string, string>;
    simConfig?: { keepalive: number; interval: number; timeout: number };
  }
  ```
- **Description**: Replaces the old static top metrics bar with a responsive 3-column grid mapping active multi-path topologies, traffic volume sums, and live network health scoring based on UDP NAT keepalive timings.

### B. HeartbeatWidget
- **Dependencies**: `lucide-react`
- **Supported OS Layout Profiles**:
  1. **Android**: 2x2 grid home screen widget with custom live RTT bar charts and smartphone bezel container.
  2. **macOS**: Notification Center widget format showcasing active tunnel state and packet loss rates.
  3. **Linux**: Custom i3blocks / Waybar systray indicator displaying raw ping averages.
  4. **Desktop**: Advanced RAW HUD displaying ring buffer optimizations and live UDP handshakes.

### C. MigrationPortal
- **Description**: Compiles a unified JSON artifact representing the entire mother app's persistent state, presets, and OAuth configuration. 

### D. Bulk Tunnel Orchestration Workbench
- **Dependencies**: `lucide-react`, `motion/react`
- **Features**: Allows concurrent select/multiselect action mappings across multiple VPN boundaries (WireGuard, SSH, Watchdog Failover, and Cloudflare Tunnel).
- **Simulated Actions**: Supports systemd-level batch recycling (`Restart Selected`) and zero-trust certificate compliance deployments (`Deploy Global Security Patch`).

---

## 3. Data Schema & Persistence Blueprint

### Firestore Collections Mapping (Durable Cloud Data)

| Collection | Schema Definition | Migration Rules |
| :--- | :--- | :--- |
| `notes` | `id (string), title (string), content (text), isLocked (boolean), tags (array), category (string), userId (string), updatedAt (timestamp)` | Safe to import/overwrite; matching is keyed strictly by note `id` to avoid collisions. |
| `contacts` | `id (string), displayName (string), email (string), phoneNumber (string), isAlertEnabled (boolean), assignedTunnels (array), department (string)` | Keeps emergency alert contacts perfectly synced with the failover terminal system. |

### Additions to Configuration Generator Presets
- **Cloudflare Secure Tunnel (`cloudflared`)**: Enabled via the addition of a `/etc/cloudflared/config.yml` configuration template under category `cloudflare`, tracking `TunnelID` and `CredentialsFile` variables. Code template is certified zero-trust egress-only.

---

## 4. Google Workspace Scopes Configured

The current Mother App has been pre-approved for Google OAuth Authentication with the following scopes, which must be mirrored in your Google Cloud Console for the Next App:

- `https://www.googleapis.com/auth/drive` (Used for personal notes backup & recovery in KeepNotesWorkspace)
- `https://mail.google.com/` (Used for real-time watchdog email alert dispatches in ContactsAlertsWorkspace)
- `https://www.googleapis.com/auth/contacts` (Used to sync critical administrator profiles)

---

## 5. Seamless Booting Checklist (for the Next App)
1. Import `/src/components/NetworkDashboardExpansion.tsx` into your entrypoint file.
2. Initialize Firebase/Firestore using the pre-existing configuration.
3. Import the generated clone JSON artifact into your local state or database loader.
