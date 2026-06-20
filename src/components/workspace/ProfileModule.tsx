"use client";

import React, { useState, useEffect } from "react";
import {
  Mail,
  User,
  Crown,
  Calendar,
  Users,
  Activity,
  LogOut,
  Edit2,
  CheckCircle,
  Clock,
  Zap,
  Shield,
  X,
  Check,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/lib/store/authStore";
import { useUIStore } from "@/lib/store/uiStore";
import { useWorkspaceStore } from "@/lib/store/workspaceStore";
import { motion, AnimatePresence } from "motion/react";
import LiquidGlassCard from "@/components/ui/LiquidGlassCard";

export default function ProfileModule() {
  const {
    user,
    teamMembers,
    activityLogs,
    logout,
    removeTeamMember,
    upgradeSubscription,
  } = useAuthStore();

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showEnterpriseContact, setShowEnterpriseContact] = useState(false);

  const showPricingModalOnProfile = useUIStore((s) => s.showPricingModalOnProfile);
  const setShowPricingModalOnProfile = useUIStore((s) => s.setShowPricingModalOnProfile);

  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalMs: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    if (showPricingModalOnProfile) {
      setShowPricingModal(true);
      setShowPricingModalOnProfile(false);
    }
  }, [showPricingModalOnProfile, setShowPricingModalOnProfile]);

  useEffect(() => {
    if (!user?.planExpiresAt || user.plan !== "pro") {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const diff = new Date(user.planExpiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ days, hours, minutes, seconds, totalMs: diff });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [user?.planExpiresAt, user?.plan]);

  const getRemainingDays = () => {
    if (!user?.planExpiresAt) return 0;
    const diff = new Date(user.planExpiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const handlePlanSelect = async (selectedPlan: "free" | "pro" | "enterprise") => {
    if (!user) return;
    
    // If downgrading to free, confirm first
    if (selectedPlan === "free" && user.plan !== "free") {
      const remaining = getRemainingDays();
      if (user.plan === "pro" && remaining > 0) {
        alert("You cannot downgrade to Free while your active Pro subscription is in progress.");
        return;
      }
      if (!confirm("Are you sure you want to cancel your plan? You will be downgraded to the Free tier with reduced daily limits.")) {
        return;
      }
    }
    
    setLoading(true);
    try {
      const res = await fetch("/api/auth/update-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, plan: selectedPlan }),
      });
      if (res.ok) {
        const resData = await res.json();
        const updatedUser = resData.user || {};
        upgradeSubscription(selectedPlan, updatedUser.planExpiresAt, updatedUser.hasClaimedPromo, updatedUser.planDuration);
        setShowPricingModal(false);
      } else {
        const errData = await res.json();
        alert(errData.error || "Subscription update failed.");
      }
    } catch (err) {
      console.error("Subscription update failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!mounted) return "";
    const date = new Date(dateString);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const formatDateTime = (dateString: string) => {
    if (!mounted) return "";
    const date = new Date(dateString);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${month} ${day}, ${year} ${hours}:${minutes}`;
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "enterprise":
        return "from-purple-500 to-pink-500";
      case "pro":
        return "from-blue-500 to-cyan-500";
      default:
        return "from-green-500 to-emerald-500";
    }
  };

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case "enterprise":
        return <Crown className="h-5 w-5" />;
      case "pro":
        return <Zap className="h-5 w-5" />;
      default:
        return <CheckCircle className="h-5 w-5" />;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Shield className="h-4 w-4" />;
      case "admin":
        return <Users className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-700";
      case "admin":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusColor = (status: string) => {
    return status === "active"
      ? "bg-green-100 text-green-700"
      : "bg-yellow-100 text-yellow-700";
  };

  const planLabel = user?.plan || "free";
  const memberSince = mounted && user?.createdAt ? formatDate(user.createdAt) : "—";
  const recentActivity = activityLogs[0];

  return (
    <div className="h-full min-h-0 overflow-y-auto pb-32 p-6 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border border-[#3D4833]/10 bg-gradient-to-br from-[#FBF5DD] via-[#F3E9D4] to-[#E8E0D0] p-6 md:p-8 shadow-[0_18px_50px_rgba(42,50,38,0.08)]"
      >
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top_right,_rgba(61,72,51,0.18),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(211,178,120,0.20),_transparent_30%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#3D4833]/10 bg-white/50 px-3 py-1 text-[11px] font-semibold text-[#2A3226]/70 backdrop-blur-sm">
              <Calendar className="h-3.5 w-3.5" />
              {memberSince !== "—" ? `Member since ${memberSince}` : "Profile overview"}
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-[#2A3226] md:text-5xl">
              {user?.fullName || "Your Profile"}
            </h1>
            <p className="mt-3 max-w-xl text-sm md:text-base text-[#2A3226]/70">
              Review your account details, subscription status, workspace access, and recent usage in one place.
            </p>

            <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-[#2A3226]/70">
              <span className="rounded-full border border-[#3D4833]/10 bg-white/60 px-3 py-1.5">{user?.role === "admin" ? "Administrator" : "Workspace User"}</span>
              <span className="rounded-full border border-[#3D4833]/10 bg-white/60 px-3 py-1.5 capitalize">{planLabel} Plan</span>
              <span className="rounded-full border border-[#3D4833]/10 bg-white/60 px-3 py-1.5">{teamMembers.length} teammates</span>
              <span className="rounded-full border border-[#3D4833]/10 bg-white/60 px-3 py-1.5">{activityLogs.length} events</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="rounded-full border border-[#3D4833]/10 bg-white/65 px-4 py-2 text-sm font-semibold text-[#2A3226] backdrop-blur-sm transition-colors hover:bg-white">
              Edit Profile
            </button>
            <button
              onClick={() => {
                useWorkspaceStore.getState().resetStore();
                logout();
              }}
              className="rounded-full bg-[#3D4833] px-4 py-2 text-sm font-semibold text-[#F5EFE4] shadow-sm transition-colors hover:bg-[#2A3226]"
            >
              Logout
            </button>
          </div>
        </div>
      </motion.div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="flex flex-col gap-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <LiquidGlassCard material="frosted" className="p-6 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3D4833]/55">Account details</p>
                  <h2 className="mt-2 text-2xl font-bold text-[#2A3226]">Your identity</h2>
                </div>
                <button className="rounded-full border border-[#3D4833]/10 p-2 text-[#3D4833] transition-colors hover:bg-[#3D4833]/10">
                  <Edit2 className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-center">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[34px] bg-gradient-to-br from-[#3D4833] to-[#1f271b] text-4xl font-black text-[#F5EFE4] shadow-[0_14px_30px_rgba(61,72,51,0.25)]">
                  {user?.fullName?.charAt(0).toUpperCase() || "U"}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl font-bold text-[#2A3226]">{user?.fullName || "User Name"}</h3>
                    <span className="rounded-full bg-[#3D4833]/10 px-3 py-1 text-xs font-semibold text-[#3D4833] capitalize">{user?.plan || "free"}</span>
                  </div>

                  <div className="mt-3 grid gap-3 text-sm text-[#2A3226]/70 sm:grid-cols-2">
                    <div className="flex items-center gap-2 rounded-2xl border border-[#3D4833]/10 bg-white/50 px-4 py-3">
                      <Mail className="h-4 w-4 shrink-0 text-[#3D4833]" />
                      <span className="truncate">{user?.email || "No email set"}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-[#3D4833]/10 bg-white/50 px-4 py-3">
                      <Shield className="h-4 w-4 shrink-0 text-[#3D4833]" />
                      <span>{user?.role === "admin" ? "Admin access" : "Standard access"}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3D4833]/55">Member since</p>
                      <p className="mt-1 text-sm font-bold text-[#2A3226]">{memberSince}</p>
                    </div>
                    <div className="rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3D4833]/55">Workspace role</p>
                      <p className="mt-1 text-sm font-bold text-[#2A3226] capitalize">{user?.role || "user"}</p>
                    </div>
                    <div className="rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3D4833]/55">Account type</p>
                      <p className="mt-1 text-sm font-bold text-[#2A3226]">{user?.role === "admin" ? "Administrator" : "Standard"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </LiquidGlassCard>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <LiquidGlassCard material="frosted" className="p-6 md:p-8 h-full">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3D4833]/55">Subscription</p>
                    <h2 className="mt-2 text-2xl font-bold text-[#2A3226]">Plan overview</h2>
                  </div>
                  <div className="rounded-2xl bg-[#3D4833]/10 p-3 text-[#3D4833]">{getPlanIcon(planLabel)}</div>
                </div>

                <div className={`mt-5 overflow-hidden rounded-[24px] bg-gradient-to-r ${getPlanColor(planLabel)} p-5 text-white`}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/80">Current plan</p>
                      <h3 className="mt-1 text-3xl font-black capitalize">{planLabel}</h3>
                    </div>
                    <div className="text-5xl text-white/95">{getPlanIcon(planLabel)}</div>
                  </div>
                </div>

                {planLabel === "pro" && user?.planExpiresAt && timeLeft && (
                  <div className="mt-3 rounded-2xl border border-[#3D4833]/15 bg-[#3D4833]/5 p-4 text-xs">
                    <div className="flex items-center justify-between text-[#2A3226]">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-[#3D4833]" /> Remaining Time
                      </span>
                      <span className="font-bold font-mono text-[#3D4833] animate-pulse">
                        {timeLeft.days}d {timeLeft.hours.toString().padStart(2, "0")}h {timeLeft.minutes.toString().padStart(2, "0")}m {timeLeft.seconds.toString().padStart(2, "0")}s
                      </span>
                    </div>
                    <div className="mt-2.5 h-1.5 rounded-full bg-[#3D4833]/10">
                      <div 
                        className="h-1.5 rounded-full bg-[#3D4833] transition-all duration-500" 
                        style={{ width: `${Math.max(0, Math.min(100, (getRemainingDays() / (user?.planDuration || 365)) * 100))}%` }} 
                      />
                    </div>
                    <p className="mt-2 text-[10px] text-[#2A3226]/60 leading-normal">
                      Your Pro Workspace subscription is active ({user?.planDuration === 30 ? "30 days" : "1 year"} duration).
                    </p>
                  </div>
                )}

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3D4833]/55">What you get</p>
                    <div className="mt-3 space-y-2 text-sm text-[#2A3226]">
                      <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#3D4833]" /><span>Workspace management</span></div>
                      <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#3D4833]" /><span>AI companion access</span></div>
                      <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#3D4833]" /><span>Shared team tools</span></div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3D4833]/55">Usage snapshot</p>
                    <div className="mt-3 space-y-4 text-sm text-[#2A3226]/80">
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span>Storage</span>
                          <span className="font-semibold">2.5 GB / 10 GB</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#3D4833]/10">
                          <div className="h-2 rounded-full bg-[#3D4833]" style={{ width: "25%" }} />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span>Plan status</span>
                          <span className="font-semibold">Active</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#3D4833]/10">
                          <div className="h-2 rounded-full bg-emerald-500" style={{ width: "100%" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPricingModal(true)}
                  className="mt-5 w-full rounded-2xl bg-[#3D4833] py-3 text-sm font-semibold text-[#F5EFE4] transition-colors hover:bg-[#2A3226]"
                >
                  {planLabel === "free" ? "Upgrade Plan" : "Manage Subscription"}
                </button>
              </LiquidGlassCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
              <LiquidGlassCard material="frosted" className="p-6 md:p-8 h-full">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3D4833]/55">Security</p>
                    <h2 className="mt-2 text-2xl font-bold text-[#2A3226]">Access summary</h2>
                  </div>
                  <div className="rounded-2xl bg-[#3D4833]/10 p-3 text-[#3D4833]"><Shield className="h-5 w-5" /></div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3D4833]/55">Login state</p>
                        <p className="mt-1 text-sm font-bold text-[#2A3226]">Signed in on this device</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Secure</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3D4833]/55">Recent activity</p>
                    <div className="mt-3 flex items-start gap-3">
                      <Activity className="mt-0.5 h-4 w-4 text-[#3D4833]" />
                      <div>
                        <p className="text-sm font-semibold text-[#2A3226]">{recentActivity?.action || "No recent activity"}</p>
                        <p className="text-sm text-[#2A3226]/60">{recentActivity?.details || "Activity log will appear here once actions are recorded."}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3D4833]/55">Workspace access</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-white/60 p-3">
                        <p className="text-[#2A3226]/55">Team members</p>
                        <p className="mt-1 text-lg font-bold text-[#2A3226]">{teamMembers.length}</p>
                      </div>
                      <div className="rounded-2xl bg-white/60 p-3">
                        <p className="text-[#2A3226]/55">Events</p>
                        <p className="mt-1 text-lg font-bold text-[#2A3226]">{activityLogs.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </LiquidGlassCard>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <LiquidGlassCard material="frosted" className="p-6 md:p-8">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3D4833]/55">Team</p>
                  <h2 className="mt-2 text-2xl font-bold text-[#2A3226]">Shared access</h2>
                </div>
                <span className="rounded-full bg-[#3D4833]/10 px-3 py-1 text-sm font-semibold text-[#3D4833]">{teamMembers.length} members</span>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {teamMembers.map((member) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-[#3D4833]/10 bg-white/55 p-4"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#3D4833] text-sm font-black text-[#F5EFE4]">
                        {member.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#2A3226]">{member.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${getRoleColor(member.role)}`}>
                            {getRoleIcon(member.role)}
                            <span className="capitalize">{member.role}</span>
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(member.status)}`}>
                            {member.status}
                          </span>
                          {mounted && (
                            <span className="text-xs text-[#2A3226]/50">Joined {formatDate(member.joinedAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {member.role !== "owner" && (
                      <button
                        onClick={() => removeTeamMember(member.id)}
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
                      >
                        Remove
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </LiquidGlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
            <LiquidGlassCard material="frosted" className="p-6 md:p-8">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3D4833]/55">Activity</p>
                  <h2 className="mt-2 text-2xl font-bold text-[#2A3226]">Recent events</h2>
                </div>
                <span className="rounded-full bg-[#3D4833]/10 px-3 py-1 text-sm font-semibold text-[#3D4833]">{activityLogs.length} logs</span>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {activityLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-4 rounded-2xl border border-[#3D4833]/10 bg-white/55 p-4"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#3D4833]/15 text-[#3D4833]">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#2A3226]">{log.action}</p>
                      {log.details && <p className="mt-1 text-sm text-[#2A3226]/60">{log.details}</p>}
                      {mounted && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-[#2A3226]/50">
                          <Clock className="h-3 w-3" />
                          <span suppressHydrationWarning>{formatDateTime(log.timestamp)}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </LiquidGlassCard>
          </motion.div>
        </div>

        <div className="flex flex-col gap-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <LiquidGlassCard material="frosted" className="p-6 md:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3D4833]/55">Quick actions</p>
              <h2 className="mt-2 text-2xl font-bold text-[#2A3226]">Workspace shortcuts</h2>
              <div className="mt-5 space-y-3">
                <button className="w-full rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 px-4 py-3 text-left text-sm font-semibold text-[#2A3226] transition-colors hover:bg-[#3D4833]/10">
                  Update profile details
                </button>
                <button className="w-full rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 px-4 py-3 text-left text-sm font-semibold text-[#2A3226] transition-colors hover:bg-[#3D4833]/10">
                  Review subscription usage
                </button>
                <button className="w-full rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 px-4 py-3 text-left text-sm font-semibold text-[#2A3226] transition-colors hover:bg-[#3D4833]/10">
                  Invite a teammate
                </button>
              </div>
            </LiquidGlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <LiquidGlassCard material="frosted" className="p-6 md:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#3D4833]/55">Status</p>
              <h2 className="mt-2 text-2xl font-bold text-[#2A3226]">Account snapshot</h2>
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 p-4">
                  <p className="text-sm text-[#2A3226]/60">Authentication</p>
                  <p className="mt-1 text-base font-semibold text-[#2A3226]">Logged in</p>
                </div>
                <div className="rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 p-4">
                  <p className="text-sm text-[#2A3226]/60">Subscription</p>
                  <p className="mt-1 text-base font-semibold text-[#2A3226] capitalize">{planLabel}</p>
                </div>
                <div className="rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 p-4">
                  <p className="text-sm text-[#2A3226]/60">Security posture</p>
                  <p className="mt-1 text-base font-semibold text-emerald-700">Healthy</p>
                </div>
              </div>
            </LiquidGlassCard>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {showPricingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2A3226]/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-4xl w-full bg-[#F5EFE4] border border-[#3D4833]/20 rounded-[28px] p-6 sm:p-8 shadow-2xl flex flex-col gap-6 font-sans text-[#2A3226] overflow-y-auto max-h-[90vh]"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowPricingModal(false)}
                className="absolute top-4 right-4 rounded-full border border-[#3D4833]/10 p-2 text-[#3D4833] transition-colors hover:bg-[#3D4833]/10"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="text-center max-w-2xl mx-auto mt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#3D4833]/15 text-[10px] font-mono text-[#3D4833]/85 uppercase tracking-[0.1em] bg-[#3D4833]/5 mb-3">
                  <Sparkles className="h-3 w-3 text-[#3D4833]" /> Onboarding Offer active
                </span>
                <h2 className="text-3xl font-black tracking-tight text-[#2A3226]">
                  Calm, Transparent Plans
                </h2>
                <p className="text-sm text-[#2A3226]/70 mt-2">
                  Select the workspace tier matching your workflow. Upgrade or cancel anytime.
                </p>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 items-stretch">
                {/* Free Tier */}
                <div className="flex flex-col justify-between rounded-2xl border border-[#3D4833]/10 bg-white/40 p-6 relative overflow-hidden">
                  <div>
                    <span className="text-[9px] font-bold font-mono text-[#3D4833]/55 uppercase tracking-[0.1em]">Base Mode</span>
                    <h3 className="text-xl font-bold text-[#2A3226] mt-1">Free Tier</h3>
                    <p className="text-xs text-[#2A3226]/70 mt-2 leading-relaxed">
                      Start writing and editing with standard AI companionship.
                    </p>

                    <div className="my-5 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-[#2A3226] font-mono">$0</span>
                      <span className="text-xs text-[#2A3226]/50">/ forever</span>
                    </div>

                    <div className="h-[1px] bg-[#3D4833]/10 my-4" />
                    <ul className="flex flex-col gap-2.5 text-xs text-[#2A3226]/80">
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#3D4833] shrink-0" /> 5 PPT generations / day</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#3D4833] shrink-0" /> 5 Website generations / day</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#3D4833] shrink-0" /> 50 AI messages / day</li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled={planLabel === "free" || (user?.plan === "pro" && getRemainingDays() > 0) || loading}
                    onClick={() => handlePlanSelect("free")}
                    className={`w-full mt-6 py-2.5 rounded-xl text-xs font-bold text-center transition-all ${
                      planLabel === "free" || (user?.plan === "pro" && getRemainingDays() > 0)
                        ? "bg-[#3D4833]/10 text-[#3D4833]/50 cursor-not-allowed font-medium"
                        : "bg-white border border-[#3D4833]/10 hover:bg-[#3D4833]/5 text-[#2A3226]"
                    }`}
                  >
                    {planLabel === "free" 
                      ? "Active Plan" 
                      : (user?.plan === "pro" && getRemainingDays() > 0)
                        ? "Downgrade locked (Pro active)"
                        : "Downgrade to Free"}
                  </button>
                </div>

                {/* Pro Workspace */}
                <div className="flex flex-col justify-between rounded-2xl border-2 border-[#3D4833]/30 bg-gradient-to-b from-[#3D4833]/5 to-[#3D4833]/10 p-6 relative overflow-hidden shadow-md">
                  <div className="absolute top-0 right-0 bg-[#3D4833] text-[#F5EFE4] text-[8px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                    Free 1 Year
                  </div>
                  <div>
                    <span className="text-[9px] font-bold font-mono text-[#3D4833] uppercase tracking-[0.1em]">Recommended</span>
                    <h3 className="text-xl font-bold text-[#2A3226] mt-1">Pro Workspace</h3>
                    <p className="text-xs text-[#2A3226]/70 mt-2 leading-relaxed">
                      Unlimited power and high-speed premium AI models.
                    </p>

                    <div className="my-5 flex items-baseline gap-1.5 flex-wrap">
                      {user?.hasClaimedPromo && user?.plan !== "pro" ? (
                        <>
                          <span className="text-3xl font-black text-[#2A3226] font-mono">$20</span>
                          <span className="text-xs text-[#2A3226]/50">/ month</span>
                          <span className="text-[10px] text-zinc-600 font-bold bg-zinc-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Promo Claimed
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-3xl font-black text-[#2A3226] font-mono">$0</span>
                          <span className="text-xs text-[#2A3226]/50 line-through font-mono">$20/mo</span>
                          <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            1 Year Free
                          </span>
                        </>
                      )}
                    </div>

                    <div className="h-[1px] bg-[#3D4833]/15 my-4" />
                    <ul className="flex flex-col gap-2.5 text-xs text-[#2A3226]/90">
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#3D4833] shrink-0" /> 20 PPT generations / day</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#3D4833] shrink-0" /> 20 Website generations / day</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#3D4833] shrink-0" /> 500 AI messages / day</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#3D4833] shrink-0" /> Priority processing speed</li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled={planLabel === "pro" || loading}
                    onClick={() => handlePlanSelect("pro")}
                    className={`w-full mt-6 py-2.5 rounded-xl text-xs font-bold text-center transition-all ${
                      planLabel === "pro"
                        ? "bg-[#3D4833]/15 text-[#3D4833]/50 cursor-not-allowed font-medium"
                        : "bg-[#3D4833] text-[#F5EFE4] hover:bg-[#2A3226] shadow-sm"
                    }`}
                  >
                    {planLabel === "pro" 
                      ? "Active Plan" 
                      : user?.hasClaimedPromo 
                        ? "Upgrade to Pro ($20/mo)" 
                        : "Claim 1 Year Free"}
                  </button>
                </div>

                {/* Enterprise */}
                <div className="flex flex-col justify-between rounded-2xl border border-[#3D4833]/10 bg-white/40 p-6 relative overflow-hidden">
                  <div>
                    <span className="text-[9px] font-bold font-mono text-[#3D4833]/55 uppercase tracking-[0.1em]">Scale Mode</span>
                    <h3 className="text-xl font-bold text-[#2A3226] mt-1">Enterprise</h3>
                    <p className="text-xs text-[#2A3226]/70 mt-2 leading-relaxed">
                      Custom limits, team control panels and dedicated APIs.
                    </p>

                    <div className="my-5 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-[#2A3226] font-mono">Custom</span>
                    </div>

                    <div className="h-[1px] bg-[#3D4833]/10 my-4" />
                    <ul className="flex flex-col gap-2.5 text-xs text-[#2A3226]/80">
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#3D4833] shrink-0" /> SSO & user control logs</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#3D4833] shrink-0" /> Custom LLM key configurations</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#3D4833] shrink-0" /> 24/7 dedicated support</li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled={planLabel === "enterprise" || loading}
                    onClick={() => setShowEnterpriseContact(true)}
                    className={`w-full mt-6 py-2.5 rounded-xl text-xs font-bold text-center transition-all ${
                      planLabel === "enterprise"
                        ? "bg-[#3D4833]/10 text-[#3D4833]/50 cursor-not-allowed font-medium"
                        : "bg-white border border-[#3D4833]/10 hover:bg-[#3D4833]/5 text-[#2A3226]"
                    }`}
                  >
                    {planLabel === "enterprise" ? "Active Plan" : "Upgrade to Enterprise"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEnterpriseContact && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#2A3226]/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-md w-full bg-[#F5EFE4] border border-[#3D4833]/25 rounded-[28px] p-6 shadow-2xl flex flex-col gap-5 font-sans text-[#2A3226]"
            >
              <button
                type="button"
                onClick={() => setShowEnterpriseContact(false)}
                className="absolute top-4 right-4 rounded-full border border-[#3D4833]/10 p-2 text-[#3D4833] transition-colors hover:bg-[#3D4833]/10"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex flex-col gap-2 text-center mt-3">
                <span className="text-3xl">💼</span>
                <h3 className="text-xl font-bold text-[#2A3226]">Custom Enterprise Activation</h3>
                <p className="text-xs text-[#2A3226]/70 leading-relaxed">
                  Enterprise plans require manual database provisioning and custom quota setup by the administrator.
                </p>
              </div>

              <div className="rounded-2xl border border-[#3D4833]/10 bg-[#3D4833]/5 p-4 space-y-3 text-xs leading-normal">
                <p className="font-semibold text-[#2A3226]">How to activate:</p>
                <ol className="list-decimal pl-4 space-y-1.5 text-[#2A3226]/80">
                  <li>Contact the administrator at <strong className="text-[#3D4833]">krishna@gmail.com</strong>.</li>
                  <li>Provide your registered email: <code className="bg-[#3D4833]/10 px-1.5 py-0.5 rounded font-mono font-bold text-[#3D4833]">{user?.email}</code>.</li>
                  <li>Once approved, the administrator will update your plan in the database.</li>
                </ol>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText("krishna@gmail.com");
                  alert("Administrator email copied to clipboard! (krishna@gmail.com)");
                  setShowEnterpriseContact(false);
                }}
                className="w-full py-2.5 rounded-xl bg-[#3D4833] hover:bg-[#2A3226] text-[#F5EFE4] text-xs font-bold transition-all shadow-sm"
              >
                Copy Admin Email & Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
