"use client";

import React from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/workspace/Sidebar";
import Dock from "@/components/workspace/Dock";
import CommandPalette from "@/components/workspace/CommandPalette";
import AICompanion from "@/components/workspace/AICompanion";
import { useUIStore } from "@/lib/store/uiStore";
import { useAuthStore } from "@/lib/store/authStore";
import AuthScreen from "@/components/workspace/AuthScreen";
import { motion, AnimatePresence } from "motion/react";

// Lazy-load or directly import modules
import WorkspaceDashboard from "@/components/dashboard/WorkspaceDashboard";
import ChatModule from "@/components/workspace/ChatModule";
import ResearchModule from "@/components/workspace/ResearchModule";
import ResumeModule from "@/components/workspace/ResumeModule";
import StudyModule from "@/components/workspace/StudyModule";
import WebsiteModule from "@/components/workspace/WebsiteModule";
import PresentationModule from "@/components/workspace/PresentationModule";
import ProfileModule from "@/components/workspace/ProfileModule";

export default function WorkspacePage() {
  const activeModule = useUIStore((s) => s.activeModule);
  const setActiveModule = useUIStore((s) => s.setActiveModule);
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const limitWarning = useUIStore((s) => s.limitWarning);
  const setLimitWarning = useUIStore((s) => s.setLimitWarning);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);
  const upgradeSubscription = useAuthStore((s) => s.upgradeSubscription);

  // Global viewport scroll lock: prevents layout shift bugs when elements like iframes focus
  React.useEffect(() => {
    const handleScroll = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target && (
        target.tagName === "MAIN" ||
        target.tagName === "BODY" ||
        target.tagName === "HTML" ||
        (target.classList && (
          target.classList.contains("workspace-main-frame") ||
          target.classList.contains("workspace-shell")
        ))
      )) {
        if (target.scrollTop !== 0) target.scrollTop = 0;
        if (target.scrollLeft !== 0) target.scrollLeft = 0;
      }
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, []);

  if (!isLoggedIn || !user) {
    return (
      <div className="workspace-shell flex h-screen overflow-hidden font-sans relative">
        <div className="fine-grain-overlay" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute inset-0 bg-radial-glow opacity-30" />
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#3D4833]/8 blur-[120px]" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-[#D8CEBD]/55 blur-[120px]" />
        </div>
        <AuthScreen />
      </div>
    );
  }

  const renderActiveModule = () => {
    switch (activeModule) {
      case "dashboard":
        return <WorkspaceDashboard />;
      case "chat":
        return <ChatModule />;
      case "research":
        return <ResearchModule />;
      case "resume":
        return <ResumeModule />;
      case "study":
        return <StudyModule />;
      case "website":
        return <WebsiteModule />;
      case "presentation":
        return <PresentationModule />;
      case "profile":
        return <ProfileModule />;
      default:
        return <WorkspaceDashboard />;
    }
  };

  return (
    <div className="workspace-shell flex h-screen overflow-hidden font-sans relative selection:bg-[#3D4833]/15 selection:text-[#2A3226]">
      <div className="fine-grain-overlay" />
      
      {/* Background Glow effects wrapper to prevent scrollable overflow expansion */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 bg-radial-glow opacity-30" />
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#3D4833]/8 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-[#D8CEBD]/55 blur-[120px]" />
      </div>
      
      {/* Sidebar Navigation */}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/45 backdrop-blur-sm lg:hidden"
        />
      )}
      <Sidebar />

      {/* Main Workspace Frame container */}
      <main className={`workspace-main-frame flex-1 flex min-h-0 flex-col ${
        activeModule !== "dashboard"
          ? "h-[calc(100vh-8rem)] mt-4 mb-28"
          : "h-[calc(100vh-2rem)] my-4"
      } mx-2 sm:mx-4 ${isSidebarOpen ? 'lg:ml-2' : 'lg:ml-4'} rounded-2xl overflow-hidden p-3 sm:p-4 md:p-6 z-10 relative`}>
        
        {/* Toggle Sidebar floating button if closed */}
        {!isSidebarOpen && (
          <button 
            onClick={() => toggleSidebar()}
            className="absolute top-6 left-6 z-20 p-2 rounded-lg workspace-muted-button shadow-xl transition-all backdrop-blur-md"
            title="Open Sidebar"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
        )}

        {/* Dynamic Panel wrapper */}
        <div className="flex-1 min-h-0 w-full h-full overflow-hidden">
          {renderActiveModule()}
        </div>
      </main>

      {/* Bottom Floating Navigation menu (only shown when not on the Dashboard module) */}
      {activeModule !== "dashboard" && <Dock />}

      {/* Ctrl+K Search Command Dialog */}
      <CommandPalette />

      {/* AI Companion Puppy (Newton) */}
      <AICompanion />

      {/* Global Usage Limit Warning Modal */}
      <AnimatePresence>
        {limitWarning && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#F0E8DC] border border-[#3D4833]/20 rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col gap-4 font-sans text-[#2A3226]"
            >
              <div className="flex flex-col gap-1.5 text-center">
                <span className="text-2xl">🚫</span>
                <h3 className="text-base font-bold text-[#2A3226]">Daily Usage Limit Reached</h3>
                <p className="text-xs text-[#6B7365] mt-1 leading-relaxed">
                  You have hit your daily limit of <strong className="text-[#2A3226]">{limitWarning.limit}</strong> {limitWarning.type === "ppt" ? "presentation generations" : limitWarning.type === "web" ? "website generations" : "AI assistant messages"} on the <span className="font-semibold uppercase text-xs">{limitWarning.plan}</span> plan.
                </p>
              </div>

              {limitWarning.plan === "free" ? (
                <div className="flex flex-col gap-2 mt-2">
                  <div className="p-3 border border-emerald-800/20 bg-emerald-800/5 rounded-xl text-center">
                    <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Onboarding Special Offer</p>
                    <p className="text-xs text-emerald-950 font-medium mt-0.5">Upgrade to 1 Year Free Premium (Pro) Plan now!</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLimitWarning(null);
                      useUIStore.getState().setShowPricingModalOnProfile(true);
                      setActiveModule("profile");
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#3D4833] hover:bg-[#2A3226] text-[#F5EFE4] text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Claim 1 Year Free Premium
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLimitWarning(null);
                      setActiveModule("dashboard");
                    }}
                    className="w-full py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    Manage Subscription
                  </button>
                  <button
                    type="button"
                    onClick={() => setLimitWarning(null)}
                    className="text-[10px] text-[#6B7365] hover:text-[#2A3226] font-medium underline underline-offset-2 transition-colors cursor-pointer mt-1 mx-auto"
                  >
                    Maybe Later
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  <p className="text-[10px] text-[#6B7365] leading-relaxed text-center">
                    Your Pro subscription plan resets its counters daily. Contact enterprise support for unlimited keys.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLimitWarning(null);
                      setActiveModule("dashboard");
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#3D4833] hover:bg-[#2A3226] text-[#F5EFE4] text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Manage / Cancel Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => setLimitWarning(null)}
                    className="w-full py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
