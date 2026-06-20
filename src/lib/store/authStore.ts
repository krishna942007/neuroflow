import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: "admin" | "user";
  plan: "free" | "pro" | "enterprise";
  createdAt: string;
  planExpiresAt?: string;
  hasClaimedPromo?: boolean;
  planDuration?: number;
}

export interface TeamMember {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  status: "active" | "invited";
  joinedAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  timestamp: string;
  details?: string;
}

interface AuthState {
  user: User | null;
  teamMembers: TeamMember[];
  activityLogs: ActivityLog[];
  isLoggedIn: boolean;
  stripeMockStatus: "active" | "past_due" | "cancelled" | null;
  dailyUsage: { date: string; pptCount: number; webCount: number; messageCount: number };
  
  // Actions
  login: (email: string, name?: string, id?: string, role?: string, plan?: string, avatarUrl?: string, planExpiresAt?: string, hasClaimedPromo?: boolean, planDuration?: number) => void;
  logout: () => void;
  updateProfile: (fullName: string, email: string) => void;
  upgradeSubscription: (plan: "free" | "pro" | "enterprise", planExpiresAt?: string, hasClaimedPromo?: boolean, planDuration?: number) => void;
  inviteTeamMember: (email: string, role: TeamMember["role"]) => void;
  removeTeamMember: (id: string) => void;
  addActivityLog: (action: string, details?: string) => void;
  clearActivityLogs: () => void;
  checkAndIncrementUsage: (type: "ppt" | "web" | "message") => { allowed: boolean; limit: number; count: number };
}

const APP_EPOCH = Date.parse("2026-06-19T12:00:00.000Z");

const initialTeamMembers: TeamMember[] = [
  {
    id: "user-1",
    email: "admin@neuroflow.ai",
    role: "owner",
    status: "active",
    joinedAt: new Date(APP_EPOCH - 86400000 * 30).toISOString(),
  },
  {
    id: "user-2",
    email: "member1@cdac.in",
    role: "admin",
    status: "active",
    joinedAt: new Date(APP_EPOCH - 86400000 * 5).toISOString(),
  },
  {
    id: "user-3",
    email: "developer@neuroflow.ai",
    role: "member",
    status: "invited",
    joinedAt: new Date(APP_EPOCH).toISOString(),
  }
];

const initialLogs: ActivityLog[] = [
  {
    id: "log-1",
    action: "Workspace initialized",
    timestamp: new Date(APP_EPOCH - 3600000 * 24).toISOString(),
    details: "Created first personal workspace"
  },
  {
    id: "log-2",
    action: "Uploaded document",
    timestamp: new Date(APP_EPOCH - 3600000 * 18).toISOString(),
    details: "Krishna_Singh_Resume.pdf loaded successfully"
  },
  {
    id: "log-3",
    action: "Stripe setup",
    timestamp: new Date(APP_EPOCH - 3600000 * 2).toISOString(),
    details: "Simulated subscription changed to Pro Workspace"
  }
];

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      teamMembers: initialTeamMembers,
      activityLogs: initialLogs,
      isLoggedIn: false,
      stripeMockStatus: null,
      dailyUsage: {
        date: new Date(APP_EPOCH).toISOString().split("T")[0],
        pptCount: 0,
        webCount: 0,
        messageCount: 0,
      },

      login: (email, name = "New User", id, role = "user", plan = "free", avatarUrl, planExpiresAt, hasClaimedPromo, planDuration) => {
        const newUser: User = {
          id: id || `user-${Math.random().toString(36).substr(2, 9)}`,
          email,
          fullName: name,
          role: role as any,
          plan: plan as any,
          avatarUrl,
          createdAt: new Date().toISOString(),
          planExpiresAt,
          hasClaimedPromo,
          planDuration,
        };
        set({
          user: newUser,
          isLoggedIn: true,
          stripeMockStatus: plan === "free" ? null : "active",
        });
        get().addActivityLog("Logged in", `Session started for ${email}`);
      },

      logout: () => {
        void fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
        set({
          user: null,
          isLoggedIn: false,
          stripeMockStatus: null,
        });
        if (typeof window !== "undefined") {
          localStorage.removeItem("neuroflow-workspace-storage");
          localStorage.removeItem("neuroflow-auth-storage");
          window.location.reload();
        }
      },

      updateProfile: (fullName, email) => {
        set((state) => {
          if (!state.user) return {};
          return {
            user: {
              ...state.user,
              fullName,
              email,
            },
          };
        });
        get().addActivityLog("Profile updated", `Name: ${fullName}, Email: ${email}`);
      },

      upgradeSubscription: (plan, planExpiresAt, hasClaimedPromo, planDuration) => {
        set((state) => {
          if (!state.user) return {};
          return {
            user: {
              ...state.user,
              plan,
              planExpiresAt: planExpiresAt !== undefined ? planExpiresAt : state.user.planExpiresAt,
              hasClaimedPromo: hasClaimedPromo !== undefined ? hasClaimedPromo : state.user.hasClaimedPromo,
              planDuration: planDuration !== undefined ? planDuration : state.user.planDuration,
            },
            stripeMockStatus: plan === "free" ? null : "active",
          };
        });
        get().addActivityLog("Subscription changed", `Upgraded plan to ${plan.toUpperCase()}`);
      },

      inviteTeamMember: (email, role) => {
        const newMember: TeamMember = {
          id: `user-${Math.random().toString(36).substr(2, 9)}`,
          email,
          role,
          status: "invited",
          joinedAt: new Date().toISOString(),
        };
        set((state) => ({
          teamMembers: [...state.teamMembers, newMember],
        }));
        get().addActivityLog("Member invited", `Invited ${email} as ${role}`);
      },

      removeTeamMember: (id) => {
        const member = get().teamMembers.find(m => m.id === id);
        set((state) => ({
          teamMembers: state.teamMembers.filter((m) => m.id !== id),
        }));
        if (member) {
          get().addActivityLog("Member removed", `Removed team member ${member.email}`);
        }
      },

      addActivityLog: (action, details) => {
        const newLog: ActivityLog = {
          id: `log-${Math.random().toString(36).substr(2, 9)}`,
          action,
          timestamp: new Date().toISOString(),
          details,
        };
        set((state) => ({
          activityLogs: [newLog, ...state.activityLogs.slice(0, 49)], // keep last 50 logs
        }));
      },

      clearActivityLogs: () => set({ activityLogs: [] }),

      checkAndIncrementUsage: (type) => {
        const state = get();
        const user = state.user;
        if (!user) return { allowed: true, limit: 99999, count: 0 };
        
        const todayStr = new Date().toISOString().split("T")[0];
        let currentUsage = state.dailyUsage || { date: todayStr, pptCount: 0, webCount: 0, messageCount: 0 };
        
        if (currentUsage.date !== todayStr) {
          currentUsage = { date: todayStr, pptCount: 0, webCount: 0, messageCount: 0 };
        }
        
        const plan = user.plan || "free";
        let limit = 0;
        let currentCount = 0;
        
        if (type === "ppt") {
          limit = plan === "free" ? 2 : (plan === "pro" ? 20 : 99999);
          currentCount = currentUsage.pptCount;
        } else if (type === "web") {
          limit = plan === "free" ? 2 : (plan === "pro" ? 20 : 99999);
          currentCount = currentUsage.webCount;
        } else {
          limit = plan === "free" ? 15 : (plan === "pro" ? 500 : 99999);
          currentCount = currentUsage.messageCount;
        }
        
        if (currentCount >= limit) {
          return { allowed: false, limit, count: currentCount };
        }
        
        const updatedUsage = { ...currentUsage };
        if (type === "ppt") {
          updatedUsage.pptCount += 1;
        } else if (type === "web") {
          updatedUsage.webCount += 1;
        } else {
          updatedUsage.messageCount += 1;
        }
        
        set({ dailyUsage: updatedUsage });
        return { allowed: true, limit, count: currentCount + 1 };
      },
    }),
    {
      name: "neuroflow-auth-storage",
    }
  )
);
