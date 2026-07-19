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
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Search,
  BookOpen,
  HelpCircle,
  Clock,
  Settings,
  Lock,
  ArrowRight,
  Eye,
  FileText,
  AlertTriangle,
  RotateCcw,
  CloudUpload,
  CloudDownload,
  ShieldCheck,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface KeepNotesWorkspaceProps {
  user: User | null;
  authLoading: boolean;
  onLogin: () => void;
  getAccessToken: () => string | null;
}

interface ListItem {
  id: string;
  text: string;
  checked: boolean;
}

interface Note {
  id: string;
  userId: string;
  title: string;
  content?: string;
  isList: boolean;
  listItems?: ListItem[];
  color: string;
  createdAt: any;
  updatedAt: any;
}

const COLORS = [
  { id: "default", name: "Default", bg: "bg-[#121212]", border: "border-white/10", text: "text-gray-200", dot: "bg-neutral-800" },
  { id: "red", name: "Alert Red", bg: "bg-red-950/20", border: "border-red-500/30", text: "text-red-200", dot: "bg-red-600" },
  { id: "orange", name: "Warning Orange", bg: "bg-orange-950/20", border: "border-orange-500/30", text: "text-orange-200", dot: "bg-orange-600" },
  { id: "yellow", name: "Alert Yellow", bg: "bg-yellow-950/20", border: "border-yellow-500/30", text: "text-yellow-200", dot: "bg-yellow-500" },
  { id: "green", name: "Operational Green", bg: "bg-emerald-950/20", border: "border-emerald-500/30", text: "text-emerald-200", dot: "bg-emerald-600" },
  { id: "teal", name: "Diagnostic Teal", bg: "bg-teal-950/20", border: "border-teal-500/30", text: "text-teal-200", dot: "bg-teal-500" },
  { id: "blue", name: "System Blue", bg: "bg-blue-950/20", border: "border-blue-500/30", text: "text-blue-200", dot: "bg-blue-600" },
  { id: "darkblue", name: "Core Indigo", bg: "bg-indigo-950/20", border: "border-indigo-500/30", text: "text-indigo-200", dot: "bg-indigo-600" },
  { id: "purple", name: "Daemon Purple", bg: "bg-purple-950/20", border: "border-purple-500/30", text: "text-purple-200", dot: "bg-purple-600" },
  { id: "pink", name: "Node Pink", bg: "bg-pink-950/20", border: "border-pink-500/30", text: "text-pink-200", dot: "bg-pink-500" },
  { id: "brown", name: "Legacy Amber", bg: "bg-amber-950/20", border: "border-amber-500/30", text: "text-amber-200", dot: "bg-amber-800" },
  { id: "gray", name: "Muted Gray", bg: "bg-zinc-900/60", border: "border-zinc-700/50", text: "text-zinc-200", dot: "bg-zinc-600" }
];

export default function KeepNotesWorkspace({
  user,
  authLoading,
  onLogin,
  getAccessToken
}: KeepNotesWorkspaceProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isList, setIsList] = useState(false);
  const [listInput, setListInput] = useState("");
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [selectedColor, setSelectedColor] = useState("default");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  // Google Drive Cloud Backup & Restore States
  const [isSyncingToDrive, setIsSyncingToDrive] = useState(false);
  const [isRestoringFromDrive, setIsRestoringFromDrive] = useState(false);
  const [driveSyncStatus, setDriveSyncStatus] = useState<string | null>(null);
  const [lastDriveBackupTime, setLastDriveBackupTime] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem("omninetwork_optimizer_drive_backup_time") : null
  );

  const backupToGoogleDrive = async () => {
    const token = getAccessToken();
    if (!token) {
      setDriveSyncStatus("No OAuth token. Re-authenticate.");
      return;
    }
    if (notes.length === 0) {
      setDriveSyncStatus("Nothing to backup (notes list is empty).");
      return;
    }

    setIsSyncingToDrive(true);
    setDriveSyncStatus("Searching backup file on Google Drive...");

    try {
      // 1. Search for existing file
      const searchRes = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=name='omninetwork_optimizer_notes_backup.json' and trashed=false",
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!searchRes.ok) throw new Error(`Drive Search Error: ${searchRes.status}`);
      const searchData = await searchRes.json();
      const existingFile = searchData.files?.[0];

      let fileId = existingFile?.id;

      if (fileId) {
        setDriveSyncStatus("Updating existing backup file on Google Drive...");
        // 2a. Update existing file content
        const updateRes = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(notes)
          }
        );
        if (!updateRes.ok) throw new Error(`Drive Update Error: ${updateRes.status}`);
      } else {
        setDriveSyncStatus("Creating new backup file on Google Drive...");
        // 2b. Create file metadata
        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: "omninetwork_optimizer_notes_backup.json",
            mimeType: "application/json"
          })
        });
        if (!createRes.ok) throw new Error(`Drive Create Error: ${createRes.status}`);
        const createdFile = await createRes.json();
        fileId = createdFile.id;

        // 3. Upload content to created file
        const uploadRes = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(notes)
          }
        );
        if (!uploadRes.ok) throw new Error(`Drive Upload Error: ${uploadRes.status}`);
      }

      const timestamp = new Date().toLocaleString();
      setLastDriveBackupTime(timestamp);
      if (typeof window !== "undefined") {
        localStorage.setItem("omninetwork_optimizer_drive_backup_time", timestamp);
      }
      setDriveSyncStatus("✓ Notes backup to Google Drive completed!");
    } catch (err: any) {
      console.error(err);
      setDriveSyncStatus(`✗ Backup failed: ${err.message || err}`);
    } finally {
      setIsSyncingToDrive(false);
      setTimeout(() => setDriveSyncStatus(null), 8000);
    }
  };

  const restoreFromGoogleDrive = async () => {
    const token = getAccessToken();
    if (!token) {
      setDriveSyncStatus("No OAuth token. Re-authenticate.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to restore notes from Google Drive? This will merge and sync them into your current Workspace."
    );
    if (!confirmed) return;

    setIsRestoringFromDrive(true);
    setDriveSyncStatus("Fetching backup file from Google Drive...");

    try {
      const searchRes = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=name='omninetwork_optimizer_notes_backup.json' and trashed=false",
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!searchRes.ok) throw new Error(`Drive Search Error: ${searchRes.status}`);
      const searchData = await searchRes.json();
      const backupFile = searchData.files?.[0];

      if (!backupFile) {
        throw new Error("No backup file 'omninetwork_optimizer_notes_backup.json' found in Google Drive.");
      }

      setDriveSyncStatus("Downloading backup file data...");
      const contentRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${backupFile.id}?alt=media`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!contentRes.ok) throw new Error(`Drive Download Error: ${contentRes.status}`);
      const restoredNotes: Note[] = await contentRes.json();

      if (!Array.isArray(restoredNotes)) {
        throw new Error("Invalid backup format downloaded from Google Drive.");
      }

      setDriveSyncStatus(`Restoring ${restoredNotes.length} notes/runbooks to Cloud database...`);
      for (const note of restoredNotes) {
        // Prepare correct Timestamp format
        const cleanNote = {
          ...note,
          userId: user?.uid, // Ensure it aligns with current authenticated user
          updatedAt: Timestamp.now()
        };
        await setDoc(doc(db, "notes", note.id), cleanNote);
      }

      setDriveSyncStatus(`✓ Successfully restored ${restoredNotes.length} runbooks from Google Drive!`);
    } catch (err: any) {
      console.error(err);
      setDriveSyncStatus(`✗ Restore failed: ${err.message || err}`);
    } finally {
      setIsRestoringFromDrive(false);
      setTimeout(() => setDriveSyncStatus(null), 8000);
    }
  };

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

  // Load user notes from Firestore in real-time
  useEffect(() => {
    if (!user) return;

    const path = "notes";
    const q = query(collection(db, path), where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedNotes: Note[] = [];
        snapshot.forEach((doc) => {
          loadedNotes.push(doc.data() as Note);
        });
        // Sort by updatedAt desc
        loadedNotes.sort((a, b) => {
          const tA = a.updatedAt?.seconds || 0;
          const tB = b.updatedAt?.seconds || 0;
          return tB - tA;
        });
        setNotes(loadedNotes);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Handle adding list item to draft
  const handleAddListItem = () => {
    if (!listInput.trim()) return;
    const newItem: ListItem = {
      id: Math.random().toString(36).substring(2, 9),
      text: listInput.trim(),
      checked: false
    };
    setListItems([...listItems, newItem]);
    setListInput("");
  };

  const handleRemoveDraftListItem = (index: number) => {
    setListItems(listItems.filter((_, i) => i !== index));
  };

  // Create or save the Note
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() && !content.trim() && listItems.length === 0) {
      setError("Cannot save an empty note.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const noteId = Math.random().toString(36).substring(2, 15);
    const path = `notes/${noteId}`;

    const newNote: Note = {
      id: noteId,
      userId: user.uid,
      title: title.trim() || "Untitled Runbook",
      content: isList ? "" : content.trim(),
      isList,
      listItems: isList ? listItems : [],
      color: selectedColor,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    try {
      await setDoc(doc(db, "notes", noteId), newNote);
      // Reset form
      setTitle("");
      setContent("");
      setListItems([]);
      setListInput("");
      setSelectedColor("default");
      setIsList(false);
    } catch (err) {
      setError("Failed to sync note to Firestore. Verify security policies.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle list item check status in existing note card
  const handleToggleListItem = async (note: Note, itemId: string) => {
    if (!user) return;
    const updatedItems = note.listItems?.map((item) => {
      if (item.id === itemId) {
        return { ...item, checked: !item.checked };
      }
      return item;
    }) || [];

    const path = `notes/${note.id}`;
    try {
      await updateDoc(doc(db, "notes", note.id), {
        listItems: updatedItems,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    if (!user) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete this tunnel runbook note? This cannot be undone."
    );
    if (!confirmed) return;

    const path = `notes/${noteId}`;
    try {
      await deleteDoc(doc(db, "notes", noteId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const filteredNotes = notes.filter((note) => {
    const q = searchQuery.toLowerCase();
    const matchesTitle = note.title.toLowerCase().includes(q);
    const matchesContent = note.content?.toLowerCase().includes(q) || false;
    const matchesList = note.listItems?.some((i) => i.text.toLowerCase().includes(q)) || false;
    return matchesTitle || matchesContent || matchesList;
  });

  return (
    <div id="notes-workspace-root" className="flex-1 flex flex-col lg:flex-row min-h-0 bg-[#0a0a0a]">
      {/* Left panel: Creator & Guides */}
      <aside className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-white/5 bg-[#0d0d0d] flex flex-col shrink-0 p-6 overflow-y-auto">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 bg-yellow-500/10 border border-yellow-500/20 rounded flex items-center justify-center text-yellow-500">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Secure Runbook Vault</h2>
            <p className="text-[10px] text-yellow-500 font-mono tracking-widest uppercase">Keep-compatible offline sync</p>
          </div>
        </div>

        {!user ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center my-auto flex flex-col items-center gap-4">
            <Lock className="h-10 w-10 text-gray-400 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase">Authentication Required</h3>
              <p className="text-xs text-gray-400 mt-1">
                Authenticate with your Google Account to sync tunnel credentials, command notes, and failure scripts securely to Firebase.
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
                <span className="gsi-material-button-contents">Sign in with Google</span>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Google Drive Workspace Sync (Dragon Personal Command) */}
            {user?.email?.toLowerCase() === "dragonshaw82@gmail.com" && (
              <div className="bg-[#121212] border border-yellow-500/20 rounded-xl p-4 space-y-3 shadow-md shadow-yellow-500/5 animate-fade-in">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] font-mono text-yellow-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-yellow-500 animate-pulse" />
                    Dragon Executive Syncer
                  </span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 font-bold font-mono uppercase tracking-wider">
                    Drive Sync Active
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
                  Export and restore your Secure Runbook notes directly to your personal Google Drive account.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={backupToGoogleDrive}
                    disabled={isSyncingToDrive || isRestoringFromDrive}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black text-[10px] font-bold font-mono uppercase rounded transition cursor-pointer"
                  >
                    <CloudUpload className="h-3.5 w-3.5" />
                    {isSyncingToDrive ? "Backup..." : "Backup to Drive"}
                  </button>
                  <button
                    type="button"
                    onClick={restoreFromGoogleDrive}
                    disabled={isSyncingToDrive || isRestoringFromDrive}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-black hover:bg-[#1a1a1a] border border-white/10 disabled:opacity-50 text-gray-300 text-[10px] font-bold font-mono uppercase rounded transition cursor-pointer"
                  >
                    <CloudDownload className="h-3.5 w-3.5" />
                    {isRestoringFromDrive ? "Restore..." : "Restore"}
                  </button>
                </div>

                {lastDriveBackupTime && (
                  <div className="text-[8px] text-gray-500 font-mono flex items-center justify-between">
                    <span>Last backup:</span>
                    <span>{lastDriveBackupTime}</span>
                  </div>
                )}

                {driveSyncStatus && (
                  <div className="p-2 bg-black/40 border border-white/5 rounded text-[10px] font-mono text-yellow-400 leading-snug">
                    {driveSyncStatus}
                  </div>
                )}
              </div>
            )}

            {/* Create form */}
            <form onSubmit={handleSaveNote} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="SSH Key passphrase, wg MTU settings..."
                  className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-yellow-500 transition"
                />
              </div>

              <div className="flex items-center justify-between py-1 bg-[#121212] px-3 rounded-lg border border-white/5">
                <span className="text-xs text-gray-300 font-mono">Checklist Runbook</span>
                <button
                  type="button"
                  onClick={() => setIsList(!isList)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isList ? "bg-yellow-500" : "bg-zinc-800"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isList ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {isList ? (
                <div className="space-y-2 border border-white/5 rounded-lg p-3 bg-[#050505]">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono block">Draft Checklist Items</span>
                  
                  {listItems.length > 0 && (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto mb-2">
                      {listItems.map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between bg-white/5 px-2 py-1 rounded text-xs font-mono">
                          <span className="truncate max-w-[180px]">{item.text}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftListItem(idx)}
                            className="text-red-400 hover:text-red-300 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={listInput}
                      onChange={(e) => setListInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddListItem();
                        }
                      }}
                      placeholder="Add item..."
                      className="flex-1 bg-[#090909] border border-white/10 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddListItem}
                      className="bg-yellow-500 text-black font-bold p-1 rounded hover:bg-yellow-400 transition"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Note Content</label>
                  <textarea
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter configuration notes, terminal commands, or general reference texts..."
                    className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-yellow-500 transition resize-none"
                  />
                </div>
              )}

              {/* Color picker */}
              <div className="space-y-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono block">Categorization Accent</span>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      title={color.name}
                      onClick={() => setSelectedColor(color.id)}
                      className={`w-6 h-6 rounded-full border flex items-center justify-center transition transform hover:scale-110 ${
                        selectedColor === color.id ? "border-yellow-500 scale-110" : "border-transparent"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full ${color.dot}`} />
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400 font-mono flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs uppercase tracking-wider rounded-lg transition disabled:bg-neutral-800 disabled:text-neutral-500 cursor-pointer flex items-center justify-center gap-1"
              >
                <Plus className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Runbook Note"}
              </button>
            </form>

            <hr className="border-white/5" />

            <div className="space-y-2.5">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono block">Runbook Tips</span>
              <div className="bg-[#121212] border border-white/5 rounded-lg p-3 space-y-2">
                <div className="flex gap-2 text-xs">
                  <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-gray-400 font-mono">
                    Use <strong className="text-white">Red/Orange</strong> accents for high priority manual failover scripts.
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  <CheckSquare className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-gray-400 font-mono">
                    Real-time persistence ensures configurations stay safe even if browser cache is cleared.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Right panel: Search and Bento Grid of notes */}
      <section className="flex-1 flex flex-col min-h-0 bg-[#070707] p-6">
        {/* Top search controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Note Repository</h3>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-500">
                {filteredNotes.length} saved notes &bull;
              </span>
              {isOnline ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-mono uppercase font-bold">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                  Cloud Sync Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-mono uppercase font-bold animate-pulse" title="Vessel caches data locally and synchronizes automatically on reconnection.">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Offline Persistence Active
                </span>
              )}
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search runbooks..."
              className="w-full bg-[#121212] border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-yellow-500 transition"
            />
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto mt-6">
          {!user ? (
            <div className="h-64 border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center text-center p-6 text-gray-500">
              <Lock className="h-8 w-8 mb-2" />
              <p className="text-xs font-mono">Authenticating with Google enables runbook sync.</p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="h-64 border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center text-center p-6 text-gray-500">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-xs font-mono">No runbooks or notes found matching query.</p>
              <p className="text-[10px] text-gray-600 mt-1">Create a note in the left panel to populate your canvas.</p>
            </div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {filteredNotes.map((note) => {
                  const colorConfig = COLORS.find((c) => c.id === note.color) || COLORS[0];
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      key={note.id}
                      className={`rounded-xl p-4 flex flex-col justify-between min-h-[160px] transition-all duration-300 ${colorConfig.bg} ${colorConfig.border} ${colorConfig.text} shadow-md group`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold font-mono tracking-tight uppercase line-clamp-1">
                            {note.title}
                          </h4>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-bold font-mono bg-white/10`}>
                            {note.isList ? "CHECKLIST" : "NOTE"}
                          </span>
                        </div>

                        {note.isList ? (
                          <div className="space-y-1.5 my-2 max-h-48 overflow-y-auto">
                            {note.listItems && note.listItems.map((item) => (
                              <div
                                key={item.id}
                                onClick={() => handleToggleListItem(note, item.id)}
                                className="flex items-start gap-2 cursor-pointer group/item select-none text-[11px] font-mono hover:text-white"
                              >
                                {item.checked ? (
                                  <CheckSquare className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                                ) : (
                                  <Square className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                                )}
                                <span className={`leading-tight ${item.checked ? "line-through text-gray-500" : ""}`}>
                                  {item.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap mb-4 break-words line-clamp-6">
                            {note.content}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto text-[9px] text-gray-500 font-mono shrink-0">
                        <span>
                          {note.updatedAt ? (
                            new Date(note.updatedAt.seconds * 1000).toLocaleString()
                          ) : (
                            "Live Syncing"
                          )}
                        </span>
                        
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition"
                          title="Delete note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}
