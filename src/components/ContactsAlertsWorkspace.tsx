import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  Timestamp
} from "firebase/firestore";
import {
  db,
  handleFirestoreError,
  OperationType
} from "../firebase";
import {
  Users,
  Search,
  Bell,
  Mail,
  Phone,
  ShieldAlert,
  Terminal,
  Play,
  CheckCircle,
  AlertTriangle,
  X,
  Lock,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ContactsAlertsWorkspaceProps {
  user: User | null;
  authLoading: boolean;
  onLogin: () => void;
  getAccessToken: () => string | null;
}

interface GoogleContact {
  resourceName: string;
  displayName: string;
  email: string;
  phoneNumber: string;
}

interface ContactAlertRule {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  assignedTunnels: string[];
  isAlertEnabled: boolean;
  createdAt: any;
  updatedAt: any;
}

interface AlertLog {
  id: string;
  timestamp: string;
  type: "INFO" | "STALL" | "DISPATCH" | "SUCCESS" | "WARN";
  message: string;
}

export default function ContactsAlertsWorkspace({
  user,
  authLoading,
  onLogin,
  getAccessToken
}: ContactsAlertsWorkspaceProps) {
  const [googleContacts, setGoogleContacts] = useState<GoogleContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  
  const [alertRules, setAlertRules] = useState<ContactAlertRule[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Track online/offline status
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  
  // Rule editor modal/drawer state
  const [editingContact, setEditingContact] = useState<GoogleContact | null>(null);
  const [selectedTunnels, setSelectedTunnels] = useState<string[]>([]);
  const [isAlertEnabled, setIsAlertEnabled] = useState(true);
  const [isSavingRule, setIsSavingRule] = useState(false);

  // Custom alert rule state (for users who want to add an email/phone manually)
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [customPhone, setCustomPhone] = useState("");

  // Simulated Alert Broadcast Terminal logs
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([
    { id: "1", timestamp: new Date().toLocaleTimeString(), type: "INFO", message: "Alert system daemon initialized." },
    { id: "2", timestamp: new Date().toLocaleTimeString(), type: "INFO", message: "Awaiting failover events or manual simulator triggers..." }
  ]);

  // Gmail Live Alerts & Log monitoring (Dragon Personal Command)
  const [gmailAlerts, setGmailAlerts] = useState<any[]>([]);
  const [isFetchingGmail, setIsFetchingGmail] = useState(false);

  const sendRealGmailNotification = async (toEmail: string, subject: string, bodyText: string) => {
    const token = getAccessToken();
    if (!token) return { success: false, error: "No OAuth access token" };

    const rfc822 = [
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      '',
      bodyText
    ].join('\r\n');

    const encodedRaw = btoa(unescape(encodeURIComponent(rfc822)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: encodedRaw })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || `HTTP ${res.status}`);
      }
      
      return { success: true };
    } catch (err: any) {
      console.error('Gmail send error:', err);
      return { success: false, error: err.message || err };
    }
  };

  const fetchRecentGmailAlerts = async () => {
    const token = getAccessToken();
    if (!token) return;
    setIsFetchingGmail(true);
    try {
      // Query recent emails containing alert, failover, or omninetwork_optimizer
      const listRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=omninetwork_optimizer OR failover OR alert", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!listRes.ok) throw new Error("Gmail list fail");
      const listData = await listRes.json();
      const messages = listData.messages || [];

      const loadedMsgs = [];
      for (const msg of messages) {
        const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!detailRes.ok) continue;
        const detail = await detailRes.json();
        const headers = detail.payload?.headers || [];
        const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
        const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
        const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
        const snippet = detail.snippet || '';
        loadedMsgs.push({ id: msg.id, subject, from, date: dateHeader, snippet });
      }
      setGmailAlerts(loadedMsgs);
    } catch (err) {
      console.error("Error fetching Gmail messages:", err);
    } finally {
      setIsFetchingGmail(false);
    }
  };

  useEffect(() => {
    if (user && user.email?.toLowerCase() === "dragonshaw82@gmail.com") {
      fetchRecentGmailAlerts();
    }
  }, [user]);

  const AVAILABLE_TUNNELS = [
    { id: "wg-primary-01", name: "wg-primary-01 (WireGuard)" },
    { id: "ssh-db-tunnel", name: "ssh-db-tunnel (SSH Tunnel)" },
    { id: "wg-failover-node", name: "wg-failover-node (Watchdog)" },
    { id: "usb-tether-link", name: "usb-tether-link (USB Tether)" }
  ];

  // Fetch Google Contacts via Google People API
  const fetchGoogleContacts = async () => {
    const token = getAccessToken();
    if (!token) {
      setContactsError("No OAuth access token found. Re-authentication might be needed.");
      return;
    }

    setContactsLoading(true);
    setContactsError(null);

    try {
      const res = await fetch(
        "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=100",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!res.ok) {
        throw new Error(`Google API responded with HTTP ${res.status}`);
      }

      const data = await res.json();
      const connections = data.connections || [];
      const formatted: GoogleContact[] = connections.map((conn: any) => {
        const displayName = conn.names?.[0]?.displayName || "Unnamed Connection";
        const email = conn.emailAddresses?.[0]?.value || "";
        const phoneNumber = conn.phoneNumbers?.[0]?.value || "";
        return {
          resourceName: conn.resourceName,
          displayName,
          email,
          phoneNumber
        };
      });

      setGoogleContacts(formatted);
    } catch (err) {
      console.error("Failed to retrieve Google Contacts:", err);
      setContactsError("Failed to import Google Contacts automatically. You can still set up custom manual alert receivers below.");
    } finally {
      setContactsLoading(false);
    }
  };

  // Fetch alert rules from Firestore in real-time
  useEffect(() => {
    if (!user) return;

    // Load Google Contacts as soon as we have token
    if (getAccessToken()) {
      fetchGoogleContacts();
    }

    const path = "contactsAlerts";
    const q = query(collection(db, path), where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedRules: ContactAlertRule[] = [];
        snapshot.forEach((doc) => {
          loadedRules.push(doc.data() as ContactAlertRule);
        });
        setAlertRules(loadedRules);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Open config for a Google Contact
  const handleOpenConfig = (contact: GoogleContact) => {
    // Check if rule already exists to load current setup
    const existing = alertRules.find((r) => r.email === contact.email || r.id === contact.resourceName);
    setEditingContact(contact);
    if (existing) {
      setSelectedTunnels(existing.assignedTunnels);
      setIsAlertEnabled(existing.isAlertEnabled);
    } else {
      setSelectedTunnels([]);
      setIsAlertEnabled(true);
    }
  };

  // Save Rule to Firestore
  const handleSaveAlertRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingContact) return;

    setIsSavingRule(true);
    // Use resourceName or construct ID
    const ruleId = editingContact.resourceName.replace("/", "_") || `custom_${Math.random().toString(36).substring(2, 9)}`;
    const path = `contactsAlerts/${ruleId}`;

    const rule: ContactAlertRule = {
      id: ruleId,
      userId: user.uid,
      displayName: editingContact.displayName,
      email: editingContact.email,
      phoneNumber: editingContact.phoneNumber,
      assignedTunnels: selectedTunnels,
      isAlertEnabled,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    try {
      await setDoc(doc(db, "contactsAlerts", ruleId), rule);
      setEditingContact(null);
      addTerminalLog("SUCCESS", `Configured Alert Rule for contact: ${editingContact.displayName}`);
    } catch (err) {
      console.error(err);
      alert("Failed to save rule to Firestore. Please verify database security rules.");
    } finally {
      setIsSavingRule(false);
    }
  };

  // Delete Alert Rule
  const handleDeleteAlertRule = async (ruleId: string, name: string) => {
    if (!user) return;
    const confirmed = window.confirm(
      `Delete notification failover alert rules for ${name}?`
    );
    if (!confirmed) return;

    const path = `contactsAlerts/${ruleId}`;
    try {
      await deleteDoc(doc(db, "contactsAlerts", ruleId));
      addTerminalLog("WARN", `Revoked notification access rule for ${name}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Add a manual custom alert rule
  const handleSaveCustomAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!customName.trim()) {
      alert("Please enter a valid display name.");
      return;
    }

    const customContact: GoogleContact = {
      resourceName: `custom/rule_${Math.random().toString(36).substring(2, 9)}`,
      displayName: customName.trim(),
      email: customEmail.trim(),
      phoneNumber: customPhone.trim()
    };

    setCustomName("");
    setCustomEmail("");
    setCustomPhone("");
    setShowCustomForm(false);
    handleOpenConfig(customContact);
  };

  // Trigger simulated stall event
  const handleTriggerSimulatedStall = (tunnelId: string) => {
    const tunnelName = AVAILABLE_TUNNELS.find((t) => t.id === tunnelId)?.name || tunnelId;
    addTerminalLog("STALL", `SIMULATION INITIATED: Connection dropping on link ${tunnelId}!`);
    
    // Find registered alert contacts
    const triggeredRules = alertRules.filter(
      (r) => r.isAlertEnabled && r.assignedTunnels.includes(tunnelId)
    );

    setTimeout(() => {
      if (triggeredRules.length === 0) {
        addTerminalLog("INFO", "Failover Scan: Completed. No alert rules associated with this link.");
        return;
      }

      addTerminalLog("INFO", `Failover Scan: Found ${triggeredRules.length} registered recipient(s). Dispatching alert broadcasts.`);

      triggeredRules.forEach((rule, idx) => {
        setTimeout(() => {
          if (rule.email) {
            addTerminalLog(
              "DISPATCH",
              `BROADCASTING EMAIL Alert to [${rule.displayName}] (${rule.email}): 'Critical Failover Triggered on ${tunnelId}'`
            );

            // Execute real Gmail alert dispatch if signed in as Dragon owner
            if (user?.email?.toLowerCase() === "dragonshaw82@gmail.com") {
              sendRealGmailNotification(
                rule.email,
                `[OMNINETWORK_OPTIMIZER FAILOVER ALERT] Critical stall on link ${tunnelId}`,
                `Hello ${rule.displayName},\n\nThis is an automated network monitoring notification from OmniNetwork_Optimizer Workspace.\n\nA critical failure was simulated on connection link: ${tunnelId}.\nThe failover system has successfully engaged the backup daemon for emergency recovery.\n\nTimestamp: ${new Date().toLocaleString()}\nMonitoring Area: us-west1-active`
              ).then((res) => {
                if (res.success) {
                  addTerminalLog("SUCCESS", `✓ Real Emergency Email sent to ${rule.displayName} via Gmail API!`);
                } else {
                  addTerminalLog("WARN", `✗ Gmail API dispatch failed: ${res.error}`);
                }
              });
            }
          }
          if (rule.phoneNumber) {
            addTerminalLog(
              "DISPATCH",
              `BROADCASTING SMS Notification to [${rule.displayName}] (${rule.phoneNumber}): 'ALERT: Network node ${tunnelId} has stalled. Auto-failover daemon is attempting recovery...'`
            );
          }
        }, (idx + 1) * 800);
      });
    }, 1000);
  };

  const addTerminalLog = (type: "INFO" | "STALL" | "DISPATCH" | "SUCCESS" | "WARN", message: string) => {
    const newLog: AlertLog = {
      id: Math.random().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    };
    setAlertLogs((prev) => [newLog, ...prev].slice(0, 50));
  };

  const filteredContacts = googleContacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phoneNumber.includes(q)
    );
  });

  return (
    <div id="contacts-workspace-root" className="flex-1 flex flex-col xl:flex-row min-h-0 bg-[#0a0a0a]">
      {/* Google Contacts List / Custom Add Area */}
      <aside className="w-full xl:w-[480px] border-b xl:border-b-0 xl:border-r border-white/5 bg-[#0d0d0d] flex flex-col shrink-0 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded flex items-center justify-center text-blue-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Network Administrators</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] text-blue-400 font-mono tracking-widest uppercase">Emergency Contacts</span>
                {isOnline ? (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-mono uppercase font-bold">
                    Sync Live
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-mono uppercase font-bold animate-pulse">
                    Offline Cache
                  </span>
                )}
              </div>
            </div>
          </div>

          {user && getAccessToken() && (
            <button
              onClick={fetchGoogleContacts}
              disabled={contactsLoading}
              className="p-1.5 rounded border border-white/5 bg-[#121212] hover:bg-white/5 text-gray-400 hover:text-white transition cursor-pointer"
              title="Sync Contacts"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${contactsLoading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>

        {!user ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center my-auto flex flex-col items-center gap-4">
            <Lock className="h-10 w-10 text-gray-400 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase">Google Contacts Integration</h3>
              <p className="text-xs text-gray-400 mt-1">
                Authenticate your account to sync your live Google Contacts directory directly into our network alert routing system.
              </p>
            </div>

            <button
              onClick={onLogin}
              className="gsi-material-button w-full cursor-pointer hover:opacity-90"
              style={{ margin: 0 }}
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">Import Google Contacts</span>
              </div>
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Toggle form creation manually */}
            {!showCustomForm ? (
              <button
                onClick={() => setShowCustomForm(true)}
                className="w-full py-2 bg-[#121212] hover:bg-white/5 border border-white/10 text-xs font-mono font-bold uppercase rounded-lg text-gray-300 transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="h-4 w-4" /> Add Manual Alert Contact
              </button>
            ) : (
              <form onSubmit={handleSaveCustomAlert} className="bg-[#121212] border border-white/10 rounded-xl p-4 space-y-3 shrink-0">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] font-mono text-gray-400 uppercase">New Custom Contact</span>
                  <button type="button" onClick={() => setShowCustomForm(false)} className="text-gray-500 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      required
                      placeholder="Display Name"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full bg-[#050505] border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      className="w-full bg-[#050505] border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Phone (SMS)"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      className="w-full bg-[#050505] border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded transition font-mono cursor-pointer"
                >
                  Configure Rules
                </button>
              </form>
            )}

            <div className="relative shrink-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contact directory..."
                className="w-full bg-[#121212] border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {contactsError && (
              <div className="p-3 bg-blue-950/20 border border-blue-500/10 rounded-lg text-xs font-mono text-blue-200">
                {contactsError}
              </div>
            )}

            {/* Contacts result scroll area */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px]">
              {contactsLoading ? (
                <div className="h-32 flex flex-col items-center justify-center text-gray-500 font-mono text-xs gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Importing Google Connection Profiles...
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-white/5 rounded-xl text-gray-500">
                  <Users className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-mono">No directory connections found.</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">Use "Add Manual Alert Contact" to define receivers.</p>
                </div>
              ) : (
                filteredContacts.map((contact) => {
                  const hasRule = alertRules.some((r) => r.email === contact.email || r.id === contact.resourceName.replace("/", "_"));
                  return (
                    <div
                      key={contact.resourceName}
                      onClick={() => handleOpenConfig(contact)}
                      className={`p-3 rounded-lg border transition duration-150 cursor-pointer flex items-center justify-between ${
                        hasRule
                          ? "bg-blue-600/5 border-blue-500/20 hover:bg-blue-600/10"
                          : "bg-transparent border-white/5 hover:bg-white/5"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">{contact.displayName}</span>
                          {hasRule && (
                            <span className="text-[7px] px-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 font-bold rounded font-mono uppercase">
                              Active Alerts
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col mt-1 space-y-0.5 text-[10px] text-gray-400 font-mono">
                          {contact.email && (
                            <span className="flex items-center gap-1.5 truncate">
                              <Mail className="h-3 w-3 text-gray-600" /> {contact.email}
                            </span>
                          )}
                          {contact.phoneNumber && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3 w-3 text-gray-600" /> {contact.phoneNumber}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="pl-3 shrink-0">
                        <button className="text-[10px] font-mono text-blue-400 hover:text-blue-300 transition font-bold uppercase">
                          {hasRule ? "Edit" : "Set Rules"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Main Panel: Active Routing Alert Rules and Broadcast Terminal */}
      <section className="flex-1 flex flex-col min-h-0 bg-[#070707] p-6 space-y-6 overflow-y-auto">
        
        {/* Title area */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Alert Orchestration Engine</h3>
            <p className="text-xs text-gray-500">
              Map connection failure dropouts directly to administrators via instant multi-channel broadcasts.
            </p>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full shrink-0">
            <ShieldAlert className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider font-mono">Failover Daemon Armed</span>
          </div>
        </div>

        {/* Modal-style Drawer inside panel for rules setup */}
        <AnimatePresence>
          {editingContact && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#111] border border-blue-500/30 rounded-xl p-5 shadow-xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Routing Rules For: {editingContact.displayName}
                  </h4>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    {editingContact.email} {editingContact.phoneNumber ? `• ${editingContact.phoneNumber}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => setEditingContact(null)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveAlertRule} className="space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono block">Assign Trigger Links</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {AVAILABLE_TUNNELS.map((tunnel) => {
                      const isChecked = selectedTunnels.includes(tunnel.id);
                      return (
                        <div
                          key={tunnel.id}
                          onClick={() => {
                            if (isChecked) {
                              setSelectedTunnels(selectedTunnels.filter((id) => id !== tunnel.id));
                            } else {
                              setSelectedTunnels([...selectedTunnels, tunnel.id]);
                            }
                          }}
                          className={`p-3 rounded-lg border text-xs font-mono cursor-pointer transition flex items-center justify-between ${
                            isChecked
                              ? "bg-blue-600/10 border-blue-500/40 text-white"
                              : "bg-transparent border-white/5 text-gray-400 hover:bg-white/5"
                          }`}
                        >
                          <span>{tunnel.name}</span>
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                            isChecked ? "bg-blue-500 border-blue-400 text-white" : "border-gray-600 bg-transparent"
                          }`}>
                            {isChecked && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 bg-[#181818] px-4 rounded-lg border border-white/5">
                  <span className="text-xs text-gray-300 font-mono">Enable Alert Broadcaster</span>
                  <button
                    type="button"
                    onClick={() => setIsAlertEnabled(!isAlertEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isAlertEnabled ? "bg-blue-500" : "bg-zinc-800"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isAlertEnabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex gap-3 justify-end border-t border-white/5 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingContact(null)}
                    className="px-4 py-1.5 bg-[#181818] hover:bg-white/5 text-gray-400 text-xs rounded uppercase font-mono transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingRule}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded uppercase font-mono font-bold transition disabled:opacity-50"
                  >
                    {isSavingRule ? "Saving..." : "Deploy Rule"}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interactive Alerts Rules Repository Grid */}
        <div className="space-y-3 shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono block">Deployed Alerts Repository ({alertRules.length})</span>
          
          {alertRules.length === 0 ? (
            <div className="p-8 border border-dashed border-white/5 rounded-xl text-center text-gray-500 font-mono text-xs">
              No alert routing rules deployed. Set rules for any contact on the left to map tunnel drop notifications.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alertRules.map((rule) => (
                <div key={rule.id} className="bg-[#0e0e0e] border border-white/10 rounded-xl p-4 flex flex-col justify-between hover:border-blue-500/20 transition duration-200">
                  <div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-white font-mono uppercase">{rule.displayName}</h4>
                        <p className="text-[9px] text-gray-500 font-mono">{rule.email || rule.phoneNumber}</p>
                      </div>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold font-mono ${
                        rule.isAlertEnabled ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-neutral-800 text-gray-500"
                      }`}>
                        {rule.isAlertEnabled ? "ENABLED" : "MUTED"}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] text-gray-500 font-mono uppercase block">Assigned Links ({rule.assignedTunnels.length}):</span>
                      {rule.assignedTunnels.length === 0 ? (
                        <span className="text-[10px] text-amber-500 font-mono italic block">No links mapped!</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {rule.assignedTunnels.map((tId) => (
                            <span key={tId} className="text-[9px] px-2 py-0.5 bg-[#181818] text-gray-300 font-mono border border-white/5 rounded uppercase">
                              {tId}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-4 text-[9px] text-gray-500 font-mono">
                    <span>
                      {rule.updatedAt ? new Date(rule.updatedAt.seconds * 1000).toLocaleDateString() : "Live Dynamic"}
                    </span>
                    
                    <button
                      onClick={() => handleDeleteAlertRule(rule.id, rule.displayName)}
                      className="text-red-400 hover:text-red-300 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" /> Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Real-time Gmail Monitor (Owner Only) */}
        {user?.email?.toLowerCase() === "dragonshaw82@gmail.com" && (
          <div className="bg-[#121212]/40 border border-blue-500/10 rounded-xl p-5 space-y-3 shrink-0 animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-blue-400" />
                Gmail Alerts Watchdog Monitor
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchRecentGmailAlerts}
                  disabled={isFetchingGmail}
                  className="px-2 py-0.5 border border-white/10 hover:bg-white/5 disabled:opacity-50 text-[9px] font-mono font-bold text-gray-300 rounded uppercase cursor-pointer transition flex items-center gap-1"
                >
                  <RefreshCw className={`h-2.5 w-2.5 ${isFetchingGmail ? "animate-spin" : ""}`} />
                  {isFetchingGmail ? "Polling..." : "Poll Gmail"}
                </button>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold font-mono uppercase tracking-wider">
                  Admin Gateway
                </span>
              </div>
            </div>

            <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
              Live secure mail feed matching <code className="text-blue-300 bg-black/40 px-1 rounded">"omninetwork_optimizer OR failover OR alert"</code> directly from your personal Gmail inbox.
            </p>

            <div className="space-y-2">
              {isFetchingGmail && gmailAlerts.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-500 font-mono animate-pulse">
                  Querying mail server...
                </div>
              ) : gmailAlerts.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-500 font-mono bg-black/20 rounded border border-white/5">
                  No failover alert emails located. Trigger a link stall below to dispatch a real-time notification alert.
                </div>
              ) : (
                gmailAlerts.map((mail) => (
                  <div key={mail.id} className="p-3 bg-black/40 rounded border border-white/5 hover:border-white/10 transition text-xs font-mono flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-blue-400 font-bold truncate max-w-[200px] sm:max-w-md">{mail.subject}</span>
                      <span className="text-[9px] text-gray-500 shrink-0">{mail.date.replace(/-\d{4}/, "")}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span className="text-gray-500">From:</span>
                      <span className="truncate max-w-[250px]">{mail.from}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 italic truncate mt-0.5">"{mail.snippet}"</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Live Simulator & Broadcaster Terminal */}
        <div className="flex-1 flex flex-col min-h-[300px] bg-[#0c0c0c] border border-white/10 rounded-xl overflow-hidden">
          
          {/* Header */}
          <div className="bg-[#121212] border-b border-white/5 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-gray-200 uppercase tracking-wider font-mono">Emergency Alert Broadcast Terminal</span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-[9px] text-gray-500 font-mono uppercase">Link Stall Simulator:</span>
              <div className="flex gap-1">
                {AVAILABLE_TUNNELS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTriggerSimulatedStall(t.id)}
                    className="px-2 py-0.5 bg-red-950/20 hover:bg-red-500/20 border border-red-500/30 text-[8px] font-mono font-bold text-red-200 rounded uppercase cursor-pointer transition"
                  >
                    Stall {t.id.replace("wg-", "").replace("-tunnel", "")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Terminal log panel */}
          <div className="flex-1 bg-[#050505] p-4 overflow-y-auto space-y-2 font-mono text-[11px] leading-relaxed">
            {alertLogs.map((log) => {
              let typeColor = "text-gray-400";
              let prefix = "●";

              if (log.type === "STALL") {
                typeColor = "text-red-500 font-bold animate-pulse";
                prefix = "⚠️ [ALERT]";
              } else if (log.type === "DISPATCH") {
                typeColor = "text-blue-400";
                prefix = "🚀 [DISPATCH]";
              } else if (log.type === "SUCCESS") {
                typeColor = "text-emerald-400 font-bold";
                prefix = "✓ [OK]";
              } else if (log.type === "WARN") {
                typeColor = "text-amber-500";
                prefix = "✦ [REVOKE]";
              } else {
                typeColor = "text-gray-500";
                prefix = "⚙ [SYSTEM]";
              }

              return (
                <div key={log.id} className="flex gap-2.5 items-start">
                  <span className="text-gray-600 shrink-0 select-none">[{log.timestamp}]</span>
                  <span className={`${typeColor} shrink-0 select-none`}>{prefix}</span>
                  <span className="text-gray-300 break-all">{log.message}</span>
                </div>
              );
            })}
          </div>

        </div>

      </section>
    </div>
  );
}
