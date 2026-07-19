# OmniNetwork_Optimizer 🚀

An interactive network optimization workbench and full-stack AI orchestrator designed to optimize, configure, and maintain highly stable WireGuard tunnels, SSH connections, and Cloudflare Secure Tunnels. Featuring bulk node orchestration, automatic NAT keepalive tuning, and failover diagnostics.

---

## ⚡ Quick Launch: The Full Uninhibited Version

To experience the full uninhibited version on your local machine with full terminal simulations, local state control, and direct API communication, follow these simple commands:

```bash
# 1. Install all required dependencies
npm install

# 2. Start the interactive development environment (Vite + Express)
npm run dev
```
Once started, open your browser to **`http://localhost:3000`** to access the complete workspace interface.

---

## 📦 How to Install & Run on Your Devices

### 🖥️ Desktop Installation (macOS, Linux, Windows)

#### 1. Requirements
* **Node.js** (v18 or higher recommended)
* **npm** (included with Node.js) or **bun** / **yarn**

#### 2. Local Setup Steps
1. **Extract the ZIP** file containing the application on your laptop.
2. Open your terminal (Terminal on macOS/Linux, PowerShell or Command Prompt on Windows) and navigate into the extracted directory:
   ```bash
   cd OmniNetwork_Optimizer
   ```
3. **Configure Environment Secrets** (Optional - for the AI Diagnostic Agent):
   Create a `.env` file in the root directory based on the `.env.example` file:
   ```bash
   cp .env.example .env
   ```
   Open the `.env` file and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```
4. **Install Dependencies**:
   ```bash
   npm install
   ```
5. **Launch in Dev Mode**:
   ```bash
   npm run dev
   ```
   Your app is now live at **`http://localhost:3000`**.

#### 3. Production Deployment (Locally)
If you want to build and run a compiled, ultra-fast production bundle:
```bash
# Build the React frontend and bundle the Express server
npm run build

# Start the compiled production server
npm run start
```

---

### 📱 Mobile Installation (iOS & Android)

Since **OmniNetwork_Optimizer** is built using a highly responsive, mobile-first design, you can run and install it directly on any major phone with full uninhibited capability.

#### Method A: Local Network Sharing (Easiest)
1. Ensure your laptop and phone are connected to the **same Wi-Fi network**.
2. Run the application on your laptop:
   ```bash
   npm run dev
   ```
3. Find your laptop's local IP address:
   * **macOS/Linux**: Run `ifconfig` (usually looks like `192.168.X.X` or `10.0.X.X`)
   * **Windows**: Run `ipconfig`
4. Open the web browser on your phone and go to:
   ```text
   http://<YOUR-LAPTOP-IP>:3000
   ```

#### Method B: Install as a Homescreen Web App (PWA)
For a borderless, uninhibited app experience that opens outside of standard browser frames:
* **iOS (Safari)**: Tap the **Share** button 📤, scroll down, and select **"Add to Home Screen"** ➕.
* **Android (Chrome)**: Tap the **three-dot menu** ⠇ and select **"Install App"** or **"Add to Home Screen"**.

#### Method C: Global Zero-Trust Secure Tunnel
If you need to access your local optimizer on the go over cellular connections:
1. Fire up a quick secure egress tunnel using **Cloudflare Tunnel (`cloudflared`)** or **Tailscale Funnel**:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
2. Copy the generated public `.trycloudflare.com` URL and load it directly on your smartphone!

---

## 🛠️ Main Workspace Features

* **Terminal Gateway Security**: Secure your local sessions behind a cryptographic PIN layer.
* **Live Keepalive Simulators**: Interact with live UDP payload delivery graphs to visualize how standard NAT timeouts drop persistent connections.
* **Emergency Watchdog Dispatches**: Connect to the Google Workspace OAuth flow to dispatch real-time emergency alert emails via Gmail when cellular tethering links drop.
* **Config Generators**: Quickly customize keepalive profiles for WireGuard (`wg0.conf`), SSH Client (`~/.ssh/config`), and Zero-Trust `cloudflared` daemons.
