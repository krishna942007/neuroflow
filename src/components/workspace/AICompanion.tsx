"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { 
  Bot, 
  Heart, 
  Send, 
  Volume2, 
  VolumeX, 
  Mic, 
  X, 
  Cpu, 
  Sparkles,
  Activity,
  Award,
  Palette
} from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/workspaceStore";
import { useUIStore, CompanionState } from "@/lib/store/uiStore";
import { useAuthStore } from "@/lib/store/authStore";
import { requestAIJson } from "@/lib/ai/client";
import Puppy3D from "./Puppy3D";

interface ChatMessage {
  id: string;
  sender: "user" | "newton";
  text: string;
  timestamp: number;
}

export default function AICompanion() {
  const { files } = useWorkspaceStore();
  const { user } = useAuthStore();
  const userName = user?.fullName ? user.fullName.split(" ")[0] : "User";

  const activeModule = useUIStore((s) => s.activeModule);
  const setActiveModule = useUIStore((s) => s.setActiveModule);
  const state = useUIStore((s) => s.companionState);
  const setState = useUIStore((s) => s.setCompanionState);
  const furColor = useUIStore((s) => s.furColor);
  const setFurColor = useUIStore((s) => s.setFurColor);
  const collarColor = useUIStore((s) => s.collarColor);
  const setCollarColor = useUIStore((s) => s.setCollarColor);
  const earType = useUIStore((s) => s.earType);
  const setEarType = useUIStore((s) => s.setEarType);
  const dogScale = useUIStore((s) => s.dogScale);
  const setDogScale = useUIStore((s) => s.setDogScale);
  const isSitting = useUIStore((s) => s.isSitting);
  const setIsSitting = useUIStore((s) => s.setIsSitting);
  const voiceEnabled = useUIStore((s) => s.voiceEnabled);
  const setVoiceEnabled = useUIStore((s) => s.setVoiceEnabled);

  const [mounted, setMounted] = useState(false);
  const [bubbleText, setBubbleText] = useState<string>("Hi! Let's do some work.");
  const [showBubble, setShowBubble] = useState(true);
  const [loveCount, setLoveCount] = useState(25);

  // Chat Panel states
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [panelTab, setPanelTab] = useState<"chat" | "design">("chat");
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Voice Settings
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const recognitionRef = useRef<any>(null);
  const backgroundRecRef = useRef<any>(null);

  // Coordinates and positions
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [constraints, setConstraints] = useState({ left: 0, right: 0, top: 0, bottom: 0 });

  const clampPos = (pos: { x: number; y: number }) => {
    if (typeof window === "undefined") return pos;
    const padding = 12;
    const minX = -(window.innerWidth - 160 - 24 - padding);
    const maxX = 0;
    const minY = -(window.innerHeight - 160 - 24 - padding);
    const maxY = 0;
    return {
      x: Math.max(minX, Math.min(maxX, pos.x)),
      y: Math.max(minY, Math.min(maxY, pos.y))
    };
  };

  const [inactivityTimer, setInactivityTimer] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const panelDragControls = useDragControls();

  // Background Mic Reset triggers
  const [bgMicReset, setBgMicReset] = useState(0);

  useEffect(() => {
    const handleRestartBgMic = () => {
      setBgMicReset(prev => prev + 1);
    };
    window.addEventListener("restart-newton-bg-mic", handleRestartBgMic);
    return () => {
      window.removeEventListener("restart-newton-bg-mic", handleRestartBgMic);
    };
  }, []);

  // Watch microphone permission state changes to auto-restart background listening
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.permissions) return;
    
    let active = true;
    navigator.permissions.query({ name: 'microphone' as any }).then((permissionStatus) => {
      if (!active) return;
      
      const handlePermissionChange = () => {
        if (permissionStatus.state === 'granted') {
          window.dispatchEvent(new Event("restart-newton-bg-mic"));
        }
      };
      
      permissionStatus.onchange = handlePermissionChange;
      // Trigger initially if already granted
      if (permissionStatus.state === 'granted') {
        window.dispatchEvent(new Event("restart-newton-bg-mic"));
      }
    }).catch(e => console.warn("Permissions API not supported for microphone:", e));

    return () => {
      active = false;
    };
  }, []);

  const setBubble = (text: string, duration = 4500) => {
    setBubbleText(text);
    setShowBubble(true);
    const t = setTimeout(() => setShowBubble(false), duration);
    return () => clearTimeout(t);
  };

  // 1. SSR Hydration mount & config loading
  useEffect(() => {
    setMounted(true);
    const savedPos = localStorage.getItem("newton_position_3d") || localStorage.getItem("sherlock_position_3d");
    if (savedPos) {
      try { 
        const parsed = JSON.parse(savedPos);
        setDragPos(clampPos(parsed));
      } catch (e) {}
    }
    const savedLove = localStorage.getItem("newton_love_hp") || localStorage.getItem("sherlock_love_hp");
    if (savedLove) {
      setLoveCount(parseInt(savedLove, 10));
    }
    const savedFur = localStorage.getItem("newton_fur_color");
    if (savedFur) setFurColor(savedFur);
    const savedCollar = localStorage.getItem("newton_collar_color");
    if (savedCollar) setCollarColor(savedCollar);
    const savedEar = localStorage.getItem("newton_ear_type");
    if (savedEar) setEarType(savedEar as any);
    const savedScale = localStorage.getItem("newton_scale");
    if (savedScale) setDogScale(parseFloat(savedScale));
    const savedVoice = localStorage.getItem("newton_voice_enabled");
    if (savedVoice) {
      setVoiceEnabled(savedVoice !== "false");
    }

    const handleMicTrigger = () => {
      setIsPanelExpanded(true);
      startSpeechRecognition();
    };
    window.addEventListener("newton-mic-trigger", handleMicTrigger);
    return () => {
      window.removeEventListener("newton-mic-trigger", handleMicTrigger);
    };
  }, []);

  // 1b. Initialize welcome messages dynamically when userName or mount state changes
  useEffect(() => {
    if (mounted) {
      setBubbleText(`Hi ${userName}! Let's do some work.`);
      setChatHistory([
        {
          id: "msg-welcome",
          sender: "newton",
          text: `Hey ${userName}! I'm Newton, your 3D AI companion. Ask me anything, or speak 'hey newton' directly! 🐕✨`,
          timestamp: Date.now()
        }
      ]);
    }
  }, [userName, mounted]);

  // Listen to window resize to update boundaries and clamp position
  useEffect(() => {
    if (!mounted) return;
    const updateConstraints = () => {
      const padding = 12;
      const leftBound = -(window.innerWidth - 160 - 24 - padding);
      const rightBound = 0;
      const topBound = -(window.innerHeight - 160 - 24 - padding);
      const bottomBound = 0;
      setConstraints({
        left: leftBound,
        right: rightBound,
        top: topBound,
        bottom: bottomBound
      });
      setDragPos(prev => clampPos(prev));
    };

    updateConstraints();
    window.addEventListener("resize", updateConstraints);
    return () => window.removeEventListener("resize", updateConstraints);
  }, [mounted]);

  // Save customizations
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("newton_fur_color", furColor);
    localStorage.setItem("newton_collar_color", collarColor);
    localStorage.setItem("newton_ear_type", earType);
    localStorage.setItem("newton_scale", dogScale.toString());
    localStorage.setItem("newton_voice_enabled", voiceEnabled ? "true" : "false");
  }, [furColor, collarColor, earType, dogScale, voiceEnabled, mounted]);

  // 3. Continuous Background Wake-Word listener
  useEffect(() => {
    if (!mounted) return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let active = true;
    let bgRecInstance: any = null;

    const startBackgroundListening = () => {
      if (!active || isListeningVoice) return;
      
      try {
        if (bgRecInstance) {
          try { bgRecInstance.abort(); } catch (e) {}
        }

        const bgRec = new SpeechRecognition();
        bgRec.continuous = true;
        bgRec.interimResults = true;
        bgRec.lang = "en-US";

        bgRec.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript.toLowerCase();
            
            // Match wake words
            if (
              transcript.includes("newton") || 
              transcript.includes("sherlock") || 
              transcript.includes("hey newton") || 
              transcript.includes("hey sherlock") ||
              transcript.includes("hello newton") ||
              transcript.includes("hello sherlock") ||
              transcript.includes("wake up")
            ) {
              try { bgRec.abort(); } catch (e) {}
              
              setIsPanelExpanded(true);
              setState("excited");
              
              const greetings = [
                "Yes! Newton is here, how can I help you?",
                `Woof! Ready to help you, ${userName}!`,
                `Hey ${userName}! Newton is listening, what should we do?`
              ];
              const greetText = greetings[Math.floor(Math.random() * greetings.length)];
              setBubble(greetText);
              speakResponse(greetText);
              
              setTimeout(() => {
                startSpeechRecognition();
              }, 950);
              break;
            }
          }
        };

        bgRec.onerror = (e: any) => {
          console.warn("Background Speech Recognition error:", e.error);
          if (e.error === "not-allowed" || e.error === "service-not-allowed") {
            // Mic access is blocked or has not been granted yet.
            // We stop active retries to prevent console flooding and CPU cycles.
            active = false;
          }
        };

        bgRec.onend = () => {
          if (active && !isListeningVoice) {
            // Prevent fast recursive restarts by adding a small delay
            setTimeout(() => {
              if (active && !isListeningVoice) {
                try { bgRec.start(); } catch (e) {}
              }
            }, 1000);
          }
        };

        bgRecInstance = bgRec;
        backgroundRecRef.current = bgRec;
        bgRec.start();
      } catch (err) {
        console.warn("Background speech recognition failed:", err);
      }
    };

    // satisfies the browser's User Activation Gate requirement by starting on first user interaction
    const handleUserInteraction = () => {
      startBackgroundListening();
      // Remove listeners once successfully activated
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);
    };

    // Listen to standard clicks or keydown events to bootstrap background listening
    window.addEventListener("click", handleUserInteraction);
    window.addEventListener("keydown", handleUserInteraction);

    return () => {
      active = false;
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);
      if (bgRecInstance) {
        try { bgRecInstance.abort(); } catch (e) {}
      }
    };
  }, [mounted, isListeningVoice, userName, bgMicReset]);

  // 4. Inactivity Monitor
  useEffect(() => {
    const handleResetInactivity = () => {
      setInactivityTimer(0);
    };

    window.addEventListener("mousemove", handleResetInactivity);
    window.addEventListener("keydown", handleResetInactivity);
    window.addEventListener("click", handleResetInactivity);

    const timer = setInterval(() => {
      setInactivityTimer(prev => prev + 1);
    }, 1000);

    return () => {
      window.removeEventListener("mousemove", handleResetInactivity);
      window.removeEventListener("keydown", handleResetInactivity);
      window.removeEventListener("click", handleResetInactivity);
      clearInterval(timer);
    };
  }, []);

  // 4b. React to Inactivity
  useEffect(() => {
    if (inactivityTimer === 90) {
      setState("confused");
      const prompts = [
        `Are you still working, ${userName}? Need me to review anything?`,
        "I'm keeping an eye on your workspace files! 📁🐕",
        "Need a quick break or help with coding queries?",
        "Newton is ready for active research requests! ⚡"
      ];
      const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
      setBubble(randomPrompt);
      speakResponse(randomPrompt);
      setTimeout(() => setState("idle"), 3000);
    }
  }, [inactivityTimer, userName]);

  // 5. React to Active Module Changes
  useEffect(() => {
    if (!mounted) return;
    setState("happy");
    const moduleAlerts: Record<string, string> = {
      dashboard: "Heading back to the Dashboard! Let's check our stats.",
      chat: "AI Chat mode is active! Let's write some creative prompts.",
      research: "Crawler active! Let's run factual deep-web web audits.",
      resume: "Resume scanner ready! I can help check ATS formatting rules.",
      study: "Study desk loaded! Shall we parse MCQs or flashcards?",
      website: "Website Designer active! Let's design premium HTML templates.",
      presentation: "Presentation deck builder is active! Let's write outline slides."
    };
    if (moduleAlerts[activeModule]) {
      setBubble(moduleAlerts[activeModule], 4500);
    }
    setTimeout(() => setState("idle"), 2200);
  }, [activeModule, mounted]);

  // Scroll chat to bottom helper
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isPanelExpanded]);

  const handleDragEnd = (event: any, info: any) => {
    const nextPos = { x: dragPos.x + info.offset.x, y: dragPos.y + info.offset.y };
    const clamped = clampPos(nextPos);
    localStorage.setItem("newton_position_3d", JSON.stringify(clamped));
    setDragPos(clamped);
  };

  const speakResponse = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !voiceEnabled) return;
    window.speechSynthesis.cancel();
    
    const cleanText = text.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google")) 
      || voices.find(v => v.lang.startsWith("en"));
    
    if (englishVoice) utterance.voice = englishVoice;
    utterance.pitch = 1.25; 
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  const startSpeechRecognition = () => {
    if (typeof window === "undefined") return;
    
    if (backgroundRecRef.current) {
      try { backgroundRecRef.current.abort(); } catch (e) {}
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition API is not supported in this browser. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListeningVoice(true);
      setState("excited");
      setBubble(`I'm listening, ${userName}... 🎤🐕`);
      window.dispatchEvent(new Event("restart-newton-bg-mic"));
    };

    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setIsListeningVoice(false);
      setState("happy");
      setBubble(`You said: "${transcript}"`);
      handleSendChatMessage(transcript);
    };

    recognition.onerror = () => {
      setIsListeningVoice(false);
      setState("confused");
      setBubble("Oops, I couldn't hear that clearly. Try again!");
      setTimeout(() => setState("idle"), 2000);
    };

    recognition.onend = () => {
      setIsListeningVoice(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSendChatMessage = async (overrideText?: string) => {
    const textToSend = overrideText || chatMessage;
    if (!textToSend.trim() || isGenerating) return;

    setChatMessage("");
    setIsGenerating(true);
    setState("thinking");

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: "user",
      text: textToSend,
      timestamp: Date.now()
    };
    setChatHistory(prev => [...prev, userMsg]);

    try {
      const result = await requestAIJson<{ 
        reply: string; 
        navigation?: string; 
        state?: CompanionState;
        action?: {
          type: "write" | "generate";
          target: "chat_input" | "website_prompt" | "presentation_prompt" | "study_query" | "resume_skills";
          value: string;
        };
      }>("companion", {
        query: textToSend,
        activeModule,
        workspaceFilesCount: files.length,
        userName,
        history: chatHistory.slice(-8)
      });

      const replyText = result.reply || "Woof! I'm ready to help you coordinate tasks.";
      const targetState = result.state || "happy";
      const targetNav = result.navigation;
      
      const companionMsg: ChatMessage = {
        id: `msg-${Date.now()}-newton`,
        sender: "newton",
        text: replyText,
        timestamp: Date.now()
      };

      setChatHistory(prev => [...prev, companionMsg]);
      setState(targetState);
      setBubble(replyText.length > 50 ? `${replyText.slice(0, 48)}...` : replyText);
      
      speakResponse(replyText);

      if (targetNav) {
        const validModules = ["dashboard", "chat", "research", "resume", "study", "website", "presentation"];
        if (validModules.includes(targetNav)) {
          setTimeout(() => {
            setActiveModule(targetNav as any);
            setBubble(`Navigating to the ${targetNav} module! 🐕🚀`);
          }, 600);
        }
      }

      if (result.action) {
        const { type, target, value } = result.action;
        const targetModuleMap: Record<string, any> = {
          chat_input: "chat",
          website_prompt: "website",
          presentation_prompt: "presentation",
          study_query: "study",
          resume_skills: "resume",
        };
        const mappedModule = targetModuleMap[target];
        if (mappedModule) {
          setTimeout(() => {
            setActiveModule(mappedModule);
          }, 200);
        }

        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("newton-action", {
            detail: { type, target, value }
          }));
          window.dispatchEvent(new CustomEvent("sherlock-action", {
            detail: { type, target, value }
          }));
          setBubble(type === "generate" ? `Generating ${target.replace("_", " ")}... 🐕⚡` : `Writing to ${target.replace("_", " ")}... 🐕✍️`);
        }, 800);
      }
      
      setLoveCount(prev => {
        const next = Math.min(100, prev + 2);
        localStorage.setItem("newton_love_hp", next.toString());
        return next;
      });

    } catch (error) {
      console.error("Newton chat failed:", error);
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        sender: "newton",
        text: `My neural synaptic links got crossed. Can you repeat that, ${userName}? Woof!`,
        timestamp: Date.now()
      };
      setChatHistory(prev => [...prev, errorMsg]);
      setState("confused");
    } finally {
      setIsGenerating(false);
      setTimeout(() => setState("idle"), 3000);
    }
  };

  const handleDownload3DModel = async () => {
    setState("excited");
    setBubble("Exporting my 3D mesh... Stand by! 🐕🚀");

    // Dynamic export trigger via window custom event since mesh is inside Puppy3D Canvas
    try {
      window.dispatchEvent(new CustomEvent("newton-export-mesh"));
      setBubble("Mesh exported! Check your downloads!");
      setState("happy");
    } catch (err) {
      console.error("3D export trigger failed:", err);
      setBubble("Oops, export failed. Please try again!");
      setState("confused");
    }
  };

  const handlePuppyClick = () => {
    if (state === "sleeping") {
      setState("idle");
      setBubble("Yawwn... Newton is awake!");
      return;
    }
    const clickStates: CompanionState[] = ["happy", "naughty", "excited", "confused"];
    const randomState = clickStates[Math.floor(Math.random() * clickStates.length)];
    setState(randomState);

    const replies = [
      "Woof! That tickles!",
      `Need any suggestions, ${userName}?`,
      "Let's tackle these coding modules!",
      "I'm feeling 100% optimized today!",
      "Double-click me to open my full controls!"
    ];
    setBubble(replies[Math.floor(Math.random() * replies.length)]);
    
    setLoveCount(prev => {
      const next = Math.min(100, prev + 1);
      localStorage.setItem("newton_love_hp", next.toString());
      return next;
    });

    setTimeout(() => setState("idle"), 2500);
  };

  const toggleSit = () => {
    setIsSitting(!isSitting);
    setState("happy");
    setBubble(isSitting ? "Standing up! Ready to crawl links." : "Sitting nicely. Woof! 🐕", 3000);
    setTimeout(() => setState("idle"), 2000);
  };

  const handleNap = () => {
    if (state === "sleeping") {
      setState("idle");
      setBubble("Waking up! Good morning, boss.");
    } else {
      setState("sleeping");
      setBubble("Zzz... napping in safe mode.", 4000);
    }
  };

  if (!mounted) return null;

  // Do not show the floating companion on the dashboard tab unless active (expanded panel or listening to voice)
  if (activeModule === "dashboard" && !isPanelExpanded && !isListeningVoice) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-end pointer-events-none select-none font-sans">

      {/* ── 2. GLASSMORPHISM CHAT & COMPANION PANEL ──────────────────────── */}
      <AnimatePresence>
        {isPanelExpanded && (
          <motion.div
            drag
            dragControls={panelDragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0.05}
            initial={{ opacity: 0, scale: 0.92, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.92, x: 20 }}
            transition={{ type: "spring", stiffness: 140, damping: 18 }}
            className="absolute bottom-28 right-2 pointer-events-auto w-[370px] h-[520px] rounded-3xl bg-[#F0E8DC]/80 backdrop-blur-2xl border border-white/60 shadow-2xl flex flex-col overflow-hidden z-50"
          >
            {/* Header bar */}
            <div 
              onPointerDown={(e) => panelDragControls.start(e)}
              className="px-5 py-4 border-b border-[#3D4833]/8 flex items-center justify-between bg-[#F0E8DC]/20 cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center gap-2 pointer-events-none">
                <Bot className="h-4.5 w-4.5 text-[#3D4833]/80 animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-[#2A3226] leading-none">Newton Companion</span>
                  <span className="text-[8px] font-mono text-[#3D4833]/45 uppercase mt-0.5 tracking-wider">INTELLIGENCE V3.0</span>
                </div>
              </div>
              
              <button 
                onClick={() => setIsPanelExpanded(false)}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1 rounded-full hover:bg-black/5 text-[#2A3226]/60 hover:text-black transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Subheader tabs */}
            <div className="flex border-b border-[#3D4833]/8 bg-[#F0E8DC]/10">
              <button 
                onClick={() => setPanelTab("chat")}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${panelTab === "chat" ? "bg-[#F0E8DC]/40 text-[#3D4833] border-b-2 border-[#3D4833]" : "text-[#2A3226]/50 hover:bg-[#F0E8DC]/10"}`}
              >
                <Bot className="h-3 w-3" />
                <span>Companion Chat</span>
              </button>
              <button 
                onClick={() => setPanelTab("design")}
                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${panelTab === "design" ? "bg-[#F0E8DC]/40 text-[#3D4833] border-b-2 border-[#3D4833]" : "text-[#2A3226]/50 hover:bg-[#F0E8DC]/10"}`}
              >
                <Palette className="h-3 w-3" />
                <span>3D Labs & Styling</span>
              </button>
            </div>

            {/* Split panel Content Area */}
            {panelTab === "chat" ? (
              <div className="flex-1 flex overflow-hidden">
                {/* Left Widget Sidebar */}
                <div className="w-[110px] border-r border-[#3D4833]/8 bg-[#3D4833]/5 p-3.5 flex flex-col gap-4 text-[#2A3226]">
                  
                  {/* Affection Stat */}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-bold font-mono text-[#3D4833]/40 uppercase tracking-widest">Affection</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" />
                      <span className="text-xs font-bold text-[#2A3226] font-mono">{loveCount}%</span>
                    </div>
                  </div>

                  {/* State badge */}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-bold font-mono text-[#3D4833]/40 uppercase tracking-widest">State</span>
                    <span className="text-[10px] font-bold text-[#2A3226] capitalize flex items-center gap-1.5 mt-0.5">
                      <Activity className="h-3 w-3 text-emerald-800 animate-pulse" />
                      {state}
                    </span>
                  </div>

                  {/* Actions quick shortcuts */}
                  <div className="flex flex-col gap-1.5 mt-auto">
                    <button 
                      onClick={toggleSit}
                      className="w-full py-1.5 rounded-lg border border-[#3D4833]/10 bg-[#F0E8DC]/80 text-[10px] font-semibold text-center hover:bg-[#3D4833] hover:text-white transition-all cursor-pointer"
                    >
                      {isSitting ? "Stand Up" : "Sit Nicely"}
                    </button>
                    <button 
                      onClick={handleNap}
                      className="w-full py-1.5 rounded-lg border border-[#3D4833]/10 bg-[#F0E8DC]/80 text-[10px] font-semibold text-center hover:bg-[#3D4833] hover:text-white transition-all cursor-pointer"
                    >
                      {state === "sleeping" ? "Wake Up" : "Sleep Mode"}
                    </button>
                  </div>
                </div>

                {/* Right Chat feed area */}
                <div className="flex-1 flex flex-col bg-[#F0E8DC]/10">
                  {/* Scroll Area */}
                  <div 
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin"
                  >
                    {chatHistory.map((msg) => (
                      <div 
                        key={msg.id}
                        className={`flex flex-col max-w-[85%] ${msg.sender === "user" ? 'self-end items-end' : 'self-start items-start'}`}
                      >
                        <div className={`px-3 py-2 rounded-2xl text-[11px] leading-relaxed shadow-sm ${msg.sender === "user" ? 'bg-[#3D4833] text-[#F5EFE4] rounded-br-none' : 'bg-[#E5DDD0] text-[#2A3226] rounded-bl-none border border-[#3D4833]/5'}`}>
                          {msg.text}
                        </div>
                        <span className="text-[8px] text-[#2A3226]/35 mt-1 font-mono" suppressHydrationWarning>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                    {isGenerating && (
                      <div className="self-start flex gap-1 items-center bg-[#E5DDD0]/50 p-2.5 rounded-2xl border border-[#3D4833]/5 animate-pulse">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#3D4833] animate-bounce" />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#3D4833] animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#3D4833] animate-bounce [animation-delay:0.4s]" />
                      </div>
                    )}
                  </div>

                  {/* Input bar */}
                  <div className="p-3 border-t border-[#3D4833]/8 flex flex-col gap-2 bg-[#F0E8DC]/20">
                    {/* Context Aware Recommendation Buttons */}
                    {activeModule === "resume" && (
                      <button 
                        onClick={() => handleSendChatMessage("Can you run an ATS compatibility audit on my resume?")}
                        className="text-[9px] font-semibold text-[#3D4833]/80 hover:text-white bg-[#F0E8DC] hover:bg-[#3D4833] px-2.5 py-1 rounded-full border border-[#3D4833]/10 self-start transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Award className="h-3 w-3" />
                        <span>Audit Resume ATS Compatibility</span>
                      </button>
                    )}
                    {activeModule === "study" && (
                      <button 
                        onClick={() => handleSendChatMessage("Review my study notes and outline the core concepts.")}
                        className="text-[9px] font-semibold text-[#3D4833]/80 hover:text-white bg-[#F0E8DC] hover:bg-[#3D4833] px-2.5 py-1 rounded-full border border-[#3D4833]/10 self-start transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Review Study Notes & Concepts</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1.5">
                      <input 
                        type="text" 
                        placeholder="Ask Newton..."
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSendChatMessage();
                        }}
                        className="flex-1 text-[11px] p-2 bg-[#F0E8DC] border border-[#3D4833]/12 rounded-xl outline-none focus:border-[#3D4833] text-[#2A3226] placeholder-[#2A3226]/40"
                      />

                      {/* Mic Button */}
                      <button 
                        onClick={startSpeechRecognition}
                        disabled={isListeningVoice}
                        className={`p-2 rounded-xl border transition-all cursor-pointer shadow-sm ${isListeningVoice ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'bg-[#F0E8DC] border-[#3D4833]/12 hover:bg-black/5 text-[#3D4833]'}`}
                        title="Speak (Voice Command)"
                      >
                        <Mic className="h-3.5 w-3.5" />
                      </button>

                      {/* TTS Sound toggle */}
                      <button 
                        onClick={() => setVoiceEnabled(!voiceEnabled)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer shadow-sm ${voiceEnabled ? 'bg-[#F0E8DC]/80 border-[#3D4833]/12 text-[#3D4833] hover:bg-[#F0E8DC]' : 'bg-[#F0E8DC] border-[#3D4833]/12 hover:bg-black/5 text-[#3D4833]/45'}`}
                        title={voiceEnabled ? "Mute Voice replies" : "Enable Voice reply read-out"}
                      >
                        {voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                      </button>

                      {/* Send Button */}
                      <button 
                        onClick={() => handleSendChatMessage()}
                        disabled={!chatMessage.trim() || isGenerating}
                        className={`p-2 rounded-xl transition-all cursor-pointer ${chatMessage.trim() && !isGenerating ? 'bg-[#3D4833] hover:bg-[#2A3226] text-white shadow-md' : 'bg-black/5 text-[#3D4833]/30 cursor-not-allowed border border-transparent'}`}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Customizer 3D Labs */
              <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-4.5 bg-[#F0E8DC]/30 text-[#2A3226] scrollbar-thin">
                <div>
                  <h3 className="text-[12px] font-bold tracking-tight">Style & Customize Newton</h3>
                  <p className="text-[9px] text-[#2A3226]/65 leading-normal">
                    Tweak and adjust Newton's breed visuals and export the full procedural 3D mesh structure.
                  </p>
                </div>

                {/* 1. Fur color swatches */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold font-mono text-[#3D4833]/55 uppercase tracking-wider">Fur Color Selection</span>
                  <div className="flex items-center gap-2">
                    {[
                      { name: "Golden Shimmer", color: "#e2a65e" },
                      { name: "Chocolate Brown", color: "#7c4a24" },
                      { name: "Midnight Black", color: "#2c2c2c" },
                      { name: "Snow White", color: "#fcf8f2" },
                    ].map((swatch) => (
                      <button
                        key={swatch.color}
                        onClick={() => setFurColor(swatch.color)}
                        className={`w-7 h-7 rounded-full border transition-all cursor-pointer shadow-sm relative flex items-center justify-center ${furColor === swatch.color ? "border-[#3D4833] ring-2 ring-[#3D4833]/20 scale-105" : "border-black/10 hover:scale-105"}`}
                        style={{ backgroundColor: swatch.color }}
                        title={swatch.name}
                      >
                        {furColor === swatch.color && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F0E8DC] mix-blend-difference" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Collar color swatches */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold font-mono text-[#3D4833]/55 uppercase tracking-wider">Collar Accessory Color</span>
                  <div className="flex items-center gap-2">
                    {[
                      { name: "Ruby Red", color: "#b91c1c" },
                      { name: "Royal Blue", color: "#1d4ed8" },
                      { name: "Emerald Green", color: "#047857" },
                      { name: "Cosmic Purple", color: "#7e22ce" },
                    ].map((swatch) => (
                      <button
                        key={swatch.color}
                        onClick={() => setCollarColor(swatch.color)}
                        className={`w-7 h-7 rounded-full border transition-all cursor-pointer shadow-sm relative flex items-center justify-center ${collarColor === swatch.color ? "border-[#3D4833] ring-2 ring-[#3D4833]/20 scale-105" : "border-black/10 hover:scale-105"}`}
                        style={{ backgroundColor: swatch.color }}
                        title={swatch.name}
                      >
                        {collarColor === swatch.color && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F0E8DC] mix-blend-difference" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Ear Type */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold font-mono text-[#3D4833]/55 uppercase tracking-wider">Ear Type Anatomy</span>
                  <div className="flex gap-2 p-0.5 bg-black/5 border border-[#3D4833]/8 rounded-xl">
                    <button
                      onClick={() => setEarType("floppy")}
                      className={`flex-1 py-1.5 rounded-lg text-[9px] font-semibold transition-all cursor-pointer ${earType === "floppy" ? "bg-[#F0E8DC] text-[#3D4833] shadow-sm font-bold" : "text-[#2A3226]/60 hover:text-[#2A3226]"}`}
                    >
                      Floppy Ears
                    </button>
                    <button
                      onClick={() => setEarType("perked")}
                      className={`flex-1 py-1.5 rounded-lg text-[9px] font-semibold transition-all cursor-pointer ${earType === "perked" ? "bg-[#F0E8DC] text-[#3D4833] shadow-sm font-bold" : "text-[#2A3226]/60 hover:text-[#2A3226]"}`}
                    >
                      Perked Husky Ears
                    </button>
                  </div>
                </div>

                {/* 4. Dog Scale */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold font-mono text-[#3D4833]/55 uppercase tracking-wider">Dimension Scaling</span>
                  <div className="flex gap-2">
                    {[
                      { label: "Pocket Pup", value: 0.7 },
                      { label: "Standard", value: 1.0 },
                      { label: "Giant Hound", value: 1.3 },
                    ].map((sz) => (
                      <button
                        key={sz.value}
                        onClick={() => setDogScale(sz.value)}
                        className={`flex-1 py-1.5 rounded-xl border text-[9px] font-semibold transition-all cursor-pointer ${dogScale === sz.value ? "bg-[#3D4833] border-[#3D4833] text-white shadow-sm font-bold" : "bg-[#F0E8DC] border-[#3D4833]/10 text-[#2A3226]/75 hover:bg-black/5"}`}
                      >
                        {sz.label}
                      </button>
                    ))}
                  </div>
                </div>

                    {/* 5. Feelings & Expressions */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] font-bold font-mono text-[#3D4833]/55 uppercase tracking-wider">Newton's Feelings & Expressions</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Happy 😊", value: "happy" as const, text: "Woof! I'm feeling wonderful today!" },
                          { label: "Excited ⚡", value: "excited" as const, text: "Yay! Let's code and build awesome projects!" },
                          { label: "Playful 🤪", value: "naughty" as const, text: "Hehe! Look at my floppy ears wiggle!" },
                          { label: "Confused 🧐", value: "confused" as const, text: "Hmm? Can you explain that query again?" },
                          { label: "Thinking 🧠", value: "thinking" as const, text: "Processing neural algorithms..." },
                          { label: "Sad 🥺", value: "sad" as const, text: "Aww... Did we get a bug in compilation?" },
                          { label: "Spinning 🌀", value: "spinning" as const, text: "Look at my tail go! Wheee!" },
                          { label: "Sleeping 💤", value: "sleeping" as const, text: "Zzz... low power mode activated." }
                        ].map((mood) => (
                          <button
                            key={mood.value}
                            onClick={() => {
                              setState(mood.value);
                              setBubble(mood.text, 4000);
                              if (mood.value !== "sleeping") {
                                setTimeout(() => {
                                  setState("idle");
                                }, 3500);
                              }
                            }}
                            className={`py-1.5 px-1 rounded-xl border text-[9px] font-semibold transition-all cursor-pointer truncate ${state === mood.value ? "bg-[#3D4833] border-[#3D4833] text-white shadow-sm font-bold" : "bg-[#F0E8DC] border-[#3D4833]/10 text-[#2A3226]/75 hover:bg-black/5"}`}
                          >
                            {mood.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 6. OBJ Model Exporter */}
                    <div className="mt-auto pt-3 border-t border-[#3D4833]/10">
                      <button
                        onClick={handleDownload3DModel}
                        className="w-full py-3 bg-[#3D4833] hover:bg-[#2A3226] text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98]"
                      >
                        <Cpu className="h-3.5 w-3.5 animate-pulse" />
                        <span>Download 3D Model (.obj)</span>
                      </button>
                    </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3. 3D PROCEDURAL PUPPY CONTAINER ──────────────────────────────── */}
      <motion.div
        ref={containerRef}
        drag
        dragConstraints={constraints}
        dragMomentum
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        onClick={handlePuppyClick}
        onDoubleClick={() => setIsPanelExpanded(!isPanelExpanded)}
        className="pointer-events-auto cursor-grab active:cursor-grabbing relative flex flex-col items-center select-none"
        style={{
          width: 160,
          height: 160,
          x: dragPos.x,
          y: dragPos.y
        }}
      >
        <Puppy3D />
        
        {/* Float dialog bubble lives inside the puppy container so it stays attached */}
        <AnimatePresence>
          {showBubble && !isPanelExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.85, x: "-50%" }}
              animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
              exit={{ opacity: 0, y: 5, scale: 0.9, x: "-50%" }}
              className="absolute bottom-[115%] left-1/2 pointer-events-none w-[190px] bg-[#F0E8DC] border border-[#1c351f]/15 rounded-2xl px-4 py-2.5 shadow-xl text-xs text-[#2A3226] font-medium leading-relaxed z-50 text-center"
              style={{ transformOrigin: "bottom center" }}
            >
              <div className="relative">
                {bubbleText}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#F0E8DC] border-r border-b border-[#1c351f]/15 transform rotate-45 translate-y-1.5" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Hover label */}
        <span className="absolute bottom-1 bg-[#3D4833]/75 text-[8px] font-mono text-[#F5EFE4] px-1.5 py-0.5 rounded opacity-0 hover:opacity-100 transition-opacity pointer-events-none tracking-wider shadow-sm uppercase">
          Newton 3D
        </span>
      </motion.div>

    </div>
  );
}
