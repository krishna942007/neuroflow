"use client";

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  FolderPlus, 
  MessageSquare, 
  Settings, 
  Pin, 
  Trash2, 
  ChevronDown, 
  LogOut, 
  Sparkles, 
  Folder,
  Home,
  Leaf
} from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/workspaceStore";
import { useChatStore } from "@/lib/store/chatStore";
import { useAuthStore } from "@/lib/store/authStore";
import { useUIStore, WorkspaceModule } from "@/lib/store/uiStore";

// Custom premium SVG Paw Icon for Newton
function PawIcon({ className = "h-4 w-4 text-[#3D4833]" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
    >
      <circle cx="12" cy="14.5" r="3.5" />
      <circle cx="7.5" cy="9.5" r="2" />
      <circle cx="16.5" cy="9.5" r="2" />
      <circle cx="11.5" cy="6.5" r="1.8" />
      <circle cx="15.5" cy="7.2" r="1.5" />
      <circle cx="8.5" cy="7.2" r="1.5" />
    </svg>
  );
}

export default function Sidebar() {
  const { 
    workspaces, 
    folders, 
    activeWorkspaceId, 
    activeFolderId, 
    setActiveWorkspace, 
    setActiveFolder, 
    createFolder, 
    deleteFolder,
    createWorkspace
  } = useWorkspaceStore();
  
  const { 
    conversations, 
    activeConversationId, 
    setActiveConversation, 
    createConversation, 
    deleteConversation, 
    togglePinConversation,
    renameConversation
  } = useChatStore();

  const { user, logout } = useAuthStore();
  const activeModule = useUIStore((s) => s.activeModule);
  const setActiveModule = useUIStore((s) => s.setActiveModule);
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);

  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [isAddingWs, setIsAddingWs] = useState(false);
  const [newWsName, setNewWsName] = useState("");

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  // Filter items matching active workspace
  const activeFolders = folders.filter((f) => f.workspaceId === activeWorkspaceId);
  const activeChats = conversations.filter((c) => c.workspaceId === activeWorkspaceId);
  
  const pinnedChats = activeChats.filter((c) => c.isPinned);
  const unpinnedChats = activeChats.filter((c) => !c.isPinned);

  // Seed default conversations for pixel perfect mockup matching
  useEffect(() => {
    if (conversations.length === 0) {
      const id1 = createConversation();
      renameConversation(id1, "hello");
      createConversation(); // this creates "New Chat"
    }
  }, [conversations.length, createConversation, renameConversation]);

  const handleAddFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim());
      setNewFolderName("");
      setIsAddingFolder(false);
    }
  };

  const handleAddWsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newWsName.trim()) {
      createWorkspace(newWsName.trim(), "personal");
      setNewWsName("");
      setIsAddingWs(false);
      setWsMenuOpen(false);
    }
  };

  const selectModule = (modName: WorkspaceModule) => {
    setActiveModule(modName);
    setActiveConversation(null);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  if (!isSidebarOpen) return null;

  return (
    <aside className="premium-dark-sidebar fixed inset-y-3 left-3 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl flex flex-col shrink-0 select-none font-sans z-40 shadow-2xl overflow-hidden lg:relative lg:inset-auto lg:w-64 lg:h-[calc(100vh-2rem)] lg:my-4 lg:ml-4 lg:mr-2">
      
      {/* Workspace Selector Dropdown Header */}
      <div className="relative p-4 border-b border-[#1c351f]/8">
        <button 
          onClick={() => setWsMenuOpen(!wsMenuOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-transparent text-[13.5px] font-bold text-[#2A3226] hover:bg-black/5 transition-all font-display"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#3D4833] flex items-center justify-center text-[12px] text-[#F5EFE4] font-bold shadow-sm">
              P
            </div>
            <span className="truncate tracking-wide font-semibold text-[14px]">Personal Workspace</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-[#2A3226]/50 transition-transform ${wsMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Workspace Dropdown Panel */}
        {wsMenuOpen && (
          <div className="absolute top-[calc(100%-8px)] left-4 right-4 z-40 p-1.5 rounded-xl border border-[#3D4833]/12 bg-[#E5DDD0]/95 backdrop-blur-2xl shadow-2xl flex flex-col gap-1">
            <span className="text-[9px] font-semibold text-[#2A3226]/45 font-mono uppercase px-2 py-1">Switch Workspaces</span>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  setActiveWorkspace(ws.id);
                  setWsMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-[12px] transition-all ${ws.id === activeWorkspaceId ? 'workspace-tab-active' : 'workspace-tab-idle'}`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-sm bg-[#3D4833]/10 flex items-center justify-center text-[9px] font-bold">
                    {ws.name.charAt(0)}
                  </div>
                  <span>{ws.name}</span>
                </div>
                <span className="text-[9px] text-[#2A3226]/45 font-mono capitalize">{ws.type}</span>
              </button>
            ))}
            
            <div className="h-[1px] bg-black/5 my-1" />
            
            {isAddingWs ? (
              <form onSubmit={handleAddWsSubmit} className="p-1">
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Workspace name..."
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                className="workspace-soft-input w-full text-xs rounded px-2 py-1.5 outline-none focus:border-[#3D4833]"
                />
              </form>
            ) : (
              <button 
                onClick={() => setIsAddingWs(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs workspace-tab-idle"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Workspace</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Sidebar Contents Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6 scrollbar-none">
        
        {/* Core Nav Categories */}
        <div className="flex flex-col gap-1">
          <button 
            onClick={() => selectModule("dashboard")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-left transition-all cursor-pointer ${activeModule === "dashboard" && !activeConversationId ? 'workspace-tab-active' : 'workspace-tab-idle'}`}
          >
            <Home className="h-4 w-4" />
            <span>Workspace Home</span>
          </button>
          
          <button 
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-semibold text-left workspace-tab-idle transition-all border border-transparent cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Settings className="h-4 w-4" />
              <span>Search Commands</span>
            </div>
            <kbd className="text-[9px] font-mono border border-[#3D4833]/15 bg-[#F0E8DC]/70 text-[#2A3226]/60 px-1 py-0.5 rounded shadow-sm">Ctrl + K</kbd>
          </button>
        </div>

        {/* Folders Directories Section */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-[10px] font-semibold text-[#2A3226]/45 font-mono tracking-[0.1em] uppercase">Folders</span>
            <button 
              onClick={() => setIsAddingFolder(true)} 
              className="text-[#2A3226]/45 hover:text-[#2A3226] cursor-pointer"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          </div>

          {isAddingFolder && (
            <form onSubmit={handleAddFolderSubmit} className="px-3 mb-2">
              <input 
                type="text" 
                autoFocus
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onBlur={() => setIsAddingFolder(false)}
                className="workspace-soft-input w-full text-xs rounded px-2 py-1 outline-none focus:border-[#3D4833]"
              />
            </form>
          )}

          {activeFolders.length === 0 ? (
            <span className="text-[10px] text-[#2A3226]/45 px-3 italic">No folders created</span>
          ) : (
            <div className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto">
              {activeFolders.map((f) => {
                const isActive = activeFolderId === f.id;
                return (
                  <div key={f.id} className={`group/folder flex items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-all ${isActive ? 'workspace-tab-active' : 'workspace-tab-idle'}`}>
                    <button 
                      onClick={() => {
                        setActiveFolder(isActive ? null : f.id);
                        selectModule("chat");
                      }}
                      className="flex items-center gap-2 text-left truncate flex-1 font-medium cursor-pointer"
                    >
                      <Folder className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </button>
                    <button 
                      onClick={() => deleteFolder(f.id)}
                      className="opacity-0 group-hover/folder:opacity-100 text-[#2A3226]/45 hover:text-red-600 p-0.5 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chat conversations history list */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-[10px] font-semibold text-[#2A3226]/45 font-mono tracking-[0.1em] uppercase">Conversations</span>
            <button 
              onClick={() => {
                createConversation(activeFolderId);
                selectModule("chat");
              }}
              className="text-[#2A3226]/45 hover:text-[#2A3226] p-0.5 rounded hover:bg-black/5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-0.5 max-h-[220px] overflow-y-auto pr-1">
            {activeChats.length === 0 ? (
              <span className="text-[10px] text-[#2A3226]/45 px-3 italic">No recent chats</span>
            ) : (
              <>
                {/* Pinned Chats */}
                {pinnedChats.map((c) => {
                  const isActive = activeConversationId === c.id;
                  return (
                    <div 
                      key={c.id} 
                      className={`group flex items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-all ${isActive ? 'workspace-tab-active' : 'workspace-tab-idle'}`}
                    >
                      <button 
                        onClick={() => {
                          setActiveConversation(c.id);
                          setActiveModule("chat");
                        }}
                        className="flex items-center gap-2 truncate text-left flex-1 font-medium cursor-pointer"
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.title}</span>
                      </button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => togglePinConversation(c.id)} className="text-[#3D4833]/45 hover:text-[#3D4833] p-0.5 cursor-pointer">
                          <Pin className="h-3 w-3 fill-[#3D4833] text-[#3D4833]" />
                        </button>
                        <button onClick={() => deleteConversation(c.id)} className="text-[#2A3226]/45 hover:text-red-600 p-0.5 cursor-pointer">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Normal Chats */}
                {unpinnedChats.map((c) => {
                  const isActive = activeConversationId === c.id;
                  return (
                    <div 
                      key={c.id} 
                      className={`group flex items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-all ${isActive ? 'workspace-tab-active' : 'workspace-tab-idle'}`}
                    >
                      <button 
                        onClick={() => {
                          setActiveConversation(c.id);
                          setActiveModule("chat");
                        }}
                        className="flex items-center gap-2 truncate text-left flex-1 font-medium cursor-pointer"
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.title}</span>
                      </button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => togglePinConversation(c.id)} className="text-[#3D4833]/45 hover:text-[#3D4833] p-0.5 cursor-pointer">
                          <Pin className="h-3 w-3" />
                        </button>
                        <button onClick={() => deleteConversation(c.id)} className="text-[#2A3226]/45 hover:text-red-600 p-0.5 cursor-pointer">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Meet Newton BETA Card Widget */}
        <div className="rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 p-4.5 flex flex-col gap-3.5 mt-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#3D4833]/10 flex items-center justify-center">
                <PawIcon className="h-4.5 w-4.5 text-[#3D4833]" />
              </div>
              <span className="text-[13px] font-bold text-[#2A3226]">Meet Newton</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#3D4833]/10 text-[#3D4833] text-[8.5px] font-bold font-mono">BETA</span>
          </div>
          <p className="text-[11px] text-[#2A3226]/75 leading-relaxed">
            Your AI companion is here to help you everywhere.
          </p>
          <button 
            onClick={() => setActiveModule("chat")}
            className="w-full py-2 rounded-xl bg-[#3D4833] hover:bg-[#2A3226] text-[#F5EFE4] text-[11px] font-semibold text-center cursor-pointer transition-colors shadow-sm"
          >
            Learn more
          </button>
        </div>

      </div>

      {/* User Session Footer (Profile and Plan Card) */}
      <div className="p-4 border-t border-[#1c351f]/8 flex flex-col gap-3 bg-[#1c351f]/3% backdrop-blur-sm">
        
        {/* Profile Details Row */}
        <div className="w-full flex items-center justify-between gap-3.5">
          <button
            type="button"
            onClick={() => setActiveModule("profile")}
            className="flex min-w-0 flex-1 items-center gap-3.5 truncate text-left cursor-pointer hover:opacity-80 transition-opacity"
          >
            {/* Solid avatar badge matching mockup */}
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#3D4833] text-[#F5EFE4] font-bold text-[13px] shadow-sm shrink-0">
              {user?.fullName.charAt(0).toUpperCase() || "N"}
            </div>
            <div className="flex flex-col truncate text-left">
              <span className="text-[13px] font-bold text-[#2A3226] truncate">{user?.fullName || "Guest Account"}</span>
              <span className="text-[9.5px] text-[#2A3226]/60 truncate font-mono">{user?.email || "guest@neuroflow.ai"}</span>
            </div>
          </button>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              useWorkspaceStore.getState().resetStore();
              logout();
            }}
            title="Logout"
            className="text-[#2A3226]/50 hover:text-red-600 p-1 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Free Plan capsule positioned below the profile card row */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#3D4833]/5 text-[#3D4833]/80 border border-[#3D4833]/10 text-[10px] font-semibold uppercase w-fit">
          <Leaf className="h-3.5 w-3.5 text-[#3D4833] shrink-0" />
          <span className="tracking-wide">Free Plan</span>
        </div>

      </div>
    </aside>
  );
}
