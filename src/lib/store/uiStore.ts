import { create } from "zustand";

export type WorkspaceModule = 
  | "dashboard"
  | "chat"
  | "research"
  | "resume"
  | "study"
  | "website"
  | "presentation"
  | "profile";

export type CompanionState = 
  | "idle" 
  | "happy" 
  | "sleeping" 
  | "fetching" 
  | "spinning" 
  | "excited" 
  | "eating" 
  | "confused" 
  | "thinking"
  | "sad"
  | "naughty";

interface UIState {
  activeModule: WorkspaceModule;
  isSidebarOpen: boolean;
  isCommandPaletteOpen: boolean;
  limitWarning: null | { type: "ppt" | "web" | "message"; limit: number; plan: string };
  showPricingModalOnProfile: boolean;
  
  // Newton companion global state
  companionState: CompanionState;
  furColor: string;
  collarColor: string;
  earType: "floppy" | "perked";
  dogScale: number;
  isSitting: boolean;
  voiceEnabled: boolean;

  // Actions
  setActiveModule: (module: WorkspaceModule) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (isOpen: boolean) => void;
  setLimitWarning: (warning: UIState["limitWarning"]) => void;
  setShowPricingModalOnProfile: (show: boolean) => void;
  
  setCompanionState: (state: CompanionState) => void;
  setFurColor: (color: string) => void;
  setCollarColor: (color: string) => void;
  setEarType: (earType: "floppy" | "perked") => void;
  setDogScale: (scale: number) => void;
  setIsSitting: (isSitting: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeModule: "dashboard",
  isSidebarOpen: true,
  isCommandPaletteOpen: false,
  limitWarning: null,
  showPricingModalOnProfile: false,

  // Newton default settings (loaded from localStorage on mount in Puppy3D)
  companionState: "idle",
  furColor: "#e2a65e",
  collarColor: "#b91c1c",
  earType: "floppy",
  dogScale: 1.0,
  isSitting: false,
  voiceEnabled: true,

  setActiveModule: (module) => set({ activeModule: module }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
  setCommandPaletteOpen: (isOpen) => set({ isCommandPaletteOpen: isOpen }),
  setLimitWarning: (limitWarning) => set({ limitWarning }),
  setShowPricingModalOnProfile: (show) => set({ showPricingModalOnProfile: show }),

  setCompanionState: (companionState) => set({ companionState }),
  setFurColor: (furColor) => set({ furColor }),
  setCollarColor: (collarColor) => set({ collarColor }),
  setEarType: (earType) => set({ earType }),
  setDogScale: (dogScale) => set({ dogScale }),
  setIsSitting: (isSitting) => set({ isSitting }),
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
}));
