"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  ArrowRight, 
  Search, 
  FileText, 
  GraduationCap, 
  Layout, 
  Presentation, 
  Bot, 
  Check, 
  ChevronRight,
  Sliders,
  Play,
  Volume2
} from "lucide-react";
import ThreeHeroBg from "@/components/canvas/ThreeHeroBg"; // We can keep this or remove it, let's change import
import CinematicScrollCanvas from "@/components/canvas/CinematicScrollCanvas";
import AuroraOverlay from "@/components/canvas/AuroraOverlay";
import LiquidGlassCard from "@/components/ui/LiquidGlassCard";
import PreLandingLoader from "@/components/ui/PreLandingLoader";


// Custom hook to create a magnetic hover effect
function useMagnetic<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      el.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px) scale(1.02)`;
    };
    const handleMouseLeave = () => {
      el.style.transform = "";
    };
    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);
  return ref;
}

export default function Home() {
  const [isDaylight, setIsDaylight] = useState(true);
  const [activeBentoTab, setActiveBentoTab] = useState<"chat" | "research" | "resume">("chat");
  const [streamText, setStreamText] = useState("");
  const [pricingPeriod, setPricingPeriod] = useState<"monthly" | "annually">("monthly");
  
  // 3D Tilt state for dashboard mockup
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Pointers follow positions for pricing
  const ctaBtnRef = useMagnetic<HTMLAnchorElement>();
  const secondaryBtnRef = useMagnetic<HTMLAnchorElement>();

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) return;
      const pct = window.scrollY / totalHeight;
      const nextDaylight = pct < 0.60;
      
      setIsDaylight(prev => {
        if (prev !== nextDaylight) return nextDaylight;
        return prev;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);


  // AI Streaming response animation in bento preview
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeBentoTab === "chat") {
      const fullText = "const response = await neuroflow.deepSearch('Competitor dynamics');\nconsole.log(response.metrics);";
      let cursor = 0;
      setTimeout(() => setStreamText(""), 0);
      interval = setInterval(() => {
        if (cursor < fullText.length) {
          setStreamText(prev => prev + fullText.charAt(cursor));
          cursor++;
        } else {
          setTimeout(() => {
            setStreamText("");
            cursor = 0;
          }, 3000);
        }
      }, 50);
    } else if (activeBentoTab === "research") {
      const fullText = "✓ Querying global index...\n✓ Cited: 12 primary sources.\n✓ Compiled PDF Market Report.";
      let cursor = 0;
      setTimeout(() => setStreamText(""), 0);
      interval = setInterval(() => {
        if (cursor < fullText.length) {
          setStreamText(prev => prev + fullText.charAt(cursor));
          cursor++;
        } else {
          setTimeout(() => {
            setStreamText("");
            cursor = 0;
          }, 4000);
        }
      }, 40);
    } else {
      const fullText = "ATS Compatibility Audit:\n• Keywords matched: 92%\n• Layout verification: PASS";
      let cursor = 0;
      setTimeout(() => setStreamText(""), 0);
      interval = setInterval(() => {
        if (cursor < fullText.length) {
          setStreamText(prev => prev + fullText.charAt(cursor));
          cursor++;
        } else {
          setTimeout(() => {
            setStreamText("");
            cursor = 0;
          }, 4000);
        }
      }, 40);
    }
    return () => clearInterval(interval);
  }, [activeBentoTab]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 8, y: -y * 8 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // Determine text coloring based on scroll background states
  const navTextClass = isDaylight ? "text-[#041E05] hover:text-[#0D530E]" : "text-[#E0D6C6] hover:text-white";
  const navBgClass = isDaylight ? "nav-glass-light" : "nav-glass-dark";


  return (
    <div className="relative min-h-screen bg-[#041E05] selection:bg-[#E0D6C6]/40 selection:text-[#FBF5DD] overflow-x-hidden font-sans transition-luxury">
      <PreLandingLoader />
      
      {/* Global Ultra-Fine Film Grain Texture Layer */}
      <div className="fine-grain-overlay" />
      
      {/* Scroll-Driven Cinematic Zen Garden Canvas */}
      <CinematicScrollCanvas />

      {/* Dynamic Aurora Night Overlay */}
      <AuroraOverlay />

      {/* Render ThreeHeroBg (disabled) */}
      {false && <ThreeHeroBg />}


      {/* Floating Translucent Navigation — 64px */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 transition-all duration-500">
        <nav className={`max-w-6xl mx-auto h-16 flex items-center justify-between px-6 rounded-full border transition-all duration-500 ${navBgClass}`}>
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-[#0D530E] to-[#E0D6C6] shadow-md animate-pulse">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className={`text-[15px] font-bold tracking-[-0.02em] transition-colors duration-500 font-display ${isDaylight ? 'text-[#041E05]' : 'text-white'}`}>
              NeuroFlow AI
            </span>
          </div>

          <div className={`hidden md:flex items-center gap-8 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors duration-500 ${navTextClass}`}>
            <a href="#features" className="nav-link transition-colors">Intelligence</a>
            <a href="#preview" className="nav-link transition-colors">Canvas</a>
            <a href="#pricing" className="nav-link transition-colors">Reflections</a>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              href="/workspace" 
              className={`text-[11px] font-bold uppercase tracking-[0.04em] px-5 py-2 rounded-full focus-ring-premium transition-luxury ${
                isDaylight 
                  ? 'btn-glass-light border-[#041E05]/20 text-[#041E05]' 
                  : 'btn-glass-dark border-white/10 text-white'
              }`}
            >
              Enter Workspace
            </Link>
          </div>
        </nav>
      </header>

      {/* Fullscreen Hero Section — 90vh */}
      <section className="relative h-[90vh] min-h-[600px] flex flex-col items-center justify-center px-6 max-w-7xl mx-auto z-10">
        
        {/* Soft floating pill badge */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[11px] font-mono mb-10 transition-colors duration-500 ${isDaylight ? 'text-[#041E05]/80 border-[#041E05]/15' : 'text-[#E0D6C6]/70 border-white/5'}`}
        >
          <span className="flex h-1.5 w-1.5 rounded-full bg-[#3D4833] animate-pulse" />
          <span>NeuroFlow Workspace v1.0 · Organic Intelligence</span>
        </motion.div>

        {/* Editorial Title — Clash Display */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className={`font-display text-[clamp(3rem,8vw,6rem)] font-bold tracking-[-0.04em] text-center max-w-[900px] leading-[0.92] mb-8 transition-colors duration-500 ${isDaylight ? 'text-[#041E05]' : 'text-white'}`}
        >
          The AI Workspace{" "}
          <span className={`bg-gradient-to-r ${isDaylight ? 'from-[#041E05] to-[#3D4833]' : 'from-[#FBF5DD] to-[#E0D6C6]'} bg-clip-text text-transparent`}>
            Built For The Future
          </span>
        </motion.h1>

        {/* Subtitle — Inter, balanced */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className={`text-base sm:text-lg md:text-[19px] text-center max-w-xl leading-[1.7] mb-14 transition-colors duration-500 ${isDaylight ? 'text-[#041E05]/70' : 'text-[#E0D6C6]/65'}`}
        >
          Research, learn, create, analyze and collaborate — all inside a calm, intelligent workspace.
        </motion.p>

        {/* Magnetic Actions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row gap-4 items-center justify-center"
        >
          <Link 
            ref={ctaBtnRef}
            href="/workspace" 
            className={`group focus-ring-premium px-8 py-3.5 rounded-full text-[12px] font-bold tracking-[0.06em] uppercase flex items-center justify-center gap-2.5 transition-luxury ${
              isDaylight 
                ? 'btn-shimmer-light' 
                : 'btn-shimmer-dark'
            }`}
          >
            Launch Free
            <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
          </Link>
          <a 
            ref={secondaryBtnRef}
            href="#features" 
            className={`focus-ring-premium px-8 py-3.5 rounded-full text-[12px] font-bold tracking-[0.06em] uppercase flex items-center justify-center gap-2 transition-luxury ${
              isDaylight 
                ? 'btn-glass-light' 
                : 'btn-glass-dark'
            }`}
          >
            Explore
          </a>
        </motion.div>
      </section>

      {/* Feature Section Bento Grid (Twilight State starts here) */}
      <section id="features" className="relative py-32 px-6 z-10 bg-transparent border-y border-[#FBF5DD]/5 transition-luxury">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center max-w-2xl mx-auto mb-20">
            <span className={`text-[10px] font-bold font-mono tracking-[0.15em] uppercase block mb-4 transition-colors duration-500 ${isDaylight ? 'text-[#041E05]/80' : 'text-[#FBF5DD]/85'}`}>Intelligence Suite</span>
            <h2 className={`font-display text-[clamp(2rem,5vw,3.25rem)] font-semibold tracking-[-0.03em] leading-[1.05] transition-colors duration-500 ${isDaylight ? 'text-[#041E05]' : 'text-white'}`}>
              Sophisticated Tools for
              <br className="hidden sm:block" />
              Organic Thinking
            </h2>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            
            {/* Bento Card 1: Dynamic AI Live Previews */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-2 flex"
            >
              <LiquidGlassCard 
                material="frosted"
                containerClassName="w-full min-h-[380px]"
                className="p-8 flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-radial-glow opacity-20 pointer-events-none" />
                
                <div>
                  <div className="flex gap-2 mb-4">
                    {["chat", "research", "resume"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveBentoTab(tab as "chat" | "research" | "resume")}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all ${activeBentoTab === tab ? 'bg-[#FBF5DD] text-[#041E05]' : 'text-zinc-500 hover:text-white'}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <h3 className="font-display text-[24px] font-semibold text-white tracking-[-0.02em] mb-2">Live AI Simulation Previews</h3>
                  <p className="text-[14px] text-[#FBF5DD]/85 leading-[1.7] max-w-md">
                    Toggle views to watch live streaming responses, query analyzers, and automated ATS keyword evaluations in action.
                  </p>
                </div>

                {/* Streaming Code / Progress output screen */}
                <div className="mt-8 rounded-xl border border-white/5 bg-black/40 p-4 font-mono text-[11px] leading-5 text-zinc-300 min-h-[100px] whitespace-pre-wrap select-none relative">
                  <div className="absolute top-3 right-3 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></div>
                  {streamText || "Initializing compiler thread..."}
                </div>
              </LiquidGlassCard>
            </motion.div>

            {/* Bento Card 2: Slide Builders */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex"
            >
              <LiquidGlassCard 
                material="matte"
                containerClassName="w-full min-h-[380px]"
                className="p-8 flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-radial-glow opacity-25 pointer-events-none" />
                
                <div>
                  <div className="p-2.5 rounded-xl bg-[#F0E8DC]/5 border border-white/5 w-fit mb-5">
                    <Presentation className="h-5 w-5 text-[#E0D6C6]" />
                  </div>
                  <h3 className="font-display text-[22px] font-semibold text-white tracking-[-0.02em] mb-2">Slides & PPTX Generator</h3>
                  <p className="text-[14px] text-[#FBF5DD]/85 leading-[1.7]">
                    Compose visual pitch outlines, edit bullet statement lists, and simulate PowerPoint deck files immediately.
                  </p>
                </div>

                <div className="mt-8 flex flex-col gap-2 border border-white/5 rounded-lg bg-black/25 p-3.5">
                  <div className="h-2 w-full bg-[#F0E8DC]/10 rounded" />
                  <div className="h-2 w-[80%] bg-[#E0D6C6]/30 rounded" />
                  <div className="h-2 w-[40%] bg-[#F0E8DC]/10 rounded" />
                </div>
              </LiquidGlassCard>
            </motion.div>

            {/* Bento Card 3: Deep Web Search */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="flex"
            >
              <LiquidGlassCard 
                material="matte"
                containerClassName="w-full min-h-[300px]"
                className="p-8 flex flex-col justify-between"
              >
                <div>
                  <div className="p-2.5 rounded-xl bg-[#F0E8DC]/5 border border-white/5 w-fit mb-5">
                    <Search className="h-5 w-5 text-[#E0D6C6]" />
                  </div>
                  <h3 className="font-display text-[20px] font-semibold text-white tracking-[-0.02em] mb-2">Deep Web Research</h3>
                  <p className="text-[14px] text-[#FBF5DD]/85 leading-[1.7]">
                    Fact-checker pipelines scan digital assets, compiling citations lists and printable reports.
                  </p>
                </div>
                
                <div className="mt-6 flex -space-x-1 border-t border-white/5 pt-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="w-5 h-5 rounded-full bg-[#E0D6C6] text-[#0D530E] text-[8px] font-bold flex items-center justify-center font-mono">
                      {i + 1}
                    </div>
                  ))}
                  <span className="text-[9px] text-zinc-500 font-mono ml-3 self-center uppercase font-bold">Citations Loaded</span>
                </div>
              </LiquidGlassCard>
            </motion.div>

            {/* Bento Card 4: Study Assistant */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-2 flex"
            >
              <LiquidGlassCard 
                material="frosted"
                containerClassName="w-full min-h-[300px]"
                className="p-8 flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 w-80 h-80 bg-radial-glow opacity-20 pointer-events-none" />
                
                <div>
                  <div className="p-2.5 rounded-xl bg-[#F0E8DC]/5 border border-white/5 w-fit mb-5">
                    <GraduationCap className="h-5 w-5 text-[#E0D6C6]" />
                  </div>
                  <h3 className="font-display text-[22px] font-semibold text-white tracking-[-0.02em] mb-2">AI Study Workspace</h3>
                  <p className="text-[14px] text-[#FBF5DD]/85 leading-[1.7] max-w-md">
                    Upload learning PDF textbooks to instantly compile dynamic flashcard decks, MCQ test quizzes, and concepts explainer cards.
                  </p>
                </div>

                <div className="mt-6 flex gap-4 text-xs font-mono text-[#FBF5DD]/85">
                  <span>• MCQ Quiz check</span>
                  <span>• Concept Scanner</span>
                  <span>• Flashcards</span>
                </div>
              </LiquidGlassCard>
            </motion.div>

          </div>
 
        </div>
      </section>
 
      {/* Dashboard Preview Section (3D Tilt Effect) */}
      <section id="preview" className="relative py-32 px-6 z-10 bg-transparent border-b border-[#FBF5DD]/5 transition-luxury">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl mx-auto text-center flex flex-col items-center"
        >
          
          <div className="max-w-2xl mx-auto mb-16">
            <span className={`text-[10px] font-bold font-mono tracking-[0.15em] uppercase block mb-4 transition-colors duration-500 ${isDaylight ? 'text-[#041E05]/80' : 'text-[#FBF5DD]/85'}`}>Unified Canvas</span>
            <h2 className={`font-display text-[clamp(2rem,5vw,3.25rem)] font-semibold tracking-[-0.03em] leading-[1.05] transition-colors duration-500 ${isDaylight ? 'text-[#041E05]' : 'text-white'}`}>
              A Premium Workspace Preview
            </h2>
          </div>
 
          {/* 3D Tilt Browser Mockup */}
          <div 
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ 
              transform: `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`, 
              transition: "transform 0.15s ease-out",
              transformStyle: "preserve-3d"
            }}
            className="w-full rounded-2xl border border-white/10 p-2.5 bg-black/40 backdrop-blur-xl shadow-2xl relative cursor-pointer select-none hover:border-[#E0D6C6]/30 transition-luxury"
          >
            <div className="rounded-xl overflow-hidden aspect-[16/10] border border-white/5 relative bg-[#041E05]/25 flex flex-col">
              
              {/* Mock Header */}
              <div className="h-10 bg-black/30 border-b border-white/5 px-4 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F0E8DC]/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F0E8DC]/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F0E8DC]/10" />
                </div>
                <div className="mx-auto w-40 h-5 bg-black/40 border border-white/5 rounded-md flex items-center justify-center text-[9px] text-[#E0D6C6] font-mono">
                  neuroflow.ai/workspace
                </div>
                <div className="w-8" />
              </div>
 
              {/* Main Workspace split mockup */}
              <div className="flex flex-1 overflow-hidden text-left text-xs bg-black/10">
                {/* Left Mini Sidebar */}
                <div className="w-40 bg-black/20 border-r border-white/5 p-3 flex flex-col gap-3 shrink-0">
                  <div className="px-2 py-1 bg-[#E0D6C6]/10 border border-[#E0D6C6]/20 rounded flex items-center gap-1.5">
                    <Layout className="h-3 w-3 text-[#E0D6C6]" />
                    <span className="font-mono text-[9px] font-bold text-[#E0D6C6] uppercase tracking-wider">Home Tab</span>
                  </div>
                  <div className="flex-1 flex flex-col gap-1 mt-2">
                    {[
                      { icon: Bot, label: "AI Assistant" },
                      { icon: Search, label: "Research Tool" },
                      { icon: GraduationCap, label: "Flashcards" },
                      { icon: Presentation, label: "Slide Builder" },
                      { icon: FileText, label: "Resume Review" },
                    ].map((item, idx) => (
                      <div key={idx} className={`h-7 rounded flex items-center px-2 gap-2 transition-colors ${idx === 0 ? 'bg-[#F0E8DC]/5 text-white border border-white/5' : 'text-zinc-400 hover:text-zinc-200'}`}>
                        <item.icon className="h-3 w-3 shrink-0" />
                        <span className="text-[9px] font-medium">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
 
                {/* Right Content Workspace */}
                <div className="flex-1 p-5 flex flex-col gap-4 bg-black/5 overflow-hidden">
                  
                  {/* Top Bar inside mockup workspace */}
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-[#E0D6C6]" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold text-white">quantum_physics_paper.pdf</span>
                        <span className="text-[8px] text-zinc-400 font-mono">Size: 4.8MB • Pages: 14</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#E0D6C6]/10 border border-[#E0D6C6]/20 text-[8px] font-mono text-[#E0D6C6] font-bold uppercase animate-pulse">PRO ACTIVE</span>
                  </div>
 
                  {/* Main Grid Area */}
                  <div className="grid grid-cols-3 gap-4 flex-1">
                    
                    {/* Left Column (AI Chat Bubble Mockup) */}
                    <div className="col-span-2 rounded-lg border border-white/5 bg-black/20 p-4 flex flex-col justify-between gap-3 relative">
                      <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                        
                        {/* User Message Bubble */}
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="bg-[#F0E8DC]/5 border border-white/5 rounded-2xl rounded-tr-none px-3 py-2 max-w-[85%]">
                            <p className="text-[9px] text-zinc-300 leading-normal">
                              Summarize the main quantum entanglement experiment details.
                            </p>
                          </div>
                        </div>

                        {/* AI Response Bubble */}
                        <div className="flex items-start gap-2">
                          <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-[#0D530E] to-[#E0D6C6] flex items-center justify-center shrink-0">
                            <Sparkles className="h-2.5 w-2.5 text-[#041E05]" />
                          </div>
                          <div className="bg-[#E0D6C6]/5 border border-[#E0D6C6]/10 rounded-2xl rounded-tl-none px-3 py-2 flex-1">
                            <span className="text-[8px] font-mono text-[#E0D6C6] uppercase block mb-1">NeuroFlow AI</span>
                            <p className="text-[9px] text-zinc-200 leading-relaxed mb-1">
                              I found the key experimental outcomes:
                            </p>
                            <ul className="text-[8px] text-zinc-300 space-y-1 font-sans">
                              <li className="flex items-center gap-1.5">
                                <Check className="h-2.5 w-2.5 text-[#E0D6C6] shrink-0" />
                                Entangled photon pairs achieved 98.4% fidelity
                              </li>
                              <li className="flex items-center gap-1.5">
                                <Check className="h-2.5 w-2.5 text-[#E0D6C6] shrink-0" />
                                Coherence preserved over a distance of 12.4 km
                              </li>
                            </ul>
                          </div>
                        </div>

                      </div>
                      
                      {/* Fake Prompt Input Box */}
                      <div className="h-8 bg-black/40 border border-white/5 rounded-lg px-3 flex items-center justify-between mt-auto">
                        <span className="text-[8px] text-zinc-500 font-mono">Ask NeuroFlow to explain, translate, or code...</span>
                        <div className="h-4.5 w-4.5 rounded bg-[#E0D6C6]/10 border border-[#E0D6C6]/20 flex items-center justify-center cursor-pointer">
                          <ArrowRight className="h-2.5 w-2.5 text-[#E0D6C6]" />
                        </div>
                      </div>

                    </div>
                    
                    {/* Right Column (Metrics Mockup) */}
                    <div className="rounded-lg border border-white/5 bg-black/20 p-4 flex flex-col justify-between items-center gap-4">
                      
                      {/* Circular Gauge */}
                      <div className="flex-1 flex flex-col justify-center items-center gap-2">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                          <svg className="absolute w-full h-full transform -rotate-90">
                            {/* Outer Track Ring */}
                            <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.03)" strokeWidth="3.5" fill="transparent" />
                            {/* Highlight Fill Ring */}
                            <circle cx="32" cy="32" r="26" stroke="#E0D6C6" strokeWidth="3.5" fill="transparent" strokeDasharray="163" strokeDashoffset="13" />
                          </svg>
                          <div className="flex flex-col items-center">
                            <span className="text-[12px] font-bold text-white font-mono">92%</span>
                            <span className="text-[6px] font-mono text-[#E0D6C6] uppercase tracking-wider">match</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-medium text-zinc-300 text-center font-mono">Doc Relevance</span>
                      </div>

                      {/* Micro stats table */}
                      <div className="w-full flex flex-col gap-1.5 border-t border-white/5 pt-3">
                        <div className="flex justify-between text-[7.5px] font-mono">
                          <span className="text-zinc-500 font-bold">READ TIME</span>
                          <span className="text-zinc-300">4 MINS</span>
                        </div>
                        <div className="flex justify-between text-[7.5px] font-mono">
                          <span className="text-zinc-500 font-bold">KEY TERMS</span>
                          <span className="text-zinc-300">18 FOUND</span>
                        </div>
                        <div className="flex justify-between text-[7.5px] font-mono">
                          <span className="text-zinc-500 font-bold">ACCURACY</span>
                          <span className="text-[#E0D6C6]">HIGH</span>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
 
              </div>
 
            </div>
          </div>
 
        </motion.div>
      </section>
 
      {/* Pricing Section (Night Sky & Aurora State starts here) */}
      <section id="pricing" className="relative py-32 px-6 z-10 bg-transparent">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-6xl mx-auto"
        >
          
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[10px] font-bold text-[#FBF5DD]/85 font-mono tracking-[0.15em] uppercase block mb-4">Reflections Pricing</span>
            <h2 className="font-display text-[clamp(2rem,5vw,3.25rem)] font-semibold text-white tracking-[-0.03em] leading-[1.05]">
              Calm, Transparent Plans
            </h2>
            <p className="text-[15px] text-[#FBF5DD]/80 mt-5 leading-[1.7]">
              Choose the tier matching your workflow requirements. No surprises.
            </p>
 
            {/* Billing Period Toggle */}
            <div className="inline-flex items-center gap-1.5 p-1.5 rounded-full border border-white/10 bg-black/40 mt-8">
              <button 
                onClick={() => setPricingPeriod("monthly")}
                className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-luxury ${pricingPeriod === "monthly" ? "bg-[#FBF5DD] text-[#041E05] shadow-lg" : "text-[#E0D6C6]/70 hover:text-white"}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setPricingPeriod("annually")}
                className={`px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-luxury flex items-center gap-1.5 ${pricingPeriod === "annually" ? "bg-[#FBF5DD] text-[#041E05] shadow-lg" : "text-[#E0D6C6]/70 hover:text-white"}`}
              >
                Annually
                <span className="px-1.5 py-0.5 rounded bg-emerald-800 text-[8px] text-[#FBF5DD] font-bold">-20%</span>
              </button>
            </div>
          </div>
 
          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto items-stretch">
            
            {/* Card 1: Free */}
            <motion.div
              initial={{ opacity: 0, y: 35 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="flex"
            >
              <LiquidGlassCard 
                material="crystal"
                containerClassName="w-full ambient-glow-pricing shadow-luxury-cream"
                className="p-8 flex flex-col justify-between h-full bg-[#FBF5DD]/[0.01]"
              >
                <div>
                  <span className="text-[9px] font-bold font-mono text-[#FBF5DD]/75 uppercase tracking-[0.1em]">Base Mode</span>
                  <h3 className="font-display text-[20px] font-semibold text-white mt-1">Free Tier</h3>
                  <p className="text-[13px] text-[#FBF5DD]/80 mt-3 leading-[1.7]">
                    Start writing and editing with standard AI providers.
                  </p>
                  
                  <div className="my-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white font-mono">$0</span>
                    <span className="text-xs text-zinc-400">/ forever</span>
                  </div>
   
                  <div className="h-[1px] bg-[#F0E8DC]/5 my-6" />
                  <ul className="flex flex-col gap-3.5 text-[13px] text-[#FBF5DD]/90">
                    <li className="flex items-center gap-2.5"><Check className="h-3.5 w-3.5 text-[#E0D6C6] shrink-0" /> Gemini Flash models</li>
                    <li className="flex items-center gap-2.5"><Check className="h-3.5 w-3.5 text-[#E0D6C6] shrink-0" /> 1 Personal workspace</li>
                    <li className="flex items-center gap-2.5"><Check className="h-3.5 w-3.5 text-[#E0D6C6] shrink-0" /> Standard deep web search</li>
                  </ul>
                </div>
   
                <Link 
                  href="/workspace"
                  className="w-full block mt-8 py-2.5 rounded-full focus-ring-premium text-xs font-bold text-center transition-luxury btn-glass-dark"
                >
                  Start Free
                </Link>
              </LiquidGlassCard>
            </motion.div>
 
            {/* Card 2: Pro */}
            <motion.div
              initial={{ opacity: 0, y: 35 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex"
            >
              <LiquidGlassCard 
                material="crystal"
                containerClassName="w-full ambient-glow-pricing border border-[#E0D6C6]/40 shadow-luxury-cream"
                className="p-8 flex flex-col justify-between h-full bg-[#FBF5DD]/[0.05]"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-radial-glow opacity-30 pointer-events-none" />
                <div>
                  <span className="text-[9px] font-bold font-mono text-[#FBF5DD] uppercase tracking-[0.1em]">Pro Workspace</span>
                  <h3 className="font-display text-[20px] font-semibold text-white mt-1">Pro Workspace</h3>
                  <p className="text-[13px] text-[#FBF5DD]/80 mt-3 leading-[1.7]">
                    Unlimited chats and premium AI models.
                  </p>
                  
                  <div className="my-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white font-mono">
                      {pricingPeriod === "monthly" ? "$20" : "$16"}
                    </span>
                    <span className="text-xs text-zinc-400">/ month</span>
                  </div>
   
                  <div className="h-[1px] bg-[#F0E8DC]/5 my-6" />
                  <ul className="flex flex-col gap-3.5 text-[13px] text-[#FBF5DD]/90">
                    <li className="flex items-center gap-2.5"><Check className="h-3.5 w-3.5 text-[#E0D6C6] shrink-0" /> Premium models (Claude Pro)</li>
                    <li className="flex items-center gap-2.5"><Check className="h-3.5 w-3.5 text-[#E0D6C6] shrink-0" /> HTML/Tailwind sandbox preview</li>
                    <li className="flex items-center gap-2.5"><Check className="h-3.5 w-3.5 text-[#E0D6C6] shrink-0" /> Unlimited Team Workspaces</li>
                    <li className="flex items-center gap-2.5"><Check className="h-3.5 w-3.5 text-[#E0D6C6] shrink-0" /> Slides PPTX outline downloader</li>
                  </ul>
                </div>
   
                <Link 
                  href="/workspace"
                  className="w-full block mt-8 py-2.5 rounded-full focus-ring-premium text-xs font-bold text-center transition-luxury btn-shimmer-light shadow-lg hover:scale-105 active:scale-95"
                >
                  Upgrade to Pro
                </Link>
              </LiquidGlassCard>
            </motion.div>
 
            {/* Card 3: Enterprise */}
            <motion.div
              initial={{ opacity: 0, y: 35 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex"
            >
              <LiquidGlassCard 
                material="crystal"
                containerClassName="w-full ambient-glow-pricing shadow-luxury-cream"
                className="p-8 flex flex-col justify-between h-full bg-[#FBF5DD]/[0.01]"
              >
                <div>
                  <span className="text-[9px] font-bold font-mono text-[#FBF5DD]/75 uppercase tracking-[0.1em]">Scale Mode</span>
                  <h3 className="font-display text-[20px] font-semibold text-white mt-1">Enterprise</h3>
                  <p className="text-[13px] text-[#FBF5DD]/80 mt-3 leading-[1.7]">
                    Dedicated model pipelines and workspace locks.
                  </p>
                  
                  <div className="my-6 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white font-mono">Custom</span>
                  </div>
   
                  <div className="h-[1px] bg-[#F0E8DC]/5 my-6" />
                  <ul className="flex flex-col gap-3.5 text-[13px] text-[#FBF5DD]/90">
                    <li className="flex items-center gap-2.5"><Check className="h-3.5 w-3.5 text-[#E0D6C6] shrink-0" /> Single Sign-On (SSO)</li>
                    <li className="flex items-center gap-2.5"><Check className="h-3.5 w-3.5 text-[#E0D6C6] shrink-0" /> Audit logs & user bans controls</li>
                    <li className="flex items-center gap-2.5"><Check className="h-3.5 w-3.5 text-[#E0D6C6] shrink-0" /> Custom LLM key routers</li>
                  </ul>
                </div>
   
                <Link 
                  href="/workspace"
                  className="w-full block mt-8 py-2.5 rounded-full focus-ring-premium text-xs font-bold text-center transition-luxury btn-glass-dark"
                >
                  Contact Sales
                </Link>
              </LiquidGlassCard>
            </motion.div>
 
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 border-t border-[#FBF5DD]/10 bg-[#041E05] relative z-10 text-[#E0D6C6]/55">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-gradient-to-tr from-[#0D530E] to-[#FBF5DD] flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-[#041E05]" />
            </div>
            <span className="text-[14px] font-semibold tracking-[-0.01em] text-white font-display">
              NeuroFlow AI
            </span>
          </div>
 
          <p className="text-xs text-center font-mono">
            &copy; {new Date().getFullYear()} NeuroFlow AI. Designed for Organic Intelligence.
          </p>
 
          <div className="flex items-center gap-6 text-xs font-mono uppercase">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Security</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
