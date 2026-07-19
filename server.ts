import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini safely with the official @google/genai package
const getGeminiClient = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Return dummy client or throw later, but let's handle missing key gracefully
    console.warn("WARNING: GEMINI_API_KEY is not defined in the environment.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "MISSING_KEY",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// API Endpoint 1: Network config interactive chat assistant
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { messages, userProfile } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages array provided." });
    }

    const ai = getGeminiClient();
    
    // Construct system instructions tailored to WireGuard, SSH Tunnels, and KeepAlive issues
    const systemInstruction = `You are the Network KeepAlive Agent, an elite systems engineer and network administrator. 
Your core mission is to help the user configure, optimize, and organize their network settings, including WireGuard, SSH tunnels, and USB Tethering, to ensure absolute zero downtime and persistent connectivity.

Key Technical Guidelines to provide code segments for:
1. WireGuard Persistent Connectivity:
   - Always recommend 'PersistentKeepalive = 25' (or similar range 15-25) in peer configs to keep NAT firewalls open.
   - Address MTU issues: over tunnels, standard MTU is 1420 (for IPv4) or 1280 (minimum for IPv6) to prevent packet drop due to fragmentation.
   - Provide Bash/systemd watchdog scripts that ping the WireGuard gateway and restart WG using 'wg-quick down wg0 && wg-quick up wg0' if pings fail.

2. SSH Tunnel Persistence:
   - Recommend client config parameters: 'ServerAliveInterval 15', 'ServerAliveCountMax 3' to detect stale connections and terminate them quickly.
   - Recommend server-side (sshd_config) counterparts: 'ClientAliveInterval 15', 'ClientAliveCountMax 3'.
   - Recommend and provide configurations for 'autossh' to manage tunnel auto-respawns.
   - Provide custom Bash wrappers with loops that monitor SSH exit codes and re-establish the connection.

3. USB Tethering & Hardware connections:
   - Provide troubleshooting guides for initializing tunnels over mobile usb-tethered setups (Android RNDIS, iPhone Usbmux / CDC_ETHER/CDC_NCM).
   - Offer advice on driver initialization, udev rules for hotplugging, handling dynamic gateway IPs (typically 192.168.42.x or 172.20.10.x), and configuring route metrics so local traffic flows correctly.
   - Address cellular-specific MTU limits: cellular providers often enforce tight MTU constraints; recommend lowering wireguard/tunnel MTU to 1360 or 1280 over USB-tethered carrier links to bypass double-NAT fragmentation.

4. General Gateway Monitor & Routing:
   - Provide robust script fragments for automatic network gateway recovery and DNS resetting (e.g. tracking multiple DNS servers).

Keep your explanations concise, extremely technical, clear, and centered on giving copy-pasteable, robust code segments. Speak like a friendly, veteran DevOps specialist. Do not list internal file paths of this Applet; focus only on the system level configs the user would use on their local Linux/Mac machine.`;

    // Convert message array to the format suitable for generateContent
    // Since we are not using the full chat SDK or we want fine-grained control, we can pass the history.
    // Let's format the chat contents:
    const contents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error("Error in /api/gemini/chat:", error);
    res.status(500).json({ 
      error: "Failed to communicate with the network keepalive agent.",
      details: error.message 
    });
  }
});

// API Endpoint 2: Structured configuration optimizer
app.post("/api/optimize-config", async (req, res) => {
  try {
    const { configType, rawConfig, description } = req.body;
    if (!rawConfig) {
      return res.status(400).json({ error: "rawConfig is required." });
    }

    const ai = getGeminiClient();

    const prompt = `Optimize the following ${configType || "network"} configuration file.
Context from user: ${description || "Keep this connection completely reliable with zero dropouts."}

Raw Config:
\`\`\`
${rawConfig}
\`\`\`

Analyze the configuration for:
1. Missing Keepalive parameters (e.g., PersistentKeepalive for Wireguard, ServerAliveInterval for SSH).
2. Suboptimal MTU size (recommend standard tunnel MTUs like 1420/1360 to prevent fragmentation overhead; recommend lower MTUs like 1360/1280 specifically for cellular/USB-tether paths to bypass double-NAT fragmentation).
3. Missing or insecure routing constraints, dynamic gateway metrics, and interface bindings.
4. Correct DNS gateway mapping.
5. In USB-Tethering modes, verify interface metrics, DHCP leases, and hotplug trigger directives.

Provide the optimized version of this configuration, and list structured optimization notes detailing the changes.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimizedConfig: {
              type: Type.STRING,
              description: "The fully optimized, ready-to-use configuration file text."
            },
            changesMade: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of explicit optimizations, fixes, or additions performed."
            },
            explanation: {
              type: Type.STRING,
              description: "A friendly, high-level summary of why these modifications prevent connection drops."
            }
          },
          required: ["optimizedConfig", "changesMade", "explanation"]
        }
      }
    });

    const optimizedData = JSON.parse(response.text || "{}");
    res.json(optimizedData);
  } catch (error: any) {
    console.error("Error in /api/optimize-config:", error);
    res.status(500).json({ 
      error: "Optimization engine failed.",
      details: error.message 
    });
  }
});

// Setup Vite Dev Middleware / Static Production Assets serving
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
