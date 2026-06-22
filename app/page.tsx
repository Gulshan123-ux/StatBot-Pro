"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send, Sparkles, Cpu, Zap, Paperclip, MessageSquare, Trash2, Edit3, Check,
  Plus, FileSpreadsheet, X, ChevronDown, ChevronUp, Download, PanelLeftClose,
  PanelLeftOpen, BarChart2, Code2, Copy, RefreshCw, LogOut, Info, Sun, GitBranch
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import FileDropzone from "@/components/FileDropzone";
import AgentThinking, { StreamedThought } from "@/components/AgentThinking";
import AnalysisResult from "@/components/AnalysisResult";
import DataPreview from "@/components/DataPreview";
import { analyzeCSVStream, previewDataset, authSignUp, authLogin, authGetMe } from "@/lib/api";
import type { DatasetInfo, AnalysisResponse, AnalysisHistoryItem } from "@/types";

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

interface ChatSession {
  id: string;
  title: string;
  fileMetadata: { name: string; size: number } | null;
  datasetInfo: DatasetInfo | null;
  history: AnalysisHistoryItem[];
  timestamp: number;
}

const EXAMPLE_QUESTIONS = [
  "What are the top 5 rows by highest value?",
  "Show a bar chart of the most frequent categories.",
  "What is the correlation between numeric columns?",
  "Are there any outliers? Plot them.",
  "Summarise the dataset statistics.",
];

export default function HomePage() {
  // Application State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [fileMap, setFileMap] = useState<Record<string, File>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // User Authentication
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: number; username: string; email: string } | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authUsername, setAuthUsername] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Session derived states
  const [file, setFile] = useState<File | null>(null);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  
  // UI states
  const [question, setQuestion] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [streamedThoughts, setStreamedThoughts] = useState<StreamedThought[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Refs
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auth checking and validation
  useEffect(() => {
    const checkUser = async () => {
      const storedToken = localStorage.getItem("statbot_auth_token");
      if (storedToken) {
        try {
          const userData = await authGetMe(storedToken);
          setToken(storedToken);
          setUser(userData);
          localStorage.setItem("statbot_user_profile", JSON.stringify(userData));
        } catch {
          localStorage.removeItem("statbot_auth_token");
          localStorage.removeItem("statbot_user_profile");
          setToken(null);
          setUser(null);
        }
      }
    };
    checkUser();
  }, []);

  useEffect(() => {
    const handleKeyDownShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDownShortcut);
    return () => window.removeEventListener("keydown", handleKeyDownShortcut);
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (authMode === "signup") {
        if (!authUsername || !authEmail || !authPassword) {
          throw new Error("All fields are required.");
        }
        await authSignUp(authUsername, authEmail, authPassword);
        toast.success("Account created! Logging in...");
        const loginData = await authLogin(authUsername, authPassword);
        localStorage.setItem("statbot_auth_token", loginData.access_token);
        localStorage.setItem("statbot_user_profile", JSON.stringify(loginData.user));
        setToken(loginData.access_token);
        setUser(loginData.user);
      } else {
        if (!authUsername || !authPassword) {
          throw new Error("Username/Email and Password are required.");
        }
        const loginData = await authLogin(authUsername, authPassword);
        localStorage.setItem("statbot_auth_token", loginData.access_token);
        localStorage.setItem("statbot_user_profile", JSON.stringify(loginData.user));
        setToken(loginData.access_token);
        setUser(loginData.user);
        toast.success(`Welcome back, ${loginData.user.username}!`);
      }
      setAuthUsername("");
      setAuthEmail("");
      setAuthPassword("");
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed.");
      toast.error(err.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("statbot_auth_token");
    localStorage.removeItem("statbot_user_profile");
    setToken(null);
    setUser(null);
    toast.success("Signed out successfully.");
  };

  // 1. Initial Load from LocalStorage
  useEffect(() => {
    const stored = localStorage.getItem("statbot_sessions");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ChatSession[];
        const formatted = parsed.map(s => ({
          ...s,
          history: s.history.map(item => ({
            ...item,
            timestamp: new Date(item.timestamp)
          }))
        }));
        setSessions(formatted);
        if (formatted.length > 0) {
          const first = formatted[0];
          setCurrentSessionId(first.id);
          setDatasetInfo(first.datasetInfo);
          setHistory(first.history);
        } else {
          createNewSession();
        }
      } catch (e) {
        console.error("Failed to parse sessions", e);
        createNewSession();
      }
    } else {
      createNewSession();
    }
    setIsLoaded(true);
  }, []);

  // 2. Persist to LocalStorage on changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("statbot_sessions", JSON.stringify(sessions));
    }
  }, [sessions, isLoaded]);

  // 3. Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isAnalyzing, streamedThoughts]);

  // ── Session Operations ──

  const createNewSession = (initialFile: File | null = null, initialInfo: DatasetInfo | null = null) => {
    const newId = Math.random().toString(36).slice(2);
    const newSession: ChatSession = {
      id: newId,
      title: initialFile ? `Analysis: ${initialFile.name}` : "New Chat",
      fileMetadata: initialFile ? { name: initialFile.name, size: initialFile.size } : null,
      datasetInfo: initialInfo,
      history: [],
      timestamp: Date.now()
    };
    
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    
    setFile(initialFile);
    if (initialFile) {
      setFileMap(prev => ({ ...prev, [newId]: initialFile }));
    } else {
      setFile(null);
    }
    setDatasetInfo(initialInfo);
    setHistory([]);
    setQuestion("");
  };

  const handleSelectSession = (id: string) => {
    if (editingSessionId) saveTitle(editingSessionId);
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    setCurrentSessionId(id);
    setFile(fileMap[id] || null);
    setDatasetInfo(session.datasetInfo);
    setHistory(session.history);
    setQuestion("");
  };

  const updateActiveSession = (update: Partial<ChatSession>) => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        const updated = { ...s, ...update, timestamp: Date.now() };
        if (s.title === "New Chat" && update.history && update.history.length > 0) {
          updated.title = update.history[0].question.slice(0, 30) + (update.history[0].question.length > 30 ? "..." : "");
        }
        return updated;
      }
      return s;
    }));
  };

  const startEditing = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditTitleValue(currentTitle);
  };

  const saveTitle = (id: string) => {
    if (editTitleValue.trim()) {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: editTitleValue.trim() } : s));
    }
    setEditingSessionId(null);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = sessions.filter(s => s.id !== id);
    setSessions(remaining);
    
    setFileMap(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });

    if (currentSessionId === id) {
      if (remaining.length > 0) {
        const next = remaining[0];
        setCurrentSessionId(next.id);
        setFile(fileMap[next.id] || null);
        setDatasetInfo(next.datasetInfo);
        setHistory(next.history);
      } else {
        createNewSession();
      }
    }
  };

  // ── File Upload / Re-upload ──

  const handleFileAccepted = (f: File, info: DatasetInfo) => {
    setFile(f);
    setFileMap(prev => ({ ...prev, [currentSessionId]: f }));
    setDatasetInfo(info);
    updateActiveSession({
      fileMetadata: { name: f.name, size: f.size },
      datasetInfo: info,
      title: f.name
    });

    // Save file data to localStorage for the BI Workspace
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        localStorage.setItem("statbot_active_csv", text);
        localStorage.setItem("statbot_active_filename", f.name);
      }
    };
    reader.readAsText(f);

    toast.success(`✓ Loaded ${info.rows.toLocaleString()} rows × ${info.columns} cols`, {
      style: { background: "#0f1623", color: "#f0f6ff", border: "1px solid rgba(52,211,153,0.3)" },
    });
  };

  const handleReuploadFile = async (f: File) => {
    try {
      const info = await previewDataset(f);
      handleFileAccepted(f, info);
    } catch {
      toast.error("Failed to parse the file. Ensure it is a valid CSV/Excel spreadsheet.");
    }
  };

  // ── Submissions ──

  const handleSubmit = async () => {
    if (!file || !question.trim() || isAnalyzing) return;
    const q = question.trim();
    setQuestion("");
    setIsAnalyzing(true);
    setStreamedThoughts([]);

    try {
      const response = await analyzeCSVStream(file, q, currentSessionId, (chunk) => {
        if (chunk.type === "thought" || chunk.type === "tool_end" || chunk.type === "info" || chunk.type === "error") {
          setStreamedThoughts((prev) => [...prev, chunk]);
        }
      });
      
      const newHistoryItem: AnalysisHistoryItem = {
        id: Math.random().toString(36).slice(2),
        question: q,
        response,
        timestamp: new Date(),
      };
      
      const updatedHistory = [...history, newHistoryItem];
      setHistory(updatedHistory);
      updateActiveSession({ history: updatedHistory });

      if (response.status === "error") {
        toast.error("Agent error", { style: { background: "#0f1623", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" } });
      } else {
        toast.success("Analysis complete!", { style: { background: "#0f1623", color: "#f0f6ff", border: "1px solid rgba(34,211,238,0.3)" } });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      toast.error(msg);
      
      const errorHistoryItem: AnalysisHistoryItem = {
        id: Math.random().toString(36).slice(2),
        question: q,
        response: { session_id: currentSessionId, status: "error", question: q, charts: [], iterations: 0, error: msg },
        timestamp: new Date(),
      };
      
      const updatedHistory = [...history, errorHistoryItem];
      setHistory(updatedHistory);
      updateActiveSession({ history: updatedHistory });
    } finally {
      setIsAnalyzing(false);
      setStreamedThoughts([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const activeSession = sessions.find(s => s.id === currentSessionId);
  const fileMetadata = activeSession?.fileMetadata;

  // ── JSON Exporter ──
  const exportSessionJson = () => {
    if (!activeSession) return;
    const blob = new Blob([JSON.stringify(activeSession, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `statbot-session-${activeSession.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoaded && !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] grid-bg relative p-6" style={{ height: "100dvh" }}>
        {/* Glowing ambient background effects */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[var(--cyan)]/10 blur-[150px] pointer-events-none animate-pulse-slow" />
        <div className="absolute bottom-1/3 left-1/3 w-[300px] h-[300px] rounded-full bg-[var(--violet)]/5 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md rounded-2xl border border-[var(--border-bright)] bg-[#0c1222]/90 backdrop-blur-2xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative z-10 animate-fade-up hover:border-[var(--cyan)]/25 transition-all duration-500">
          
          {/* Logo / Header */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[var(--cyan)]/10 border border-[var(--cyan)]/20 flex items-center justify-center text-[var(--cyan)] shadow-[0_0_20px_rgba(34,211,238,0.15)]">
              <Cpu size={26} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              StatBot <span className="text-[var(--cyan)]">Pro</span>
            </h2>
            <p className="text-xs text-[var(--text-secondary)] text-center font-medium max-w-[280px]">
              Autonomous CSV Data Analyst Agent
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-5">
            {authError && (
              <div className="p-3.5 rounded-xl border border-[var(--rose)]/20 bg-[var(--rose)]/5 text-xs text-[var(--rose)] text-center font-medium">
                {authError}
              </div>
            )}

            {/* Switch Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/3 rounded-xl border border-[var(--border)]">
              <button
                type="button"
                onClick={() => { setAuthMode("signin"); setAuthError(null); }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  authMode === "signin"
                    ? "bg-[var(--cyan)] text-black shadow-[0_2px_10px_rgba(34,211,238,0.2)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode("signup"); setAuthError(null); }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  authMode === "signup"
                    ? "bg-[var(--cyan)] text-black shadow-[0_2px_10px_rgba(34,211,238,0.2)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Sign Up
              </button>
            </div>

            <div className="space-y-4 pt-2">
              {authMode === "signup" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-white/2 border border-[var(--border)] hover:border-[var(--border-bright)] focus:border-[var(--cyan)]/50 rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-all focus:bg-white/5"
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">
                  {authMode === "signup" ? "Username" : "Username or Email"}
                </label>
                <input
                  type="text"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder={authMode === "signup" ? "johndoe" : "Username or Email"}
                  className="w-full bg-white/2 border border-[var(--border)] hover:border-[var(--border-bright)] focus:border-[var(--cyan)]/50 rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-all focus:bg-white/5"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/2 border border-[var(--border)] hover:border-[var(--border-bright)] focus:border-[var(--cyan)]/50 rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-all focus:bg-white/5"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full mt-6 py-3 bg-[var(--cyan)] hover:brightness-110 text-black font-semibold text-sm rounded-xl shadow-[0_4px_20px_rgba(34,211,238,0.25)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {authLoading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <span>{authMode === "signin" ? "Sign In" : "Create Account"}</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]" style={{ height: "100dvh", width: "100%" }}>
      
      {/* ── 1. ChatGPT Sidebar ── */}
      <div 
        className={`bg-[#0b0f19] border-r border-[var(--border)] flex flex-col h-full transition-all duration-300 flex-shrink-0 ${
          sidebarOpen ? "w-[260px]" : "w-0 overflow-hidden border-none"
        }`}
      >
        {/* Sidebar Header: New Chat */}
        <div className="p-3.5 flex items-center gap-2">
          <button 
            onClick={() => createNewSession()}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-white/10 hover:border-white/20 rounded-lg text-xs font-medium bg-white/3 hover:bg-white/6 text-[var(--text-primary)] cursor-pointer transition-colors"
          >
            <Plus size={14} className="text-[var(--cyan)]" />
            <span>New Chat</span>
          </button>
          
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            title="Close sidebar"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>

        {/* Sidebar Scroll List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          {sessions.map(s => {
            const isActive = s.id === currentSessionId;
            const isEditing = s.id === editingSessionId;

            return (
              <div 
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs cursor-pointer transition-all ${
                  isActive 
                    ? "bg-white/[0.06] text-[var(--text-primary)] font-medium border border-white/5" 
                    : "text-[var(--text-secondary)] hover:bg-white/3 hover:text-[var(--text-primary)]"
                }`}
              >
                {s.fileMetadata ? (
                  <FileSpreadsheet size={13} className={isActive ? "text-[var(--cyan)]" : "text-[var(--text-muted)]"} />
                ) : (
                  <MessageSquare size={13} className="text-[var(--text-muted)]" />
                )}

                {isEditing ? (
                  <input
                    type="text"
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    onBlur={() => saveTitle(s.id)}
                    onKeyDown={(e) => e.key === "Enter" && saveTitle(s.id)}
                    className="flex-1 bg-black/40 border border-[var(--cyan)]/30 rounded px-1.5 py-0.5 text-xs text-[var(--text-primary)] outline-none"
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span 
                    className="flex-1 truncate pr-1"
                    onDoubleClick={(e) => startEditing(s.id, s.title, e)}
                  >
                    {s.title}
                  </span>
                )}

                {/* Session Actions (Trash / Edit) */}
                {!isEditing && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startEditing(s.id, s.title, e)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded hover:bg-white/5"
                    >
                      <Edit3 size={11} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--rose)] rounded hover:bg-white/5"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}

                {isEditing && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); saveTitle(s.id); }}
                    className="p-1 text-[var(--cyan)] rounded hover:bg-white/5"
                  >
                    <Check size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* User Profile Info */}
        {user && (
          <div className="p-3 border-t border-[var(--border)] bg-white/2 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[var(--cyan)]/10 border border-[var(--cyan)]/20 flex items-center justify-center text-[var(--cyan)] font-bold text-xs uppercase flex-shrink-0">
                {user.username[0]}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{user.username}</p>
                <p className="text-[9px] text-[var(--text-muted)] truncate">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={handleSignOut}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--rose)] rounded-lg hover:bg-white/5 cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
          <span>v1.2 (Agentic)</span>
          <button 
            onClick={() => {
              if (confirm("Reset application history?")) {
                localStorage.removeItem("statbot_sessions");
                window.location.reload();
              }
            }}
            className="hover:text-[var(--rose)] transition-colors flex items-center gap-1 bg-transparent border-none cursor-pointer"
          >
            Clear Data
          </button>
        </div>
      </div>

      {/* ── 2. Main Work Area ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-base)] grid-bg relative">
        
        {/* Top Header */}
        <header className="h-14 border-b border-[var(--border)] backdrop-blur-md flex items-center justify-between px-6 flex-shrink-0 z-10 relative" style={{ backgroundColor: "rgba(5, 8, 15, 0.75)" }}>
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-white/5 transition-all mr-1 cursor-pointer"
                title="Open sidebar"
              >
                <PanelLeftOpen size={16} />
              </button>
            )}
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 shadow-sm"
                style={{ background: "linear-gradient(135deg,rgba(34,211,238,.2),rgba(167,139,250,.2))", border: "1px solid rgba(34,211,238,.3)" }}>
                <Cpu size={14} className="text-[var(--cyan)]" />
              </div>
              <span className="font-extrabold text-sm tracking-tight">
                StatBot<span className="gradient-text">Pro</span>
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 bg-white/5 px-1.5 py-1 rounded-xl border border-[var(--border)] ml-3">
              <span className="text-xs px-3 py-1 rounded-lg font-semibold bg-[var(--cyan)] text-black shadow-[0_2px_10px_rgba(34,211,238,0.2)] transition-all cursor-default">
                AI Agent
              </span>
              <Link href="/analytics" className="text-xs px-3 py-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
                BI Workspace
              </Link>
            </div>
          </div>

          {file && (
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-[var(--text-secondary)] font-mono">
              <FileSpreadsheet size={13} className="text-[var(--cyan)]" />
              <span>{file.name} · {formatSize(file.size)}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--emerald)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--emerald)] animate-pulse" />
              <span className="text-[var(--text-secondary)]">AI Analyst: Online</span>
            </div>
            
            <button className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg hover:bg-white/5 transition-all">
              <Sun size={15} />
            </button>
            <button className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg hover:bg-white/5 transition-all">
              <GitBranch size={15} />
            </button>

            {activeSession && activeSession.history.length > 0 && (
              <button 
                onClick={exportSessionJson}
                className="flex items-center gap-1 px-2.5 py-1 border border-white/10 hover:border-white/20 bg-white/3 hover:bg-white/6 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors cursor-pointer"
                title="Export session data as JSON"
              >
                <Download size={12} />
                <span>Export JSON</span>
              </button>
            )}
          </div>
        </header>

        {/* Chat Scroll Thread Container */}
        <div className="flex-1 overflow-y-auto w-full">
          <div className="max-w-[720px] w-full mx-auto px-6 py-8 space-y-8">
            
            {/* 1. If dataset is loaded and we have file details, show inline cards */}
            {file && datasetInfo && (
              <div className="space-y-6 animate-fade-in">
                {/* File status card */}
                <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border)] bg-[#0b0f19]/60 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--cyan)]/10 border border-[var(--cyan)]/20 flex items-center justify-center text-[var(--cyan)]">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{file.name}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-mono">
                        {datasetInfo.rows.toLocaleString()} rows · {formatSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setFile(null);
                      setDatasetInfo(null);
                      updateActiveSession({ fileMetadata: null, datasetInfo: null });
                      localStorage.removeItem("statbot_active_csv");
                      localStorage.removeItem("statbot_active_filename");
                    }}
                    className="p-2 text-[var(--text-muted)] hover:text-[var(--rose)] rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                    title="Remove dataset"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Expanded Dataset Profiler Card */}
                <DataPreview info={datasetInfo} />

                {/* Quick Start Queries (only shown if no chat history yet) */}
                {history.length === 0 && !isAnalyzing && (
                  <div className="space-y-3 pt-4 animate-fade-up">
                    <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-widest text-left">
                      Quick Start Queries
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {EXAMPLE_QUESTIONS.map((q) => (
                        <button 
                          key={q} 
                          onClick={() => { setQuestion(q); textareaRef.current?.focus(); }}
                          className="p-3 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-bright)] hover:border-[var(--cyan)]/30 bg-white/2 hover:bg-[var(--cyan)]/5 rounded-xl text-left cursor-pointer transition-all"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. If no file is loaded, show the initial setup screen */}
            {!file && (
              <div className="flex flex-col items-center justify-center text-center animate-fade-in space-y-8 py-12" style={{ minHeight: "calc(100vh - 112px)" }}>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--cyan)]/20 bg-[var(--cyan)]/5 text-[10px] font-semibold tracking-wider text-[var(--cyan)] uppercase">
                  <Sparkles size={10} />
                  <span>Advanced CSV Data Analyst</span>
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    Analyze spreadsheet datasets with <span className="gradient-text">StatBot Pro</span>
                  </h1>
                  <p className="text-sm text-[var(--text-secondary)] max-w-lg mx-auto leading-relaxed">
                    Upload your dataset and write questions in plain English. The AI agent executes your queries safely in a Python sandbox kernel.
                  </p>
                </div>

                {/* Standalone upload zone when no file exists */}
                {!fileMetadata ? (
                  <div className="w-full max-w-lg mx-auto">
                    <FileDropzone
                      onFileAccepted={handleFileAccepted}
                      onPreview={previewDataset}
                      isLoading={isAnalyzing}
                    />
                  </div>
                ) : (
                  /* File exists but needs re-upload */
                  <div className="p-5 rounded-2xl border border-[var(--amber)]/20 bg-[var(--amber)]/5 flex flex-col items-center gap-3.5 max-w-md mx-auto animate-fade-up">
                    <div className="w-10 h-10 rounded-xl bg-[var(--amber)]/10 flex items-center justify-center">
                      <Info size={18} className="text-[var(--amber)]" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">File re-upload required</p>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                        The session references <code>{fileMetadata.name}</code>. Please re-attach the file to execute queries.
                      </p>
                    </div>
                    <label className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--amber)] text-black font-semibold text-xs cursor-pointer hover:brightness-115 transition-all shadow-sm">
                      <Paperclip size={13} />
                      <span>Browse File</span>
                      <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleReuploadFile(f);
                      }} />
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Conversation Messages Feed */}
            {history.length > 0 && (
              <div className="space-y-6">
                {history.map((item) => (
                  <div key={item.id} className="space-y-4">
                    {/* User Prompt Bubble */}
                    <div className="flex items-start justify-end gap-3">
                      <div className="bg-[#242933] border border-white/5 rounded-2xl rounded-tr-sm p-3.5 max-w-[85%] shadow-sm">
                        <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{item.question}</p>
                        <span className="block text-[9px] text-[var(--text-muted)] font-mono mt-1 text-right">
                          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      {/* User Avatar */}
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-400 font-bold text-xs uppercase">
                        Me
                      </div>
                    </div>

                    {/* Bot Answer Response bubble */}
                    <div className="flex items-start gap-3">
                      {/* Bot Avatar */}
                      <div className="w-8 h-8 rounded-lg bg-[var(--cyan)]/10 border border-[var(--cyan)]/20 flex items-center justify-center flex-shrink-0 text-[var(--cyan)]">
                        <Cpu size={14} />
                      </div>
                      
                      {/* Analysis Results (markdown, charts, show-work toggles) */}
                      <div className="flex-1 min-w-0">
                        <AnalysisResult result={item.response} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Live Streaming Thoughts feedback */}
            {isAnalyzing && (
              <div className="space-y-3">
                <AgentThinking streamedThoughts={streamedThoughts} />
              </div>
            )}

            <div ref={bottomRef} className="h-4" />
          </div>
        </div>

        {/* Bottom Chat Input Bar Section */}
        {datasetInfo && (
          <div className="border-t border-[var(--border)] backdrop-blur-md w-full px-6 py-4 flex-shrink-0 z-10" style={{ backgroundColor: "rgba(5, 8, 15, 0.9)" }}>
            <div className="max-w-[720px] w-full mx-auto">
              
              {/* If file is metadata-only (needs re-upload) display inline alert */}
              {fileMetadata && !file && (
                <div className="p-3.5 border border-[var(--amber)]/20 bg-[var(--amber)]/5 rounded-xl text-xs flex items-center justify-between gap-4 mb-3 animate-fade-up">
                  <div className="flex items-center gap-2.5 text-[var(--text-secondary)]">
                    <Info size={14} className="text-[var(--amber)] flex-shrink-0" />
                    <span>Spreadsheet file <code>{fileMetadata.name}</code> has timed out. Re-upload it to ask questions.</span>
                  </div>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--amber)] text-black font-semibold text-2xs cursor-pointer hover:brightness-110 transition-all flex-shrink-0">
                    <Paperclip size={11} />
                    <span>Upload</span>
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleReuploadFile(f);
                    }} />
                  </label>
                </div>
              )}

              {/* Standard ChatGPT-style attachment box wrapper - ALWAYS VISIBLE */}
              <div className="relative border border-[var(--border-bright)] focus-within:border-[var(--cyan)]/40 rounded-2xl bg-[var(--bg-elevated)] p-2.5 flex flex-col gap-2 transition-all shadow-sm focus-within:shadow-[0_0_20px_rgba(34,211,238,0.06)]">
                
                {/* File badge thumbnail attached */}
                {file && (
                  <div className="flex items-center gap-2 p-1.5 px-2.5 rounded-xl border border-[var(--emerald)]/20 bg-[var(--emerald)]/5 text-2xs w-fit max-w-xs animate-fade-in">
                    <FileSpreadsheet size={13} className="text-[var(--cyan)]" />
                    <span className="truncate max-w-[150px] font-medium text-[var(--text-primary)]">{file.name}</span>
                    <button 
                      onClick={() => {
                        setFile(null);
                        setDatasetInfo(null);
                        updateActiveSession({ fileMetadata: null, datasetInfo: null });
                        localStorage.removeItem("statbot_active_csv");
                        localStorage.removeItem("statbot_active_filename");
                      }} 
                      className="p-0.5 text-[var(--text-muted)] hover:text-[var(--rose)] transition-colors cursor-pointer"
                      title="Remove attachment"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  {/* Attachment trigger */}
                  <label 
                    className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-xl hover:bg-white/5 cursor-pointer flex items-center justify-center flex-shrink-0 transition-colors"
                    title="Attach spreadsheet (.csv, .xlsx)"
                  >
                    <Paperclip size={15} />
                    <input 
                      type="file" 
                      accept=".csv,.xlsx,.xls" 
                      className="hidden" 
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleReuploadFile(f);
                      }} 
                      disabled={isAnalyzing} 
                    />
                  </label>

                  {/* Auto-growing Text Input field */}
                  <textarea
                    ref={textareaRef}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isAnalyzing || !file}
                    rows={1}
                    placeholder={file ? "Ask a question about your data... (⌘K to focus)" : "Please upload dataset to ask questions..."}
                    className="flex-1 auto-textarea text-xs py-1.5 px-1 leading-relaxed max-h-32 overflow-y-auto"
                    style={{ border: "none" }}
                  />

                  {/* Submit icon */}
                  <button
                    onClick={handleSubmit}
                    disabled={!question.trim() || isAnalyzing || !file}
                    className={`p-2 rounded-xl flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                      question.trim() && !isAnalyzing && file
                        ? "bg-[var(--cyan)] text-[#05080f] hover:brightness-110 shadow-sm"
                        : "bg-white/5 text-[var(--text-muted)] cursor-not-allowed"
                    }`}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-2.5 px-1 font-mono">
                <span>⏎ Send  ·  ⇧+⏎ New line  ·  ⌘K Focus</span>
                <span>
                  {question.length > 0 ? (
                    <span className={question.length > 420 ? "text-[var(--amber)]" : ""}>
                      {question.length}/500 chars  ·  
                    </span>
                  ) : null}
                  Sandboxed  ·  Session {currentSessionId ? currentSessionId.slice(0, 6) : "none"}
                </span>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* ── 3. Dataset Sheet Grid Modal (ChatGPT feature) ── */}
      {showPreviewModal && datasetInfo && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4"
          onClick={() => setShowPreviewModal(false)}
        >
          <div 
            className="bg-[var(--bg-elevated)] border border-[var(--border-bright)] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={15} className="text-[var(--cyan)]" />
                <span className="font-semibold text-xs text-[var(--text-primary)]">
                  Dataset Inspector: {fileMetadata?.name}
                </span>
                <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-[var(--text-secondary)]">
                  {datasetInfo.rows.toLocaleString()} rows × {datasetInfo.columns} columns
                </span>
              </div>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-lg hover:bg-white/5"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-5">
              <DataPreview info={datasetInfo} />
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-[var(--border)] bg-black/10 flex items-center justify-between text-2xs text-[var(--text-muted)] font-mono">
              <span>Previewing top sample rows</span>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-[var(--text-primary)] rounded-lg font-medium transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
