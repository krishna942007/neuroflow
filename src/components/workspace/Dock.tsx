"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  Home, 
  Search, 
  FileText, 
  GraduationCap, 
  Layout, 
  Presentation, 
  Menu
} from "lucide-react";
import { useUIStore, WorkspaceModule } from "@/lib/store/uiStore";
import { useChatStore } from "@/lib/store/chatStore";

interface DockItem {
  module: WorkspaceModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export default function Dock({ inline = false }: { inline?: boolean }) {
  const activeModule = useUIStore((s) => s.activeModule);
  const setActiveModule = useUIStore((s) => s.setActiveModule);
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const { setActiveConversation } = useChatStore();

  const dockItems: DockItem[] = [
    { module: "dashboard", label: "Home", icon: Home, color: "text-primary" },
    { module: "research", label: "Research", icon: Search, color: "text-primary" },
    { module: "resume", label: "Resume", icon: FileText, color: "text-primary" },
    { module: "study", label: "Study", icon: GraduationCap, color: "text-primary" },
    { module: "website", label: "Website Designer", icon: Layout, color: "text-primary" },
    { module: "presentation", label: "Slides", icon: Presentation, color: "text-primary" },
  ];

  const handleModuleClick = (module: WorkspaceModule) => {
    setActiveModule(module);
    if (module !== "chat") {
      setActiveConversation(null);
    }
  };

  return (
    <div className={inline ? "relative z-10 px-4 select-none font-sans" : `absolute bottom-6 ${isSidebarOpen ? "left-1/2 lg:left-[calc(50%+136px)] -translate-x-1/2" : "left-1/2 -translate-x-1/2"} z-40 px-4 pointer-events-none select-none font-sans transition-all duration-300`}>
      <div className={`workspace-dock flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 rounded-full ${inline ? "" : "pointer-events-auto"}`}>
        
        {/* Toggle Sidebar Button */}
        <button 
          onClick={() => toggleSidebar()}
          title="Toggle Sidebar"
          className="p-2 md:p-2.5 rounded-full transition-all bg-[#1c351f]/10 text-[#1c351f] hover:bg-[#1c351f] hover:text-[#F5EFE4] border border-[#1c351f]/12 cursor-pointer shadow-sm"
        >
          <Menu className="h-4 w-4 md:h-4.5 md:w-4.5" />
        </button>
 
        <div className="h-4 w-[1px] bg-[#E0D6C6]/15" />
 
        {/* Core Dock Items */}
        <div className="flex items-center gap-1 md:gap-1.5">
          {dockItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.module;
 
            return (
              <div key={item.module} className="relative group">
                {/* Tooltip */}
                <div className="dock-tooltip absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 px-2.5 py-1 rounded border backdrop-blur-md text-[9px] font-semibold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                  {item.label}
                </div>
                
                {/* Dock Button */}
                <motion.button
                  whileHover={{ scale: 1.15, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleModuleClick(item.module)}
                  className={`p-2.5 md:p-3 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-[#3D4833] border border-[#3D4833]/20 text-[#F5EFE4] shadow-lg shadow-[#3D4833]/20' : 'hover:bg-[#3D4833]/8 text-[#3D4833]/60 hover:text-[#3D4833]'}`}
                >
                  <Icon className={`h-4 w-4 md:h-4.5 md:w-4.5 ${isActive ? 'text-[#F5EFE4]' : ''}`} />
                </motion.button>
 
                {/* Active Indicator Dot */}
                {isActive && (
                  <motion.div 
                    layoutId="activeDockDot"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#3D4833]"
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
