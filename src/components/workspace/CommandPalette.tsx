"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bot, BookOpen, FileText, Layout, Presentation, Settings, Users, Sparkles, X, Folder, HelpCircle } from "lucide-react";
import { useUIStore, WorkspaceModule } from "@/lib/store/uiStore";
import { useWorkspaceStore } from "@/lib/store/workspaceStore";
import { useChatStore } from "@/lib/store/chatStore";

export default function CommandPalette() {
  const isCommandPaletteOpen = useUIStore((s) => s.isCommandPaletteOpen);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const setActiveModule = useUIStore((s) => s.setActiveModule);
  const { folders } = useWorkspaceStore();
  const { conversations, createConversation } = useChatStore();
  
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keydown listeners for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      } else if (e.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  // Focus input on open
  useEffect(() => {
    if (isCommandPaletteOpen) {
      const timer = setTimeout(() => {
        setQuery("");
        setSelectedIndex(0);
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isCommandPaletteOpen]);

  // Command items definition
  const staticCommands = [
    { id: "dashboard", title: "Go to Dashboard", category: "Navigation", icon: Settings, action: () => { setActiveModule("dashboard"); } },
    { id: "chat", title: "Open AI Chat Assistant", category: "Navigation", icon: Bot, action: () => { setActiveModule("chat"); } },
    { id: "research", title: "Open Research Agent", category: "Navigation", icon: Search, action: () => { setActiveModule("research"); } },
    { id: "resume", title: "Open Resume Suite", category: "Navigation", icon: FileText, action: () => { setActiveModule("resume"); } },
    { id: "study", title: "Open Study Assistant", category: "Navigation", icon: BookOpen, action: () => { setActiveModule("study"); } },
    { id: "website", title: "Create AI Landing Page", category: "Navigation", icon: Layout, action: () => { setActiveModule("website"); } },
    { id: "presentation", title: "Create AI Presentation", category: "Navigation", icon: Presentation, action: () => { setActiveModule("presentation"); } },
    { id: "new-chat", title: "Create New Chat Conversation", category: "Actions", icon: Sparkles, action: () => { 
        const id = createConversation();
        setActiveModule("chat");
      } 
    },
  ];

  // Dynamic content search (Folders and Chats)
  const folderCommands = folders.map(f => ({
    id: `folder-${f.id}`,
    title: `Open Folder: ${f.name}`,
    category: "Workspace Folders",
    icon: Folder,
    action: () => {
      useWorkspaceStore.getState().setActiveFolder(f.id);
      setActiveModule("chat");
    }
  }));

  const chatCommands = conversations.map(c => ({
    id: `chat-${c.id}`,
    title: `Chat: ${c.title}`,
    category: "Recent Chats",
    icon: Bot,
    action: () => {
      useChatStore.getState().setActiveConversation(c.id);
      setActiveModule("chat");
    }
  }));

  const allCommands = [...staticCommands, ...folderCommands, ...chatCommands];
  
  // Filter commands
  const filteredCommands = allCommands.filter(cmd => 
    cmd.title.toLowerCase().includes(query.toLowerCase()) || 
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  // Navigate indexes with arrows
  useEffect(() => {
    const handleNav = (e: KeyboardEvent) => {
      if (!isCommandPaletteOpen) return;
      
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          setCommandPaletteOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleNav);
    return () => window.removeEventListener("keydown", handleNav);
  }, [isCommandPaletteOpen, filteredCommands, selectedIndex, setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setCommandPaletteOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.2 }}
          className="command-palette-container relative w-full max-w-xl rounded-xl border border-[#3D4833]/15 bg-[#F0E8DC] shadow-2xl overflow-hidden flex flex-col z-10"
        >
          {/* Header Input */}
          <div className="flex items-center gap-3 px-4 border-b border-[#3D4833]/10 h-12">
            <Search className="h-4 w-4 text-[#3D4833]/60 shrink-0" />
            <input 
              ref={inputRef}
              type="text" 
              placeholder="Search workspaces, folders, shortcuts, or commands..." 
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              className="flex-1 bg-transparent text-sm text-[#2A3226] placeholder-[#3D4833]/40 outline-none border-none py-2"
            />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#3D4833]/10 bg-[#3D4833]/5 text-[#3D4833]/60 shadow-sm">ESC</span>
            </div>
            <button 
              onClick={() => setCommandPaletteOpen(false)} 
              className="text-[#3D4833]/60 hover:text-[#2A3226] p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Results List */}
          <div className="max-h-[320px] overflow-y-auto p-2 flex flex-col gap-1 select-none">
            {filteredCommands.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#3D4833]/60 flex flex-col items-center justify-center gap-2">
                <HelpCircle className="h-6 w-6 text-[#3D4833]/30" />
                <span>No commands or items found matching &quot;{query}&quot;</span>
              </div>
            ) : (
              // Group and Render
              Object.entries(
                filteredCommands.reduce((acc, curr) => {
                  if (!acc[curr.category]) acc[curr.category] = [];
                  acc[curr.category].push(curr);
                  return acc;
                }, {} as Record<string, typeof filteredCommands>)
              ).map(([category, items]) => (
                <div key={category} className="flex flex-col gap-1 mt-2 first:mt-0">
                  <span className="text-[9px] font-mono font-bold tracking-wider text-[#3D4833]/50 px-3 py-1 uppercase">
                    {category}
                  </span>
                  {items.map((cmd) => {
                    const Icon = cmd.icon;
                    // Calculate absolute index in flat filtered array
                    const absoluteIndex = filteredCommands.findIndex(c => c.id === cmd.id);
                    const isSelected = absoluteIndex === selectedIndex;
                    
                      return (
                      <button
                        key={cmd.id}
                        onClick={() => {
                          cmd.action();
                          setCommandPaletteOpen(false);
                        }}
                        onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-all ${isSelected ? 'bg-[#3D4833]/10 text-[#3D4833] border border-[#3D4833]/15 shadow-sm' : 'text-[#2A3226]/75 border border-transparent hover:bg-[#3D4833]/5'}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className={`h-4 w-4 ${isSelected ? 'text-[#3D4833]' : 'text-[#3D4833]/60'}`} />
                          <span>{cmd.title}</span>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-mono text-[#3D4833]/70">⏎ Select</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          
          {/* Footer Shortcuts */}
          <div className="border-t border-[#3D4833]/10 px-4 py-2 bg-black/5 text-[10px] text-[#3D4833]/60 flex justify-between items-center font-mono">
            <span>Use Arrow Keys to navigate, Enter to select</span>
            <div className="flex items-center gap-1">
              <span>Press</span>
              <kbd className="px-1 py-0.5 rounded border border-[#3D4833]/10 bg-[#F0E8DC] text-[#3D4833]/80">Ctrl</kbd>
              <span>+</span>
              <kbd className="px-1 py-0.5 rounded border border-[#3D4833]/10 bg-[#F0E8DC] text-[#3D4833]/80">K</kbd>
              <span>to toggle</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
