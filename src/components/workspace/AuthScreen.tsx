"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, User as UserIcon, ArrowRight, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/lib/store/authStore";
import { useWorkspaceStore } from "@/lib/store/workspaceStore";

const GOOGLE_CLIENT_ID = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "") : "";
const IS_PLACEHOLDER_GOOGLE = !GOOGLE_CLIENT_ID || 
  GOOGLE_CLIENT_ID.includes("your-google-client-id") || 
  GOOGLE_CLIENT_ID === "";

export default function AuthScreen() {
  const loginAction = useAuthStore((s) => s.login);
  
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [googleInitialized, setGoogleInitialized] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<any>(null);

  // Load Google GIS script dynamically only if it is NOT a placeholder Client ID
  React.useEffect(() => {
    if (typeof window === "undefined" || IS_PLACEHOLDER_GOOGLE) return;
    if (document.getElementById("google-gsi-script")) {
      setGoogleInitialized(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleInitialized(true);
    document.body.appendChild(script);
  }, []);

  // Handle Google Auth Response credential verification and parsing
  const handleCredentialResponse = async (response: any) => {
    setErrorMsg(null);
    setIsLoading(true);
    const credential = response.credential;
    
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        if (data.isNewUser) {
          setRegisteredUser(data.user);
          setShowOnboarding(true);
        } else {
          loginAction(
            data.user.email,
            data.user.fullName,
            data.user.id,
            data.user.role,
            data.user.plan,
            data.user.avatarUrl,
            data.user.planExpiresAt,
            data.user.hasClaimedPromo
          );
          if (data.workspaceData) {
            useWorkspaceStore.setState({
              workspaces: data.workspaceData.workspaces,
              folders: data.workspaceData.folders,
              files: data.workspaceData.files,
              activeWorkspaceId: data.workspaceData.activeWorkspaceId,
              activeFolderId: null
            });
          }
        }
      } else {
        setErrorMsg(data.error || "Google sign-in authentication failed.");
      }
    } catch (err) {
      setErrorMsg("Google authentication failed. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize GSI client and render official Sign-in button
  React.useEffect(() => {
    if (googleInitialized && (window as any).google && !IS_PLACEHOLDER_GOOGLE) {
      const clientId = GOOGLE_CLIENT_ID || "301716793909-q0vu6285l1lhm33gcgacrnl67o67cit2.apps.googleusercontent.com";
      try {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
        });

        (window as any).google.accounts.id.renderButton(
          document.getElementById("googleBtn"),
          { 
            theme: "outline", 
            size: "large", 
            width: 356,
            text: "signin_with",
            shape: "pill",
            logo_alignment: "left"
          }
        );
      } catch (err) {
        console.error("Google Sign-In initialization failed:", err);
      }
    }
  }, [googleInitialized]);

  // Mocks Google Sign-In with a popup/dialog (Local Offline Sandbox fallback)
  const handleGoogleSignInMock = () => {
    setErrorMsg(null);
    
    // Open a popup window simulating Google Auth
    const w = 500;
    const h = 600;
    const left = screen.width / 2 - w / 2;
    const top = screen.height / 2 - h / 2;
    
    const popup = window.open(
      "",
      "Google Sign-In",
      `width=${w},height=${h},top=${top},left=${left},status=no,menubar=no,toolbar=no`
    );

    let checkPopupClosed: any;

    // Set up a listener for the popup message
    const handlePopupMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === "GOOGLE_AUTH_SUCCESS") {
        const { fullName, email, avatarUrl } = event.data.payload;
        setErrorMsg(null);
        setIsLoading(true);
        try {
          const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, fullName, avatarUrl })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            if (data.isNewUser) {
              setRegisteredUser(data.user);
              setShowOnboarding(true);
            } else {
              // Log in locally with complete profile data
              loginAction(
                data.user.email,
                data.user.fullName,
                data.user.id,
                data.user.role,
                data.user.plan,
                data.user.avatarUrl,
                data.user.planExpiresAt,
                data.user.hasClaimedPromo
              );
              // Restore workspace if present
              if (data.workspaceData) {
                useWorkspaceStore.setState({
                  workspaces: data.workspaceData.workspaces,
                  folders: data.workspaceData.folders,
                  files: data.workspaceData.files,
                  activeWorkspaceId: data.workspaceData.activeWorkspaceId,
                  activeFolderId: null
                });
              }
            }
          } else {
            setErrorMsg(data.error || "Google sign-in authentication failed.");
          }
        } catch (err) {
          setErrorMsg("Server error connecting to Google Sign-in.");
        } finally {
          setIsLoading(false);
          if (checkPopupClosed) clearInterval(checkPopupClosed);
          window.removeEventListener("message", handlePopupMessage);
        }
      }
    };

    window.addEventListener("message", handlePopupMessage);

    if (popup) {
      popup.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Sign in with Google</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          </style>
        </head>
        <body class="bg-zinc-50 flex flex-col justify-between h-screen p-6">
          <div class="flex flex-col items-center mt-6 text-center shrink-0">
            <!-- Google Logo -->
            <svg class="h-10 w-10 mb-2" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.093-5.136 4.093-3.328 0-6.03-2.702-6.03-6.03s2.702-6.03 6.03-6.03c1.5 0 2.87.55 3.93 1.458l3.07-3.07C18.665 2.541 15.655 1.5 12.24 1.5 6.3 1.5 1.5 6.3 1.5 12.24s4.8 10.74 10.74 10.74c5.94 0 10.285-4.178 10.285-10.285 0-.693-.075-1.385-.24-2.067H12.24Z" />
            </svg>
            <h1 class="text-xl font-bold text-zinc-800">Sign in with Google</h1>
            <p class="text-xs text-zinc-500 mt-1">to continue to Neuroflow AI</p>
          </div>

          <!-- Account selector mock -->
          <div id="account-chooser" class="flex flex-col gap-3 my-4 overflow-y-auto max-h-[300px]">
            <button 
              onclick="selectAccount('Krishna Singh', 'krishna@gmail.com', 'https://api.dicebear.com/7.x/bottts/svg?seed=krishna')"
              class="w-full flex items-center gap-3 p-3 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl text-left transition-all cursor-pointer shadow-sm animate-fade-in"
            >
              <div class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">K</div>
              <div class="flex flex-col">
                <span class="text-sm font-semibold text-zinc-700">Krishna Singh</span>
                <span class="text-xs text-zinc-400">krishna@gmail.com</span>
              </div>
            </button>
            
            <button 
              onclick="selectAccount('Guest User', 'guest@neuroflow.ai', 'https://api.dicebear.com/7.x/bottts/svg?seed=guest')"
              class="w-full flex items-center gap-3 p-3 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl text-left transition-all cursor-pointer shadow-sm"
            >
              <div class="w-8 h-8 rounded-full bg-zinc-600 text-white flex items-center justify-center font-bold text-sm">G</div>
              <div class="flex flex-col">
                <span class="text-sm font-semibold text-zinc-700">Guest User</span>
                <span class="text-xs text-zinc-400">guest@neuroflow.ai</span>
              </div>
            </button>

            <button 
              onclick="showForm()"
              class="w-full flex items-center justify-center gap-2 p-3 bg-zinc-100 hover:bg-zinc-200 border border-dashed border-zinc-300 rounded-xl transition-all cursor-pointer text-xs font-semibold text-zinc-600"
            >
              <span>+ Use another account</span>
            </button>
          </div>

          <!-- Custom Account Creation Form -->
          <div id="account-form" class="hidden flex-col gap-3 my-4">
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-bold text-zinc-500 uppercase">Your Name</label>
              <input type="text" id="custom-name" placeholder="John Doe" class="text-xs p-2.5 bg-white border border-zinc-200 rounded-lg outline-none text-zinc-800 placeholder-zinc-400 shadow-sm" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-bold text-zinc-500 uppercase">Email Address</label>
              <input type="email" id="custom-email" placeholder="john@example.com" class="text-xs p-2.5 bg-white border border-zinc-200 rounded-lg outline-none text-zinc-800 placeholder-zinc-400 shadow-sm" />
            </div>
            <div class="flex gap-2 mt-2">
              <button onclick="hideForm()" class="flex-1 py-2 rounded-lg bg-zinc-200 text-zinc-700 text-xs font-bold transition-all hover:bg-zinc-300">Back</button>
              <button onclick="submitForm()" class="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all">Sign In</button>
            </div>
          </div>

          <div class="text-[9px] text-zinc-400 text-center shrink-0">
            By signing in, Google will share your name, email address, language preference, and profile picture with Neuroflow AI.
          </div>

          <script>
            function selectAccount(name, email, avatarUrl) {
              window.opener.postMessage({
                type: 'GOOGLE_AUTH_SUCCESS',
                payload: { fullName: name, email: email, avatarUrl: avatarUrl }
              }, '*');
              window.close();
            }

            function showForm() {
              document.getElementById('account-chooser').classList.add('hidden');
              document.getElementById('account-form').classList.remove('hidden');
              document.getElementById('account-form').classList.add('flex');
            }

            function hideForm() {
              document.getElementById('account-form').classList.remove('flex');
              document.getElementById('account-form').classList.add('hidden');
              document.getElementById('account-chooser').classList.remove('hidden');
            }

            function submitForm() {
              const name = document.getElementById('custom-name').value.trim();
              const email = document.getElementById('custom-email').value.trim();
              if (!name || !email) {
                alert('Please enter both name and email.');
                return;
              }
              const seed = encodeURIComponent(name);
              const avatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=' + seed;
              selectAccount(name, email, avatar);
            }
          </script>
        </body>
        </html>
      `);
      popup.document.close();

      checkPopupClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopupClosed);
          setIsLoading(false);
          window.removeEventListener("message", handlePopupMessage);
        }
      }, 500);
    } else {
      setIsLoading(false);
      window.removeEventListener("message", handlePopupMessage);
    }
  };

  // Submit standard Email/Password Login or Register
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please fill in all credentials.");
      return;
    }

    if (isRegister) {
      if (!fullName.trim()) {
        setErrorMsg("Name is required for registration.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match.");
        return;
      }
      if (password.length < 12) {
        setErrorMsg("Password must be at least 12 characters.");
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isRegister) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, fullName })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
          setRegisteredUser(data.user);
          setShowOnboarding(true);
        } else {
          setErrorMsg(data.error || "Registration failed.");
        }
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          loginAction(
            data.user.email,
            data.user.fullName,
            data.user.id,
            data.user.role,
            data.user.plan,
            data.user.avatarUrl,
            data.user.planExpiresAt,
            data.user.hasClaimedPromo
          );
          // Restore user's synced workspace data if it exists
          if (data.workspaceData) {
            useWorkspaceStore.setState({
              workspaces: data.workspaceData.workspaces,
              folders: data.workspaceData.folders,
              files: data.workspaceData.files,
              activeWorkspaceId: data.workspaceData.activeWorkspaceId,
              activeFolderId: null
            });
          }
        } else {
          setErrorMsg(data.error || "Invalid email or password.");
        }
      }
    } catch (err) {
      setErrorMsg("A server network error occurred. Check connection.");
    } finally {
      setIsLoading(false);
    }
  };

  if (showOnboarding && registeredUser) {
    const handleChoosePlan = async (selectedPlan: "free" | "pro") => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch("/api/auth/update-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: registeredUser.id, plan: selectedPlan })
        });
        if (res.ok) {
          const resData = await res.json();
          const updatedUser = resData.user || registeredUser;
          loginAction(
            updatedUser.email,
            updatedUser.fullName,
            updatedUser.id,
            updatedUser.role,
            updatedUser.plan,
            updatedUser.avatarUrl,
            updatedUser.planExpiresAt,
            updatedUser.hasClaimedPromo
          );
        } else {
          setErrorMsg("Failed to assign subscription plan. Try again.");
        }
      } catch (err) {
        setErrorMsg("Failed to connect to plan selection API.");
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="flex-1 flex items-center justify-center h-full relative overflow-hidden font-sans p-4">
        {/* organic background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#3D4833]/8 blur-[120px]" />
          <div className="absolute -bottom-24 -right-24 w-[35rem] h-[35rem] rounded-full bg-[#D8CEBD]/45 blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[440px] rounded-3xl border border-[#3D4833]/15 bg-[#F0E8DC]/95 backdrop-blur-2xl p-8 z-10 shadow-2xl relative font-sans"
        >
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-[#2A3226] tracking-tight">Welcome to NeuroFlow AI! 🎉</h2>
            <p className="text-xs text-[#6B7365] mt-1 leading-relaxed">Choose your workspace package to get started:</p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-700 text-xs font-medium text-center">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* Pro Option (Default / Rec) */}
            <button 
              type="button"
              disabled={isLoading}
              onClick={() => handleChoosePlan("pro")}
              className="p-5 border border-[#3D4833]/25 bg-[#FAF6E8] hover:border-[#3D4833]/50 rounded-2xl cursor-pointer text-left transition-all hover:scale-[1.01] shadow-sm relative group flex flex-col gap-2 w-full disabled:opacity-50"
            >
              <div className="absolute top-3 right-3 px-2 py-0.5 bg-[#3D4833] text-[#F5EFE4] text-[8px] font-bold rounded-full font-mono uppercase tracking-wide">
                Offer: 1 Year Free
              </div>
              <div className="text-sm font-bold text-[#2A3226] group-hover:text-[#3D4833] transition-colors">
                Premium Plan (Pro)
              </div>
              <div className="text-xs font-semibold text-emerald-800">
                $0 / First Year <span className="text-[10px] text-zinc-500 line-through font-normal">$15/mo value</span>
              </div>
              <ul className="text-[10px] text-[#6B7365] space-y-1.5 mt-1 border-t border-zinc-200/50 pt-2 w-full">
                <li className="flex items-center gap-1.5 font-medium">✓ 20 Presentation generations / day</li>
                <li className="flex items-center gap-1.5 font-medium">✓ 20 Website generations / day</li>
                <li className="flex items-center gap-1.5 font-medium">✓ 500 AI Assistant messages / day</li>
                <li className="flex items-center gap-1.5 font-medium">✓ Full Workspace vector context access</li>
              </ul>
            </button>

            {/* Free Option */}
            <button 
              type="button"
              disabled={isLoading}
              onClick={() => handleChoosePlan("free")}
              className="p-5 border border-[#3D4833]/10 bg-white/40 hover:bg-white/60 rounded-2xl cursor-pointer text-left transition-all hover:scale-[1.01] shadow-sm flex flex-col gap-2 w-full disabled:opacity-50"
            >
              <div className="text-sm font-bold text-zinc-700">
                Basic Free Plan
              </div>
              <div className="text-xs font-semibold text-zinc-600">
                $0 / Forever
              </div>
              <ul className="text-[10px] text-zinc-500 space-y-1 mt-1 border-t border-zinc-200/50 pt-2 w-full">
                <li>• 2 Presentation generations / day</li>
                <li>• 2 Website generations / day</li>
                <li>• 15 AI Assistant messages / day</li>
              </ul>
            </button>
          </div>

          <div className="text-[9px] text-[#6B7365]/70 text-center mt-6">
            You can change or cancel your subscription plan at any time inside Workspace Settings.
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center h-full relative overflow-hidden font-sans p-4">
      {/* Moving organic liquid background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{
            x: [0, 40, -20, 0],
            y: [0, -30, 40, 0],
            scale: [1, 1.15, 0.9, 1]
          }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-[100px]"
        />
        <motion.div 
          animate={{
            x: [0, -40, 30, 0],
            y: [0, 40, -30, 0],
            scale: [1, 0.9, 1.2, 1]
          }}
          transition={{ repeat: Infinity, duration: 22, ease: "linear" }}
          className="absolute -bottom-24 -right-24 w-[35rem] h-[35rem] rounded-full bg-[#D8CEBD]/45 blur-[120px]"
        />
      </div>

      {/* Main glass card container */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[420px] rounded-3xl border border-[#3D4833]/15 bg-[#F0E8DC]/45 backdrop-blur-2xl p-8 z-10 shadow-2xl relative"
      >
        <div className="text-center flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#3D4833] flex items-center justify-center shadow-lg text-[#F5EFE4] mb-4">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-[#2A3226] tracking-tight">
            {isRegister ? "Create Account" : "Access Personal Workspace"}
          </h2>
          <p className="text-xs text-[#6B7365] mt-1.5 leading-relaxed max-w-[300px]">
            {isRegister 
              ? "Register with email or Google to create your secure database profile."
              : "Sign in with your credentials or Google account to load your workspace."
            }
          </p>
        </div>

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-5 p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-700 text-xs font-medium text-center"
          >
            {errorMsg}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isRegister && (
            <div className="flex flex-col gap-1 relative">
              <span className="text-[9px] font-bold text-[#6B7365] font-mono uppercase pl-1">Full Name</span>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7365]" />
                <input 
                  type="text" 
                  placeholder="Krishna Singh"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-xs pl-10 pr-4 py-3 bg-[#E5DDD0]/80 border border-[#3D4833]/25 rounded-xl outline-none text-[#2A3226] placeholder-[#6B7365]/50 focus:border-[#3D4833]/50 shadow-inner"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1 relative">
            <span className="text-[9px] font-bold text-[#6B7365] font-mono uppercase pl-1">Email Address</span>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7365]" />
              <input 
                type="email" 
                placeholder="krishna@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs pl-10 pr-4 py-3 bg-[#E5DDD0]/80 border border-[#3D4833]/25 rounded-xl outline-none text-[#2A3226] placeholder-[#6B7365]/50 focus:border-[#3D4833]/50 shadow-inner"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 relative">
            <span className="text-[9px] font-bold text-[#6B7365] font-mono uppercase pl-1">Secure Password</span>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7365]" />
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs pl-10 pr-4 py-3 bg-[#E5DDD0]/80 border border-[#3D4833]/25 rounded-xl outline-none text-[#2A3226] placeholder-[#6B7365]/50 focus:border-[#3D4833]/50 shadow-inner"
              />
            </div>
          </div>

          {isRegister && (
            <div className="flex flex-col gap-1 relative">
              <span className="text-[9px] font-bold text-[#6B7365] font-mono uppercase pl-1">Confirm Password</span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7365]" />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full text-xs pl-10 pr-4 py-3 bg-[#E5DDD0]/80 border border-[#3D4833]/25 rounded-xl outline-none text-[#2A3226] placeholder-[#6B7365]/50 focus:border-[#3D4833]/50 shadow-inner"
                />
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-3 mt-2 rounded-xl text-xs font-bold bg-[#3D4833] hover:bg-[#2A3226] text-[#F5EFE4] flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-4.5 h-4.5 rounded-full border-2 border-[#F5EFE4] border-t-transparent animate-spin" />
            ) : (
              <>
                <span>{isRegister ? "Register & Enter" : "Login Securely"}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-[#3D4833]/15"></div>
          <span className="flex-shrink mx-4 text-[9px] text-[#6B7365]/70 font-bold font-mono uppercase">Or Sign In With</span>
          <div className="flex-grow border-t border-[#3D4833]/15"></div>
        </div>

        <div className="flex flex-col gap-3.5 w-full items-center">
          <style>{`
            #googleBtn:not(:empty) ~ #customGoogleBtn {
              display: none !important;
            }
          `}</style>

          <div id="googleBtn" className="w-full flex justify-center empty:hidden"></div>

          <div id="customGoogleBtn" className="w-full">
            <button 
              type="button"
              onClick={() => setErrorMsg("Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google Sign-In.")}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-[#FAF6E8] hover:bg-[#FAF6E8]/85 text-[#2A3226] border border-[#3D4833]/20 flex items-center justify-center gap-2.5 transition-all shadow-sm active:scale-98 hover:scale-[1.01] disabled:opacity-50 font-sans"
            >
              <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button 
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMsg(null);
            }}
            className="text-xs text-[#3D4833] hover:text-[#2A3226] font-semibold underline"
          >
            {isRegister 
              ? "Already have an account? Log In" 
              : "Need a personal account? Register here"
            }
          </button>
        </div>
      </motion.div>
    </div>
  );
}
