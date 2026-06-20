"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Layers, 
  Users, 
  Activity, 
  Shield, 
  Sparkles, 
  Send, 
  Trash2, 
  UserPlus, 
  Lock,
  LineChart,
  CheckCircle,
  HelpCircle,
  FileText,
  AlertTriangle,
  MessageSquare,
  GraduationCap,
  Layout,
  Presentation,
  Search,
  Bot,
  Folder,
  Code,
  Mic,
  Upload
} from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/workspaceStore";
import { useAuthStore } from "@/lib/store/authStore";
import { useUIStore, CompanionState } from "@/lib/store/uiStore";
import LiquidGlassCard from "@/components/ui/LiquidGlassCard";
import Puppy3D from "@/components/workspace/Puppy3D";
import Dock from "@/components/workspace/Dock";
import { parseFile } from "@/lib/utils/fileParser";

type DashboardTab = "overview" | "team" | "analytics" | "admin";

// High-Performance Interactive SVG Line/Area Chart
function SVGSpikeChart() {
  const data = [
    { time: "6h ago", value: 120 },
    { time: "5h ago", value: 240 },
    { time: "4h ago", value: 180 },
    { time: "3h ago", value: 450 },
    { time: "2h ago", value: 310 },
    { time: "1h ago", value: 580 },
    { time: "Just now", value: 420 }
  ];
  const maxVal = 600;
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const chartWidth = 500;
  const chartHeight = 130;
  const padding = 20;

  // Map points to SVG coordinate space
  const points = data.map((d, idx) => {
    const x = padding + (idx / (data.length - 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - (d.value / maxVal) * (chartHeight - padding * 2);
    return { x, y, ...d };
  });

  // Generate SVG path string
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`;

  return (
    <div className="relative w-full h-40 pt-4" onMouseLeave={() => setHoveredIdx(null)}>
      <svg 
        viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
        className="w-full h-full overflow-visible select-none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * chartWidth;
          const y = ((e.clientY - rect.top) / rect.height) * chartHeight;
          
          // Find closest point
          let closestIdx = 0;
          let minDist = Infinity;
          points.forEach((p, idx) => {
            const dist = Math.abs(p.x - x);
            if (dist < minDist) {
              minDist = dist;
              closestIdx = idx;
            }
          });
          setHoveredIdx(closestIdx);
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
      >
        <defs>
          {/* Gradient for area fill */}
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3D4833" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#3D4833" stopOpacity="0.00" />
          </linearGradient>
          {/* Gradient for line stroke */}
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3D4833" />
            <stop offset="50%" stopColor="#E0D6C6" />
            <stop offset="100%" stopColor="#E5DDD0" />
          </linearGradient>
          {/* Glow filter */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = padding + p * (chartHeight - padding * 2);
          return (
            <line 
              key={i} 
              x1={padding} 
              y1={y} 
              x2={chartWidth - padding} 
              y2={y} 
              stroke="rgba(251, 245, 221, 0.04)" 
              strokeWidth="1" 
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Area Path */}
        <path d={areaPath} fill="url(#areaGradient)" />

        {/* Line Path */}
        <path 
          d={linePath} 
          fill="none" 
          stroke="url(#lineGradient)" 
          strokeWidth="2" 
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />

        {/* Hover Line */}
        {hoveredIdx !== null && (
          <line 
            x1={points[hoveredIdx].x} 
            y1={padding} 
            x2={points[hoveredIdx].x} 
            y2={chartHeight - padding} 
            stroke="rgba(231, 225, 177, 0.3)" 
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        )}

        {/* Data Points */}
        {points.map((p, idx) => (
          <circle 
            key={idx}
            cx={p.x} 
            cy={p.y} 
            r={hoveredIdx === idx ? 5 : 3} 
            fill={hoveredIdx === idx ? "#FBF5DD" : "#3D4833"} 
            stroke="#041E05" 
            strokeWidth="1.5"
            className="transition-all duration-150"
          />
        ))}

        {/* X Axis Labels */}
        {points.map((p, idx) => (
          <text 
            key={idx} 
            x={p.x} 
            y={chartHeight - 2} 
            textAnchor="middle" 
            fill="rgba(251, 245, 221, 0.4)" 
            fontSize="8" 
            fontFamily="monospace"
          >
            {p.time}
          </text>
        ))}
      </svg>

      {/* Floating HTML Tooltip */}
      {hoveredIdx !== null && (
        <div 
          className="absolute pointer-events-none rounded-lg border border-[#FBF5DD]/10 bg-[#041E05]/95 backdrop-blur-md px-3 py-1.5 shadow-xl text-left flex flex-col z-20 transition-all duration-75"
          style={{ 
            left: `${mousePos.x + 12}px`, 
            top: `${mousePos.y - 45}px`,
            transform: "translate(-50%, -50%)"
          }}
        >
          <span className="text-[8px] font-mono text-[#FBF5DD]/50 uppercase">{data[hoveredIdx].time}</span>
          <span className="text-xs font-bold text-[#FBF5DD] font-mono">{data[hoveredIdx].value} queries</span>
        </div>
      )}
    </div>
  );
}



export default function WorkspaceDashboard() {
  const { 
    files, 
    deleteFile, 
    activeWorkspaceId, 
    workspaces, 
    addFileToWorkspace, 
    activeFolderId 
  } = useWorkspaceStore();
  const { 
    user, 
    teamMembers, 
    activityLogs, 
    inviteTeamMember, 
    removeTeamMember, 
    clearActivityLogs,
    upgradeSubscription,
    addActivityLog
  } = useAuthStore();
  
  const setActiveModule = useUIStore((s) => s.setActiveModule);

  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");

  // File upload states
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const formatJoinedDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString("en-US", { month: "short" });
    return `${month} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const parsed = await parseFile(file);
      
      // Determine folder ID based on file type / context
      let targetFolderId = activeFolderId;
      if (!targetFolderId) {
        if (parsed.type === "pdf") {
          targetFolderId = "folder-careers"; // Resumes & Applications folder
        } else {
          targetFolderId = "folder-research"; // Web Research Reports folder
        }
      }

      addFileToWorkspace({
        name: parsed.name,
        type: parsed.type,
        size: parsed.size,
        content: parsed.content,
        folderId: targetFolderId,
      });
      
      addActivityLog("Uploaded file", `File: ${file.name} to ${targetFolderId === "folder-careers" ? "careers" : "research"}`);
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "Failed to upload and parse file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const userName = user?.fullName ? user.fullName.split(" ")[0] : "User";

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "Just now";
    }
  };

  const getLogIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("search") || act.includes("research")) return Search;
    if (act.includes("analysis") || act.includes("analyze") || act.includes("report")) return LineChart;
    if (act.includes("deck") || act.includes("slide") || act.includes("ppt")) return Presentation;
    if (act.includes("website") || act.includes("design") || act.includes("page")) return Code;
    if (act.includes("resume") || act.includes("pdf") || act.includes("file") || act.includes("upload")) return FileText;
    if (act.includes("login") || act.includes("logout")) return Users;
    return Activity;
  };

  const getLogDotColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("success") || act.includes("saved") || act.includes("completed") || act.includes("upload") || act.includes("initialize")) return "bg-emerald-600";
    if (act.includes("fail") || act.includes("error")) return "bg-red-600";
    return "bg-amber-600";
  };

  const [bubbleTitle, setBubbleTitle] = useState("Hi! 👋");
  const [bubbleText, setBubbleText] = useState("I'm Newton, your AI companion.\nI'm here to help you with anything!");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setBubbleTitle(`Hi ${userName}! 👋`);
  }, [userName]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Cleanup mock team members and ensure owner is correctly set to logged-in user
  useEffect(() => {
    if (!user) return;
    const mockEmails = ["admin@neuroflow.ai", "member1@cdac.in", "developer@neuroflow.ai"];
    const hasMock = teamMembers.some(m => mockEmails.includes(m.email));
    const hasCorrectOwner = teamMembers.some(m => m.role === "owner" && m.email === user.email);
    
    if (hasMock || !hasCorrectOwner) {
      const filtered = teamMembers.filter(m => !mockEmails.includes(m.email));
      const rest = filtered.filter(m => m.role !== "owner");
      const updated = [
        {
          id: user.id,
          email: user.email,
          role: "owner" as const,
          status: "active" as const,
          joinedAt: user.createdAt || new Date().toISOString()
        },
        ...rest
      ];
      useAuthStore.setState({ teamMembers: updated });
    }
  }, [teamMembers, user]);

  const triggerExpression = (mood: CompanionState, title: string, text: string) => {
    const store = useUIStore.getState();
    store.setCompanionState(mood);
    setBubbleTitle(title);
    setBubbleText(text);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      store.setCompanionState("idle");
      setBubbleTitle(`Hi ${userName}! 👋`);
      setBubbleText("I'm Newton, your AI companion.\nI'm here to help you with anything!");
    }, 4500);
  };

  const handlePuppyClick = () => {
    const store = useUIStore.getState();
    if (store.companionState === "sleeping") {
      triggerExpression("idle", "Good morning! ☀️", "Yawn... I'm awake and ready to code!");
      return;
    }
    const clickStates: CompanionState[] = ["happy", "naughty", "excited", "confused", "thinking"];
    const randomState = clickStates[Math.floor(Math.random() * clickStates.length)];
    
    const stateTextMap: Record<string, { title: string; text: string }> = {
      happy: { title: "Happy Doggo! 😊", text: "Bark bark! I love this warm beige look! Feels so premium." },
      naughty: { title: "Naughty Newton! 🤪", text: "Haha! Let's write some buggy code? Just kidding, woof!" },
      excited: { title: "Super Excited! ⚡", text: "Yes! Let's build something awesome today. Click the quick actions!" },
      confused: { title: "Hmm? 🧐", text: "Are we doing deep research audits? Or study mode? I'm ready!" },
      thinking: { title: "Calculating... 🧠", text: "I'm optimizing the workspace. CPU temperature within safe limits." },
    };
    
    const selected = stateTextMap[randomState] || stateTextMap.happy;
    triggerExpression(randomState, selected.title, selected.text);
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail.trim()) {
      inviteTeamMember(inviteEmail.trim(), inviteRole);
      setInviteEmail("");
    }
  };

  const activeWs = workspaces.find(w => w.id === activeWorkspaceId);

  // Filter files in this workspace
  const workspaceFiles = files.filter(f => {
    if (activeWorkspaceId === "personal-ws") {
      return f.folderId === "folder-careers" || f.folderId === "folder-research" || !f.folderId;
    }
    return f.folderId === "folder-slides" || !f.folderId;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent border border-[#3D4833]/[0.08] rounded-2xl relative overflow-hidden font-sans text-[#2A3226]">
      
      {/* Tab selectors header */}
      <div className="h-16 border-b border-[#3D4833]/[0.08] px-6 flex items-center justify-between bg-black/5 shrink-0">
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`px-4.5 py-2.5 rounded-lg text-[13.5px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === "overview" ? 'bg-[#F0E8DC] text-[#3D4833] border border-[#3D4833]/10 shadow-sm' : 'text-[#2A3226]/65 hover:text-[#2A3226]'}`}
          >
            <Layers className="h-4 w-4" />
            <span>Overview</span>
          </button>
          
          <button 
            onClick={() => setActiveTab("team")}
            className={`px-4.5 py-2.5 rounded-lg text-[13.5px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === "team" ? 'bg-[#F0E8DC] text-[#3D4833] border border-[#3D4833]/10 shadow-sm' : 'text-[#2A3226]/65 hover:text-[#2A3226]'}`}
          >
            <Users className="h-4 w-4" />
            <span>Team Sharing</span>
          </button>

          <button 
            onClick={() => setActiveTab("analytics")}
            className={`px-4.5 py-2.5 rounded-lg text-[13.5px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === "analytics" ? 'bg-[#F0E8DC] text-[#3D4833] border border-[#3D4833]/10 shadow-sm' : 'text-[#2A3226]/65 hover:text-[#2A3226]'}`}
          >
            <LineChart className="h-4 w-4" />
            <span>Analytics</span>
          </button>

          {user && user.role === "admin" && (
            <button 
              onClick={() => setActiveTab("admin")}
              className={`px-4.5 py-2.5 rounded-lg text-[13.5px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === "admin" ? 'bg-[#F0E8DC] text-[#3D4833] border border-[#3D4833]/10 shadow-sm' : 'text-[#2A3226]/65 hover:text-[#2A3226]'}`}
            >
              <Shield className="h-4 w-4" />
              <span>Admin Console</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F0E8DC] border border-[#3D4833]/8 shadow-sm">
          <span className="text-[11px] font-bold text-[#2A3226] font-display">Active Space: {activeWs?.name}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 shrink-0" />
        </div>
      </div>

      {/* Main Workspace Panels */}
      <div className="flex-1 overflow-hidden p-4 flex flex-col gap-4 h-[calc(100%-4rem)]">
        
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch h-full overflow-hidden">
            
            {/* Left Big Column: Files list, Quick Actions, Newton Companion & Bottom Dock */}
            <div className="lg:col-span-2 flex flex-col gap-3 h-full overflow-y-auto pr-1 scrollbar-thin justify-start">
              
              {/* Files panel */}
              <LiquidGlassCard 
                material="frosted" 
                containerClassName={workspaceFiles.length === 0 ? "flex-1 min-h-[130px] max-h-[195px] relative" : "flex-1 max-h-[260px] min-h-[130px] relative"} 
                className="p-4 flex flex-col gap-3"
                innerClassName="h-full flex flex-col"
              >
                {/* Upload Spinner Overlay */}
                {isUploading && (
                  <div className="absolute inset-0 bg-[#F5EFE4]/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-30 rounded-2xl">
                    <div className="w-6 h-6 rounded-full border-2 border-[#3D4833] border-t-transparent animate-spin" />
                    <span className="text-[11px] font-bold text-[#2A3226]">Extracting document...</span>
                  </div>
                )}

                {/* Drag Drop Overlay */}
                {dragActive && (
                  <div 
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className="absolute inset-0 bg-[#3D4833]/15 border-2 border-dashed border-[#3D4833]/40 rounded-2xl flex flex-col items-center justify-center gap-1 z-40 backdrop-blur-xs pointer-events-auto cursor-copy"
                  >
                    <Upload className="h-6 w-6 text-[#3D4833] animate-bounce" />
                    <span className="text-xs font-bold text-[#3D4833]">Drop files to upload</span>
                  </div>
                )}

                <div className="flex items-center justify-between border-b border-[#3D4833]/10 pb-2">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="font-display text-[15px] font-bold text-[#2A3226]">Workspace Files</h3>
                    <span className="text-[9px] font-bold text-[#3D4833]/60 font-mono uppercase tracking-[0.12em]">MANAGEMENT ({workspaceFiles.length})</span>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-lg border border-[#3D4833]/15 hover:border-[#3D4833]/35 bg-[#F0E8DC] hover:bg-black/5 text-[#3D4833] flex items-center gap-1 text-[10px] font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload</span>
                  </button>
                </div>

                <input 
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.xlsx,.xls,.txt,.csv,.md,.json"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                />

                {uploadError && (
                  <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] font-semibold text-red-700 text-center animate-fade-in">
                    {uploadError}
                  </div>
                )}
                
                {workspaceFiles.length === 0 ? (
                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 border border-[#3D4833]/8 rounded-2xl bg-[#F0E8DC]/45 hover:bg-[#F0E8DC]/85 hover:border-[#3D4833]/20 p-4 flex flex-col items-center justify-center text-center shadow-sm cursor-pointer transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#F0E8DC] border border-[#3D4833]/8 flex items-center justify-center mb-2 shadow-sm shrink-0">
                      <Folder className="h-4.5 w-4.5 text-[#3D4833]" />
                    </div>
                    <span className="text-[12px] font-bold text-[#2A3226]">No files in this workspace folder</span>
                    <span className="text-[9.5px] text-[#2A3226]/60 font-medium mt-0.5">Drag & drop files here or click to upload</span>
                  </div>
                ) : (
                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 scrollbar-thin"
                  >
                    {workspaceFiles.map((file) => (
                      <div 
                        key={file.id} 
                        className="group/file flex items-center justify-between p-2 rounded-lg border border-[#3D4833]/[0.08] bg-black/5 text-xs hover:border-[#3D4833]/40 transition-all"
                      >
                        <div className="flex items-center gap-2 truncate">
                           <FileText className="h-4 w-4 text-[#3D4833] shrink-0" />
                          <div className="flex flex-col truncate">
                            <span className="font-bold text-[#2A3226] truncate">{file.name}</span>
                            <span className="text-[8px] font-mono text-[#2A3226]/50 uppercase tracking-wide">{file.type} • {file.size || "Unknown"}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteFile(file.id)}
                          className="opacity-0 group-hover/file:opacity-100 text-[#2A3226]/45 hover:text-red-600 p-1 transition-opacity cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </LiquidGlassCard>
 
              {/* Quick Actions Panel */}
              <LiquidGlassCard material="frosted" containerClassName="shrink-0" className="p-4">
                <h3 className="font-display text-[15px] font-bold text-[#2A3226] block mb-3 text-left">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { name: "AI Chat", desc: "Chat with AI assistant", module: "chat" as const, icon: MessageSquare },
                    { name: "Search Report", desc: "Find insights & data", module: "research" as const, icon: Search },
                    { name: "Resume Intel", desc: "Smart resume analysis", module: "resume" as const, icon: FileText },
                    { name: "Study Mode", desc: "Focus & learn better", module: "study" as const, icon: GraduationCap },
                    { name: "Website Designer", desc: "Create web projects", module: "website" as const, icon: Layout },
                    { name: "Slides Builder", desc: "AI presentation maker", module: "presentation" as const, icon: Presentation }
                  ].map((act) => (
                    <button 
                      key={act.module}
                      onClick={() => setActiveModule(act.module)} 
                      className="flex items-center gap-3 p-2 rounded-2xl border border-[#3D4833]/6 bg-[#E0D6C6] hover:bg-[#F0E8DC] hover:border-[#3D4833]/20 text-left hover:scale-[1.01] hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer w-full h-14"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#F0E8DC] border border-[#3D4833]/8 flex items-center justify-center shrink-0 shadow-sm text-[#3D4833]">
                        <act.icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex flex-col min-w-0 truncate">
                        <span className="text-[11.5px] font-bold text-[#2A3226] leading-tight truncate">{act.name}</span>
                        <span className="text-[9px] text-[#2A3226]/65 leading-tight truncate mt-0.5">{act.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </LiquidGlassCard>
 
              {/* Newton 3D Companion Rug Area & Dialogue Bubble */}
              <div className="flex items-center gap-5 relative shrink-0 h-28 flex-row">
                
                {/* 3D Newton and Rug */}
                <div 
                  onClick={handlePuppyClick}
                  className="relative w-28 h-28 flex items-center justify-center shrink-0 cursor-pointer hover:scale-[1.03] active:scale-95 transition-transform"
                  title="Click me to trigger expressions!"
                >
                  {/* Shadow rug below dog */}
                  <div className="absolute bottom-1 w-22 h-4 bg-[#3D4833]/8 blur-xs rounded-full z-0" />
                  {/* 3D Newton dog Canvas */}
                  <div className="w-full h-full relative z-10">
                    <Puppy3D className="w-full h-full" />
                  </div>
                </div>

                {/* Chat Speech Bubble */}
                <div className="flex-1 h-28 rounded-2xl border border-[#3D4833]/12 bg-[#F0E8DC] p-3 shadow-sm relative flex flex-col justify-between items-start">
                  {/* Bubble arrow pointing left */}
                  <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-3.5 h-3.5 bg-[#F0E8DC] border-l border-b border-[#3D4833]/12 transform rotate-45" />
                  
                  <div className="flex flex-col text-left">
                    <span className="text-[13px] font-bold text-[#2A3226]">{bubbleTitle}</span>
                    <span className="text-[11px] text-[#2A3226]/80 mt-1 leading-relaxed whitespace-pre-line">
                      {bubbleText}
                    </span>
                  </div>

                  {/* Quick feelings interactions row */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 w-full">
                    <button 
                      onClick={() => triggerExpression("excited", "Aww, tickles! 🐾", `${userName} petted me! Tail wagging at maximum speed! Woof!`)}
                      className="px-2 py-1 rounded-lg bg-[#3D4833]/8 hover:bg-[#3D4833] text-[#3D4833] hover:text-[#F5EFE4] text-[10px] font-semibold border border-[#3D4833]/10 transition-all cursor-pointer flex items-center gap-0.5 shadow-sm"
                      title="Pet Newton"
                    >
                      <span>🐾 Pet</span>
                    </button>
                    <button 
                      onClick={() => triggerExpression("eating", "Crunch Crunch! 🍖", "Yum! A delicious low-poly code bone treat. Thank you!")}
                      className="px-2 py-1 rounded-lg bg-[#3D4833]/8 hover:bg-[#3D4833] text-[#3D4833] hover:text-[#F5EFE4] text-[10px] font-semibold border border-[#3D4833]/10 transition-all cursor-pointer flex items-center gap-0.5 shadow-sm"
                      title="Feed Newton"
                    >
                      <span>🍖 Treat</span>
                    </button>
                    <button 
                      onClick={() => triggerExpression("spinning", "Wheee! 🌀", "Look at me! Running in circles and spinning my tail like a helicopter!")}
                      className="px-2 py-1 rounded-lg bg-[#3D4833]/8 hover:bg-[#3D4833] text-[#3D4833] hover:text-[#F5EFE4] text-[10px] font-semibold border border-[#3D4833]/10 transition-all cursor-pointer flex items-center gap-0.5 shadow-sm"
                      title="Train a trick"
                    >
                      <span>🌀 Trick</span>
                    </button>
                    <button 
                      onClick={() => {
                        const store = useUIStore.getState();
                        const isCurrentlySleeping = store.companionState === "sleeping";
                        if (isCurrentlySleeping) {
                          triggerExpression("idle", "Good morning! ☀️", "Yawn... I'm awake and ready to code!");
                        } else {
                          store.setCompanionState("sleeping");
                          setBubbleTitle("Zzz... 💤");
                          setBubbleText("Newton is napping in safe mode.\nClick me or the Pet button to wake me up!");
                          if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        }
                      }}
                      className="px-2 py-1 rounded-lg bg-[#3D4833]/8 hover:bg-[#3D4833] text-[#3D4833] hover:text-[#F5EFE4] text-[10px] font-semibold border border-[#3D4833]/10 transition-all cursor-pointer flex items-center gap-0.5 shadow-sm"
                      title="Put Newton to sleep"
                    >
                      <span>💤 Sleep</span>
                    </button>
                    <button 
                      onClick={() => setActiveModule("chat")}
                      className="ml-auto px-2.5 py-1 rounded-lg bg-[#3D4833] hover:bg-[#2A3226] text-[#F5EFE4] text-[10px] font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-0.5"
                    >
                      <span>Chat 💬</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Floating bottom dock centered below the Newton area */}
              <div className="flex justify-center mt-auto py-1 shrink-0">
                <Dock inline={true} />
              </div>

            </div>

            {/* Right Column: Activity Logs, Billing & Voice Panel */}
            <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1 scrollbar-thin justify-start">
              
              {/* Workspace Activity Logs Card */}
              <LiquidGlassCard material="frosted" containerClassName="flex-1 min-h-0" className="p-4 flex flex-col gap-3" innerClassName="h-full flex flex-col">
                <div className="flex items-center justify-between border-b border-[#3D4833]/10 pb-2">
                  <div className="flex flex-col">
                    <span className="text-[10.5px] font-bold text-[#3D4833]/60 font-mono uppercase tracking-[0.15em]">WORKSPACE ACTIVITY</span>
                  </div>
                  <button onClick={clearActivityLogs} className="text-[10px] text-[#2A3226]/50 hover:text-[#3D4833] font-mono uppercase cursor-pointer">Clear</button>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 scrollbar-thin">
                  {activityLogs.slice(0, 10).map((log) => {
                    const LogIcon = getLogIcon(log.action);
                    return (
                      <div key={log.id} className="flex gap-2.5 text-xs text-[#2A3226] items-center justify-between py-1 border-b border-[#3D4833]/5 last:border-b-0">
                        <div className="w-9 h-9 rounded-full bg-[#F0E8DC] border border-[#3D4833]/8 flex items-center justify-center shadow-sm shrink-0">
                          <LogIcon className="h-4 w-4 text-[#3D4833]" />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-1.5 font-bold text-[#2A3226] text-[12.5px] leading-tight">
                            <span className={`w-1.5 h-1.5 rounded-full ${getLogDotColor(log.action)} shrink-0`} />
                            <span className="truncate">{log.action}</span>
                          </div>
                          {log.details && <span className="text-[9.5px] text-[#2A3226]/60 mt-0.5 font-medium truncate">{log.details}</span>}
                        </div>
                        <span className="text-[9.5px] font-mono text-[#2A3226]/50 shrink-0 self-center">{formatTime(log.timestamp)}</span>
                      </div>
                    );
                  })}
                  {activityLogs.length === 0 && (
                    <div className="my-auto text-center text-[#2A3226]/50 italic text-xs py-8">
                      No recent activity events
                    </div>
                  )}
                </div>

                <div className="h-[1px] bg-[#3D4833]/10 my-1" />
                <button 
                  onClick={() => setActiveModule("chat")}
                  className="w-full flex items-center justify-between text-left text-[#2A3226] hover:text-[#3D4833] text-[13px] font-semibold py-1 px-1 cursor-pointer"
                >
                  <span>View all activity</span>
                  <span className="text-[14px] font-mono text-[#2A3226]/65">&gt;</span>
                </button>
              </LiquidGlassCard>

              {/* Stripe Billing / Subscription Plan Card */}
              <LiquidGlassCard material="crystal" containerClassName="shrink-0" className="p-4 flex flex-col gap-2.5 shadow-md">
                <div className="flex justify-between items-center">
                  <span className="text-[9.5px] font-bold text-[#3D4833]/60 font-mono uppercase tracking-[0.15em]">SUBSCRIPTION PLAN</span>
                  <span className="px-2 py-0.5 rounded bg-[#3D4833]/10 text-[#3D4833] text-[9px] font-bold font-mono">
                    {user?.plan === "pro" ? "PRO" : user?.plan === "enterprise" ? "ENTERPRISE" : "FREE"}
                  </span>
                </div>
                
                <span className="font-display text-[15px] font-bold text-[#2A3226] text-left">
                  {user?.plan === "pro" ? "Pro Workspace" : user?.plan === "enterprise" ? "Enterprise" : "Free Workspace"}
                </span>
                
                {/* Plan details */}
                <div className="text-[10px] text-[#6B7365] space-y-0.5">
                  <p>• {user?.plan === "free" ? "5" : "20"} PPT generations / day</p>
                  <p>• {user?.plan === "free" ? "5" : "20"} Website generations / day</p>
                  <p>• {user?.plan === "free" ? "50" : "500"} AI messages / day</p>
                </div>

                {user?.plan === "free" ? (
                  <button 
                    type="button"
                    onClick={() => {
                      useUIStore.getState().setShowPricingModalOnProfile(true);
                      setActiveModule("profile");
                    }}
                    className="w-full py-2 rounded-xl bg-[#3D4833] hover:bg-[#2A3226] text-[#F5EFE4] text-[11px] font-bold shadow-md transition-all cursor-pointer"
                  >
                    ✨ Upgrade to Pro (Free for 1 Year)
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={() => {
                      useUIStore.getState().setShowPricingModalOnProfile(true);
                      setActiveModule("profile");
                    }}
                    className="w-full py-2 rounded-xl border border-[#3D4833]/20 hover:border-[#3D4833]/40 text-[#3D4833] bg-[#3D4833]/5 hover:bg-[#3D4833]/10 text-[11px] font-semibold text-center shadow-sm transition-all cursor-pointer"
                  >
                    Manage Subscription
                  </button>
                )}
              </LiquidGlassCard>

              {/* Newton Voice Widget */}
              <div className="rounded-2xl border border-[#3D4833]/10 bg-[#F0E8DC]/60 backdrop-blur-xl p-3 h-16 shrink-0 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-[#3D4833]/10 bg-[#F0E8DC] relative shrink-0">
                    <Puppy3D headOnly className="w-full h-full" />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-600 border border-white" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[12.5px] font-bold text-[#2A3226] leading-none">Listening...</span>
                    <span className="text-[9.5px] text-[#2A3226]/65 mt-1 leading-none">Click to talk</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("newton-mic-trigger"));
                  }}
                  className="w-9 h-9 rounded-full border border-emerald-800/20 bg-[#F0E8DC]/80 hover:bg-[#F0E8DC] flex items-center justify-center text-emerald-800 shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <Mic className="h-4.5 w-4.5" />
                </button>
              </div>

            </div>

          </div>
        )}

        {/* TEAM SHARING TAB */}
        {activeTab === "team" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start h-full overflow-y-auto pr-1.5 scrollbar-thin">
            
            {/* Left Invite Form panel (1/3 space) */}
            <LiquidGlassCard material="frosted" className="p-5">
              <span className="text-[11px] font-bold text-[#E0D6C6]/65 font-mono uppercase tracking-[0.15em] block mb-4">Invite Team Member</span>
              <form onSubmit={handleInviteSubmit} className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold font-mono uppercase text-[#FBF5DD]/45">Email Address</label>
                  <input 
                    type="email"
                    required
                    placeholder="colleague@neuroflow.ai"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="text-xs p-2.5 bg-[#041E05]/95 border border-[#FBF5DD]/10 rounded-lg outline-none text-white focus:border-[#E0D6C6]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold font-mono uppercase text-[#FBF5DD]/45">Membership Role</label>
                  <select 
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                    className="text-xs p-2 bg-[#041E05]/95 border border-[#FBF5DD]/10 rounded-lg outline-none text-white focus:border-[#E0D6C6]"
                  >
                    <option value="member" className="bg-[#041E05] text-white">Workspace Member</option>
                    <option value="admin" className="bg-[#041E05] text-white">Workspace Admin</option>
                  </select>
                </div>

                <button 
                  type="submit"
                  className="w-full mt-2 py-2.5 rounded-full bg-[#1c351f] hover:bg-[#2d5231] text-[#F5EFE4] text-xs font-bold text-center flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Send Invitation</span>
                </button>
              </form>
            </LiquidGlassCard>

            {/* Right Team members list (2/3 space) */}
            <LiquidGlassCard material="frosted" className="md:col-span-2 p-5 flex flex-col gap-4">
              <span className="text-[11px] font-bold text-[#E0D6C6]/65 font-mono uppercase block border-b border-[#FBF5DD]/10 pb-2 tracking-[0.15em]">Active Team Members ({teamMembers.length})</span>
              
              <div className="flex flex-col gap-2.5">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-[#FBF5DD]/[0.08] bg-black/15 text-xs">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">{member.email}</span>
                      <span className="text-[8px] font-mono text-[#FBF5DD]/45">Joined: {formatJoinedDate(member.joinedAt)}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${member.role === 'owner' ? 'bg-[#E0D6C6]/20 text-[#FBF5DD]' : member.role === 'admin' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-black/40 text-[#FBF5DD]/50'}`}>
                        {member.role}
                      </span>
                      <span className={`text-[9px] font-mono ${member.status === 'invited' ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {member.status}
                      </span>
                      
                      {member.role !== "owner" && (
                        <button 
                          onClick={() => removeTeamMember(member.id)}
                          className="text-[#FBF5DD]/45 hover:text-red-400 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </LiquidGlassCard>

          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-full overflow-y-auto pr-1.5 scrollbar-thin">
            
            {/* Stats Cards */}
            <LiquidGlassCard material="frosted" className="p-5 flex flex-col gap-1.5">
              <span className="text-[11px] font-mono font-bold text-[#E0D6C6]/65 uppercase tracking-[0.15em]">Total API Queries</span>
              <span className="text-3xl font-extrabold text-white font-mono">14,204</span>
              <div className="h-1.5 w-full bg-black/40 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-[#E0D6C6] w-3/4 rounded-full" />
              </div>
              <span className="text-[9px] text-[#FBF5DD]/45 font-mono mt-1">75% of monthly allowance</span>
            </LiquidGlassCard>

            <LiquidGlassCard className="p-5 flex flex-col gap-1.5">
              <span className="text-[11px] font-mono font-bold text-[#E0D6C6]/65 uppercase tracking-[0.15em]">Storage Consumption</span>
              <span className="text-3xl font-extrabold text-white font-mono">248 MB</span>
              <div className="h-1.5 w-full bg-black/40 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-emerald-500 w-1/4 rounded-full" />
              </div>
              <span className="text-[9px] text-[#FBF5DD]/45 font-mono mt-1">24% of 1 GB limits</span>
            </LiquidGlassCard>

            <LiquidGlassCard className="p-5 flex flex-col gap-1.5">
              <span className="text-[11px] font-mono font-bold text-[#E0D6C6]/65 uppercase tracking-[0.15em]">Active Tasks</span>
              <span className="text-3xl font-extrabold text-white font-mono">4</span>
              <div className="h-1.5 w-full bg-black/40 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-[#E0D6C6] w-1/2 rounded-full" />
              </div>
              <span className="text-[9px] text-[#FBF5DD]/45 font-mono mt-1">2/4 worker active</span>
            </LiquidGlassCard>

            <LiquidGlassCard className="p-5 flex flex-col gap-1.5">
              <span className="text-[11px] font-mono font-bold text-[#E0D6C6]/65 uppercase tracking-[0.15em]">Estimated Cost</span>
              <span className="text-3xl font-extrabold text-white font-mono">$1.84</span>
              <div className="h-1.5 w-full bg-black/40 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-yellow-600 w-1/5 rounded-full" />
              </div>
              <span className="text-[9px] text-[#FBF5DD]/45 font-mono mt-1">Budget threshold: $10.00</span>
            </LiquidGlassCard>

            {/* Custom chart block showing request spikes */}
            <LiquidGlassCard material="frosted" containerClassName="md:col-span-2" className="p-5 flex flex-col gap-4">
              <span className="text-[11px] font-bold text-[#E0D6C6]/65 font-mono uppercase tracking-[0.15em] block mb-1">API Requests Spikes (Last 6 hours)</span>
              <SVGSpikeChart />
            </LiquidGlassCard>

            {/* Active Model Usage chart */}
            <LiquidGlassCard material="frosted" containerClassName="md:col-span-2" className="p-5 flex flex-col gap-4">
              <span className="text-[11px] font-bold text-[#E0D6C6]/65 font-mono uppercase tracking-[0.15em] block mb-1">LLM Model Usage Shares</span>
              
              <div className="flex flex-col gap-2.5 mt-2">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-zinc-300">
                    <span>Gemini 2.5 Flash</span>
                    <span className="font-bold">62%</span>
                  </div>
                  <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                    <div className="h-full bg-[#E0D6C6] w-[62%] rounded-full" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-zinc-300">
                    <span>Claude 3.5 Sonnet</span>
                    <span className="font-bold">28%</span>
                  </div>
                  <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[28%] rounded-full" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] text-zinc-300">
                    <span>DeepSeek R1 / Other</span>
                    <span className="font-bold">10%</span>
                  </div>
                  <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-600 w-[10%] rounded-full" />
                  </div>
                </div>
              </div>
            </LiquidGlassCard>

          </div>
        )}

        {/* ADMIN CONSOLE TAB */}
        {activeTab === "admin" && user && user.role === "admin" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start h-full overflow-y-auto pr-1.5 scrollbar-thin">
            
            {/* System health status (1/3 space) */}
            <LiquidGlassCard material="frosted" className="p-5 flex flex-col gap-4">
              <span className="text-[11px] font-bold text-[#E0D6C6]/65 font-mono uppercase block border-b border-[#FBF5DD]/10 pb-2 tracking-[0.15em]">AI Provider Status</span>
              
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span>Gemini API (Google)</span>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> <span className="text-emerald-400 text-[10px] font-mono">Healthy</span></div>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span>Groq API (Llama / DeepSeek)</span>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> <span className="text-emerald-400 text-[10px] font-mono">Healthy</span></div>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span>Anthropic API (Claude)</span>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> <span className="text-emerald-400 text-[10px] font-mono">Healthy</span></div>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span>OpenAI API</span>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> <span className="text-emerald-400 text-[10px] font-mono">Healthy</span></div>
                </div>
              </div>
            </LiquidGlassCard>

            {/* Subscription Revenue panel (2/3 space) */}
            <LiquidGlassCard material="frosted" containerClassName="md:col-span-2" className="p-5 flex flex-col gap-4">
              <span className="text-[11px] font-bold text-[#E0D6C6]/65 font-mono uppercase block border-b border-[#FBF5DD]/10 pb-2 tracking-[0.15em]">Revenue & Subscribers</span>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="rounded-lg border border-[#FBF5DD]/[0.08] bg-black/15 p-4">
                  <span className="text-[8px] font-mono text-[#FBF5DD]/45 uppercase">MRR</span>
                  <div className="text-xl font-extrabold text-white mt-1">$4,820</div>
                  <span className="text-[8px] font-mono text-emerald-400 mt-1">+14% Growth</span>
                </div>
                <div className="rounded-lg border border-[#FBF5DD]/[0.08] bg-black/15 p-4">
                  <span className="text-[8px] font-mono text-[#FBF5DD]/45 uppercase">Pro Subscribers</span>
                  <div className="text-xl font-extrabold text-white mt-1">241</div>
                  <span className="text-[8px] font-mono text-emerald-400 mt-1">2 new today</span>
                </div>
                <div className="rounded-lg border border-[#FBF5DD]/[0.08] bg-black/15 p-4 col-span-2 md:col-span-1">
                  <span className="text-[8px] font-mono text-[#FBF5DD]/45 uppercase">Enterprise Spaces</span>
                  <div className="text-xl font-extrabold text-white mt-1">4</div>
                  <span className="text-[8px] font-mono text-[#FBF5DD]/35 mt-1">SSO Active</span>
                </div>
              </div>
            </LiquidGlassCard>

          </div>
        )}

      </div>

    </div>
  );
}
