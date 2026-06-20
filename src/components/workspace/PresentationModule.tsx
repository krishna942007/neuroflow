"use client";

import React, { useState } from "react";
import { 
  Presentation, 
  Sparkles, 
  Check, 
  ChevronRight, 
  Download, 
  Plus, 
  Layers, 
  RotateCcw,
  LayoutTemplate,
  AlertCircle,
  FileDown,
  Printer,
  Code,
  Eye,
  Copy
} from "lucide-react";
import { useWorkspaceStore, WorkspaceFile } from "@/lib/store/workspaceStore";
import { useAuthStore } from "@/lib/store/authStore";
import { useUIStore } from "@/lib/store/uiStore";
import { requestAIStream, AIGenerationError } from "@/lib/ai/client";
import { motion, AnimatePresence } from "framer-motion";

// Markdown to Slides parser
function parseMarkdownToSlides(markdown: string): Slide[] {
  const slides: Slide[] = [];
  
  let cleanedMarkdown = markdown.trim();
  if (cleanedMarkdown.startsWith("## ")) {
    cleanedMarkdown = cleanedMarkdown.substring(3);
  } else {
    const firstHeader = cleanedMarkdown.indexOf("## ");
    if (firstHeader !== -1) {
      cleanedMarkdown = cleanedMarkdown.substring(firstHeader + 3);
    }
  }
  
  const blocks = cleanedMarkdown.split(/\r?\n\r?\n##\s+/);
  
  blocks.forEach((block, idx) => {
    if (!block.trim()) return;
    
    const lines = block.split("\n");
    const headerLine = lines[0] || "";
    
    const layoutMatch = headerLine.match(/^\[([^\]]+)\]\s*(.*)$/);
    let layout: Slide["layout"] = "bullets";
    let title = headerLine.trim();
    
    if (layoutMatch) {
      layout = layoutMatch[1] as Slide["layout"];
      title = layoutMatch[2].trim();
    }
    
    const slide: Slide = {
      id: `slide-${idx + 1}`,
      title,
      layout,
      bullets: [],
      stats: [],
      features: []
    };
    
    let isInsideSplit = false;
    let splitSide: "left" | "right" = "left";
    let splitLeftLines: string[] = [];
    let splitRightLines: string[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      if (line.startsWith("*Subtitle:") && line.endsWith("*")) {
        slide.subtitle = line.substring(10, line.length - 1).trim();
      } else if (line.startsWith("*ImageKeyword:") && line.endsWith("*")) {
        slide.imageKeyword = line.substring(14, line.length - 1).trim();
      } else if (line.startsWith("*ImageUrl:") && line.endsWith("*")) {
        slide.imageUrl = line.substring(10, line.length - 1).trim();
      } else if (line.startsWith("> --")) {
        slide.author = line.substring(4).trim();
      } else if (line.startsWith(">")) {
        slide.quote = (slide.quote ? slide.quote + "\n" : "") + line.substring(1).trim();
      } else if (line.startsWith("<<< Left Col")) {
        isInsideSplit = true;
        splitSide = "left";
      } else if (line.startsWith("===") && isInsideSplit) {
        splitSide = "right";
      } else if (line.startsWith(">>>") && isInsideSplit) {
        isInsideSplit = false;
      } else if (isInsideSplit) {
        if (splitSide === "left") {
          splitLeftLines.push(line);
        } else {
          splitRightLines.push(line);
        }
      } else if (line.startsWith("- **") && layout === "stats") {
        const statMatch = line.match(/^- \*\*([^*]+)\*\*:\s*(.*)$/);
        if (statMatch) {
          slide.stats?.push({ value: statMatch[1].trim(), label: statMatch[2].trim() });
        }
      } else if (line.startsWith("- **") && layout === "features") {
        const featMatch = line.match(/^- \*\*([^*]+)\*\*:\s*(.*)$/);
        if (featMatch) {
          slide.features?.push({ title: featMatch[1].trim(), desc: featMatch[2].trim() });
        }
      } else if (line.startsWith("* ") || line.startsWith("- ")) {
        slide.bullets.push(line.substring(2).trim());
      }
    }
    
    if (splitLeftLines.length) slide.splitLeft = splitLeftLines.join("\n");
    if (splitRightLines.length) slide.splitRight = splitRightLines.join("\n");
    
    slides.push(slide);
  });
  
  return slides;
}

function serializeSlidesToMarkdown(slides: Slide[]): string {
  return slides.map(s => {
    let slideText = `## [${s.layout || 'bullets'}] ${s.title}\n`;
    if (s.subtitle) slideText += `*Subtitle: ${s.subtitle}*\n`;
    if (s.imageKeyword) slideText += `*ImageKeyword: ${s.imageKeyword}*\n`;
    if (s.imageUrl) slideText += `*ImageUrl: ${s.imageUrl}*\n`;
    if (s.quote) slideText += `> ${s.quote}\n`;
    if (s.author) slideText += `> -- ${s.author}\n`;
    if (s.stats && s.stats.length) {
      slideText += s.stats.map(st => `- **${st.value}**: ${st.label}`).join('\n') + '\n';
    }
    if (s.features && s.features.length) {
      slideText += s.features.map(f => `- **${f.title}**: ${f.desc}`).join('\n') + '\n';
    }
    if (s.splitLeft || s.splitRight) {
      slideText += `<<< Left Col\n${s.splitLeft || ''}\n===\nRight Col\n${s.splitRight || ''}\n>>>\n`;
    }
    if (s.bullets && s.bullets.length) {
      slideText += s.bullets.map(b => `* ${b}`).join('\n') + '\n';
    }
    return slideText.trim() + '\n';
  }).join('\n');
}

interface Slide {
  id: string;
  title: string;
  layout?: "hero" | "split" | "features" | "stats" | "quote" | "bullets";
  bullets: string[];
  subtitle?: string;
  imageKeyword?: string;
  imageUrl?: string;
  splitLeft?: string;
  splitRight?: string;
  features?: { title: string; desc: string; icon?: string }[];
  stats?: { value: string; label: string }[];
  quote?: string;
  author?: string;
}

export default function PresentationModule() {
  const { addFileToWorkspace, files: workspaceFiles } = useWorkspaceStore();
  const { addActivityLog, checkAndIncrementUsage, user } = useAuthStore();
  const setLimitWarning = useUIStore((s) => s.setLimitWarning);

  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState(4);
  const [selectedTheme, setSelectedTheme] = useState("obsidian-dark");
  const [isGenerating, setIsGenerating] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [selectedFont, setSelectedFont] = useState("modern-sans");
  const [transitionAnimation, setTransitionAnimation] = useState("slide-blur");
  const [isSaved, setIsSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const transitionVariants = {
    "slide-blur": {
      initial: { opacity: 0, x: 60, filter: "blur(8px)" },
      animate: { opacity: 1, x: 0, filter: "blur(0px)" },
      exit: { opacity: 0, x: -60, filter: "blur(8px)" },
      transition: { duration: 0.4, ease: "easeOut" }
    },
    "flip-3d": {
      initial: { opacity: 0, rotateY: 90, transformPerspective: 1000 },
      animate: { opacity: 1, rotateY: 0, transformPerspective: 1000 },
      exit: { opacity: 0, rotateY: -90, transformPerspective: 1000 },
      transition: { duration: 0.5, ease: "easeInOut" }
    },
    "zoom-fade": {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 1.05 },
      transition: { duration: 0.35, ease: "easeOut" }
    },
    "slide-up": {
      initial: { opacity: 0, y: 50 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -50 },
      transition: { duration: 0.4, ease: [0.25, 1, 0.5, 1] }
    },
    "spring-bounce": {
      initial: { opacity: 0, scale: 0.8 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.8 },
      transition: { type: "spring" as const, stiffness: 100, damping: 15 }
    }
  } as const;

  const [previewMode, setPreviewMode] = useState<"preview" | "code">("preview");
  const [prismReady, setPrismReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codeContent, setCodeContent] = useState("");

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const preRef = React.useRef<HTMLPreElement>(null);
  const lineNumbersRef = React.useRef<HTMLDivElement>(null);

  // User defined custom theme states
  const [customThemeBg, setCustomThemeBg] = useState("#F5EFE4");
  const [customThemeBg2, setCustomThemeBg2] = useState("#E5DDD0");
  const [customThemeBgType, setCustomThemeBgType] = useState<"solid" | "gradient">("solid");
  const [customThemeText, setCustomThemeText] = useState("#2A3226");
  const [customThemeAccent, setCustomThemeAccent] = useState("#3D4833");
  const [customThemeCard, setCustomThemeCard] = useState("rgba(229, 221, 208, 0.35)");

  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = target.scrollTop;
      preRef.current.scrollLeft = target.scrollLeft;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = target.scrollTop;
    }
  };

  // Load Prism.js for markdown syntax highlighting
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      if ((window as any).Prism) {
        setPrismReady(true);
        return;
      }
      // Load Prism CSS theme
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css";
      document.head.appendChild(link);
      // Load Prism JS
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js";
      script.async = true;
      script.onload = () => {
        const mdScript = document.createElement("script");
        mdScript.src = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markdown.min.js";
        mdScript.async = true;
        mdScript.onload = () => setPrismReady(true);
        document.head.appendChild(mdScript);
      };
      document.head.appendChild(script);
    }
  }, []);

  // Load Google Fonts dynamically
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Outfit:wght@100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Lora:ital,wght@0,400..700;1,400..700&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&family=Syne:wght@400..800&family=Hanken+Grotesk:ital,wght@0,100..900;1,100..900&family=Space+Grotesk:wght@300..700&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Inter:wght@100..900&display=swap";
      document.head.appendChild(link);
      return () => {
        document.head.removeChild(link);
      };
    }
  }, []);

  // Bi-directional sync: slides update codeContent in preview mode
  React.useEffect(() => {
    if (previewMode === "preview" && slides.length > 0) {
      const md = serializeSlidesToMarkdown(slides);
      setCodeContent(md);
    }
  }, [slides, previewMode]);

  const handleCodeChange = (newCode: string) => {
    setCodeContent(newCode);
    try {
      const parsed = parseMarkdownToSlides(newCode);
      if (parsed.length > 0) {
        setSlides(parsed);
        if (activeSlideIdx >= parsed.length) {
          setActiveSlideIdx(0);
        }
      }
    } catch (e) {
      // Catch syntax errors silently while typing
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!codeContent) return;
    const blob = new Blob([codeContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic.substring(0, 20).replace(/\s+/g, '_')}_presentation.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addActivityLog("Downloaded presentation code", `${slides.length} slides exported as MD`);
  };

  const presentationDecks = workspaceFiles.filter(f => f.type === "presentation");

  const loadPresentation = (file: WorkspaceFile) => {
    if (!file.content) return;
    try {
      const parsedSlides = parseMarkdownToSlides(file.content);
      if (parsedSlides.length > 0) {
        setSlides(parsedSlides);
        setActiveSlideIdx(0);
        const topicName = file.name.replace(/_Presentation\.pptx$/, "").replace(/_/g, " ");
        setTopic(topicName);
      }
    } catch (err) {
      console.error("Failed to parse presentation file:", err);
      alert("Failed to load presentation file.");
    }
  };

  const themes = [
    {
      id: "obsidian-dark",
      name: "Obsidian Dark",
      class: "bg-zinc-950 border-zinc-800 text-white",
      titleClass: "text-white bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent",
      subtitleClass: "text-zinc-400",
      cardClass: "bg-zinc-900/60 border-zinc-800/80 backdrop-blur-md",
      accentLine: "bg-zinc-600",
      bulletDot: "bg-zinc-400",
      badgeClass: "border-zinc-800 bg-zinc-900/50 text-zinc-400",
      textMuted: "text-zinc-400",
      textNormal: "text-zinc-300",
      statsValueClass: "bg-gradient-to-r from-zinc-200 via-zinc-300 to-zinc-500 bg-clip-text text-transparent",
      blobs: [] as Array<{ className: string }>
    },
    {
      id: "glass-violet",
      name: "Glass Violet (Watermorphism)",
      class: "bg-[#0b071a] border-purple-500/20 text-white relative",
      titleClass: "text-white bg-gradient-to-r from-purple-200 via-fuchsia-100 to-pink-200 bg-clip-text text-transparent",
      subtitleClass: "text-purple-300/80",
      cardClass: "bg-purple-950/25 border-purple-500/20 backdrop-blur-xl shadow-lg shadow-purple-950/40",
      accentLine: "bg-gradient-to-r from-purple-500 to-pink-500",
      bulletDot: "bg-purple-400",
      badgeClass: "border-purple-500/25 bg-purple-500/10 text-purple-300",
      textMuted: "text-purple-300/70",
      textNormal: "text-purple-200",
      statsValueClass: "bg-gradient-to-r from-purple-400 via-fuchsia-300 to-pink-400 bg-clip-text text-transparent",
      blobs: [
        { className: "bg-purple-600/15 w-48 h-48 -top-12 -left-12 blur-[60px] animate-liquid-slow absolute pointer-events-none rounded-full" },
        { className: "bg-pink-600/10 w-60 h-60 -bottom-16 -right-16 blur-[70px] animate-liquid-medium absolute pointer-events-none rounded-full" }
      ]
    },
    {
      id: "mint-fresh",
      name: "Mint Fresh (Glass)",
      class: "bg-[#061212] border-cyan-500/20 text-white relative",
      titleClass: "text-white bg-gradient-to-r from-cyan-200 via-teal-100 to-emerald-200 bg-clip-text text-transparent",
      subtitleClass: "text-cyan-300/80",
      cardClass: "bg-cyan-950/25 border-cyan-500/20 backdrop-blur-xl shadow-lg shadow-cyan-950/40",
      accentLine: "bg-gradient-to-r from-cyan-500 to-emerald-500",
      bulletDot: "bg-cyan-400",
      badgeClass: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
      textMuted: "text-cyan-300/70",
      textNormal: "text-cyan-200",
      statsValueClass: "bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent",
      blobs: [
        { className: "bg-cyan-600/15 w-48 h-48 -top-12 -right-12 blur-[60px] animate-liquid-slow absolute pointer-events-none rounded-full" },
        { className: "bg-emerald-600/10 w-60 h-60 -bottom-16 -left-16 blur-[70px] animate-liquid-medium absolute pointer-events-none rounded-full" }
      ]
    },
    {
      id: "emerald-aurora",
      name: "Emerald Aurora",
      class: "bg-gradient-to-br from-[#010a03] via-[#04150a] to-[#010301] border-emerald-500/25 text-emerald-50 relative",
      titleClass: "text-emerald-100 bg-gradient-to-r from-emerald-100 via-teal-200 to-emerald-300 bg-clip-text text-transparent",
      subtitleClass: "text-emerald-400/80",
      cardClass: "bg-emerald-950/30 border-emerald-500/20 backdrop-blur-lg",
      accentLine: "bg-emerald-500",
      bulletDot: "bg-emerald-400",
      badgeClass: "border-emerald-500/20 bg-emerald-950/40 text-emerald-400",
      textMuted: "text-emerald-400/70",
      textNormal: "text-emerald-200",
      statsValueClass: "bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent",
      blobs: [
        { className: "bg-emerald-500/10 w-52 h-52 top-10 left-10 blur-[80px] animate-liquid-slow absolute pointer-events-none rounded-full" }
      ]
    },
    {
      id: "sunset-gold",
      name: "Sunset Gold",
      class: "bg-gradient-to-br from-zinc-950 via-[#140e02] to-[#0b0501] border-amber-500/25 text-amber-50 relative",
      titleClass: "text-amber-100 bg-gradient-to-r from-amber-100 via-orange-200 to-amber-300 bg-clip-text text-transparent",
      subtitleClass: "text-amber-400/80",
      cardClass: "bg-amber-950/20 border-amber-500/15 backdrop-blur-lg",
      accentLine: "bg-amber-500",
      bulletDot: "bg-amber-400",
      badgeClass: "border-amber-500/20 bg-amber-950/40 text-amber-400",
      textMuted: "text-amber-400/70",
      textNormal: "text-amber-200",
      statsValueClass: "bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent",
      blobs: [
        { className: "bg-amber-500/8 w-56 h-56 top-4 left-1/3 blur-[75px] animate-liquid-slow absolute pointer-events-none rounded-full" }
      ]
    },
    {
      id: "coral-blaze",
      name: "Coral Blaze",
      class: "bg-gradient-to-br from-[#05010b] via-[#160604] to-[#200a08] border-orange-500/25 text-orange-50 relative",
      titleClass: "text-orange-100 bg-gradient-to-r from-orange-100 via-red-200 to-orange-300 bg-clip-text text-transparent",
      subtitleClass: "text-orange-400/80",
      cardClass: "bg-orange-950/20 border-orange-500/15 backdrop-blur-lg",
      accentLine: "bg-orange-500",
      bulletDot: "bg-orange-400",
      badgeClass: "border-orange-500/20 bg-orange-950/40 text-orange-400",
      textMuted: "text-orange-400/70",
      textNormal: "text-orange-200",
      statsValueClass: "bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent",
      blobs: [
        { className: "bg-red-500/8 w-48 h-48 bottom-4 right-1/4 blur-[70px] animate-liquid-slow absolute pointer-events-none rounded-full" }
      ]
    },
    {
      id: "cream-quartz",
      name: "Cream Quartz (Quiet Luxury Light)",
      class: "bg-[#F5EFE4] border-[#3D4833]/15 text-[#2A3226] relative",
      titleClass: "text-[#2A3226] bg-gradient-to-r from-[#2A3226] to-[#6B7365] bg-clip-text text-transparent font-extrabold",
      subtitleClass: "text-[#6B7365]",
      cardClass: "bg-[#E5DDD0]/50 border-[#3D4833]/12 backdrop-blur-md shadow-sm",
      accentLine: "bg-[#3D4833]",
      bulletDot: "bg-[#3D4833]",
      badgeClass: "border-[#3D4833]/20 bg-[#3D4833]/5 text-[#3D4833]",
      textMuted: "text-[#6B7365]",
      textNormal: "text-[#2A3226]",
      statsValueClass: "bg-gradient-to-r from-[#2A3226] to-[#3D4833] bg-clip-text text-transparent font-black",
      blobs: [
        { className: "bg-[#3D4833]/5 w-48 h-48 -top-12 -left-12 blur-[50px] animate-liquid-slow absolute pointer-events-none rounded-full" }
      ]
    },
    {
      id: "mint-glass-light",
      name: "Mint Glass (Light)",
      class: "bg-[#EBF5F3] border-[#115E59]/15 text-[#115E59] relative",
      titleClass: "text-[#115E59] bg-gradient-to-r from-[#115E59] to-[#0D9488] bg-clip-text text-transparent font-extrabold",
      subtitleClass: "text-[#0F766E]",
      cardClass: "bg-[#D1FAE5]/40 border-[#10B981]/15 backdrop-blur-md shadow-sm",
      accentLine: "bg-[#10B981]",
      bulletDot: "bg-[#0D9488]",
      badgeClass: "border-[#10B981]/25 bg-[#10B981]/10 text-[#0F766E]",
      textMuted: "text-[#0F766E]/80",
      textNormal: "text-[#115E59]",
      statsValueClass: "bg-gradient-to-r from-[#115E59] to-[#0D9488] bg-clip-text text-transparent font-black",
      blobs: [
        { className: "bg-[#10B981]/8 w-48 h-48 -top-10 -right-10 blur-[60px] animate-liquid-slow absolute pointer-events-none rounded-full" }
      ]
    },
    {
      id: "soft-lavender-light",
      name: "Soft Lavender (Light)",
      class: "bg-[#F3E8FF] border-purple-500/15 text-purple-950 relative",
      titleClass: "text-purple-900 bg-gradient-to-r from-purple-900 to-indigo-900 bg-clip-text text-transparent font-extrabold",
      subtitleClass: "text-purple-700",
      cardClass: "bg-white/40 border-purple-300/30 backdrop-blur-md shadow-sm",
      accentLine: "bg-purple-500",
      bulletDot: "bg-purple-600",
      badgeClass: "border-purple-300/30 bg-purple-100 text-purple-700",
      textMuted: "text-purple-700/80",
      textNormal: "text-purple-900",
      statsValueClass: "bg-gradient-to-r from-purple-800 to-indigo-800 bg-clip-text text-transparent font-black",
      blobs: [
        { className: "bg-purple-300/20 w-48 h-48 -top-12 -left-12 blur-[50px] animate-liquid-slow absolute pointer-events-none rounded-full" }
      ]
    },
    {
      id: "rose-quartz-light",
      name: "Rose Quartz (Light)",
      class: "bg-[#FFF1F2] border-rose-500/15 text-rose-950 relative",
      titleClass: "text-rose-900 bg-gradient-to-r from-rose-900 to-pink-800 bg-clip-text text-transparent font-extrabold",
      subtitleClass: "text-rose-700",
      cardClass: "bg-white/40 border-rose-300/30 backdrop-blur-md shadow-sm",
      accentLine: "bg-rose-400",
      bulletDot: "bg-rose-500",
      badgeClass: "border-rose-300/30 bg-rose-100 text-rose-700",
      textMuted: "text-rose-700/80",
      textNormal: "text-rose-900",
      statsValueClass: "bg-gradient-to-r from-rose-800 to-pink-800 bg-clip-text text-transparent font-black",
      blobs: [
        { className: "bg-rose-300/20 w-48 h-48 -bottom-16 -right-16 blur-[60px] animate-liquid-slow absolute pointer-events-none rounded-full" }
      ]
    },
    {
      id: "custom",
      name: "Custom Theme (User Defined)",
      class: "border-[var(--custom-border)] relative",
      titleClass: "text-[var(--custom-text)] font-extrabold",
      subtitleClass: "text-[var(--custom-text)]/80",
      cardClass: "bg-[var(--custom-card)] border-[var(--custom-border)] backdrop-blur-md shadow-sm",
      accentLine: "bg-[var(--custom-accent)]",
      bulletDot: "bg-[var(--custom-bullet)]",
      badgeClass: "border-[var(--custom-border)] bg-[var(--custom-badge)] text-[var(--custom-text)]",
      textMuted: "text-[var(--custom-text)]/60",
      textNormal: "text-[var(--custom-text)]",
      statsValueClass: "text-[var(--custom-accent)] font-black",
      blobs: [] as Array<{ className: string }>
    }
  ];

  const themeObj = themes.find(t => t.id === selectedTheme) || themes[0];

  const customThemeStyles = selectedTheme === "custom" ? {
    "--custom-bg": customThemeBg,
    "--custom-bg-2": customThemeBg2,
    "--custom-text": customThemeText,
    "--custom-accent": customThemeAccent,
    "--custom-card": customThemeCard,
    "--custom-border": `${customThemeAccent}25`, // Hex with 15% opacity
    "--custom-bullet": customThemeAccent,
    "--custom-badge": `${customThemeAccent}15`, // Hex with 8% opacity
  } as React.CSSProperties : {};

  const containerStyle: React.CSSProperties = {
    ...customThemeStyles,
    ...(selectedTheme === "custom" ? {
      backgroundColor: customThemeBgType === "solid" ? customThemeBg : undefined,
      backgroundImage: customThemeBgType === "gradient" ? `linear-gradient(135deg, ${customThemeBg} 0%, ${customThemeBg2} 100%)` : undefined,
      color: customThemeText,
      borderColor: `${customThemeAccent}20`,
    } : {})
  };

  const handleGenerateDecks = async (overrideTopic?: string) => {
    const activeTopic = overrideTopic !== undefined ? overrideTopic : topic;
    if (!activeTopic.trim() || isGenerating) return;

    const limitCheck = checkAndIncrementUsage("ppt");
    if (!limitCheck.allowed) {
      setLimitWarning({
        type: "ppt",
        limit: limitCheck.limit,
        plan: user?.plan || "free"
      });
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    addActivityLog("Generated AI Slides Presentation", `Topic: "${activeTopic.substring(0, 30)}...", Theme: ${selectedTheme}`);

    try {
      const result = await requestAIStream<{ slides: Array<Omit<Slide, "id">> }>("presentation", {
        topic: activeTopic,
        slideCount,
        theme: selectedTheme,
      }, (step) => {
        // Progress is shown via the spinner text — we could wire this in if desired
      });
      if (result.slides?.length) {
        setSlides(result.slides.slice(0, slideCount).map((slide, index) => ({
          id: `slide-${index + 1}`,
          title: slide.title,
          layout: slide.layout || "bullets",
          bullets: slide.bullets || [],
          subtitle: slide.subtitle || "",
          splitLeft: slide.splitLeft || "",
          splitRight: slide.splitRight || "",
          features: slide.features || [],
          stats: slide.stats || [],
          quote: slide.quote || "",
          author: slide.author || "",
        })));
        setActiveSlideIdx(0);
        setIsGenerating(false);
        return;
      }
      throw new AIGenerationError("AI returned empty presentation content. Try a more specific topic.", "EMPTY_RESPONSE", true);
    } catch (error) {
      console.error("Presentation API failed:", error);
      let userMsg: string;
      if (error instanceof AIGenerationError) {
        userMsg = error.message;
        if (error.code === "TIMEOUT") {
          userMsg = "Slide generation timed out. Try fewer slides or a simpler topic.";
        } else if (error.code === "AUTH_FAILED") {
          userMsg = "API key is invalid or expired. Update your provider keys in Settings.";
        } else if (error.code === "RATE_LIMIT") {
          userMsg = "Rate limit hit. Wait 30 seconds and try again.";
        }
      } else {
        userMsg = error instanceof Error ? error.message : "Presentation generation failed. Please verify your environment keys.";
      }
      setErrorMsg(userMsg);
      setIsGenerating(false);
      return;
    }
  };

  React.useEffect(() => {
    const handleSherlockAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: string; target: string; value: string }>;
      if (customEvent.detail.target === "presentation_prompt") {
        setTopic(customEvent.detail.value);
        if (customEvent.detail.type === "generate") {
          handleGenerateDecks(customEvent.detail.value);
        }
      }
    };
    window.addEventListener("newton-action", handleSherlockAction);
    window.addEventListener("sherlock-action", handleSherlockAction);
    return () => {
      window.removeEventListener("newton-action", handleSherlockAction);
      window.removeEventListener("sherlock-action", handleSherlockAction);
    };
  }, []);

  const handleSaveToWorkspace = () => {
    if (slides.length === 0) return;
    
    const name = window.prompt("Enter presentation name:", topic.substring(0, 20).replace(/\s+/g, '_') + "_Presentation.pptx");
    if (!name || !name.trim()) return;
    const cleanName = name.trim().endsWith(".pptx") ? name.trim() : `${name.trim()}.pptx`;
    
    const contentText = slides.map(s => {
      let slideText = `## [${s.layout || 'bullets'}] ${s.title}\n`;
      if (s.subtitle) slideText += `*Subtitle: ${s.subtitle}*\n`;
      if (s.quote) slideText += `> ${s.quote}\n> -- ${s.author || 'Anonymous'}\n`;
      if (s.stats && s.stats.length) slideText += s.stats.map(st => `- **${st.value}**: ${st.label}`).join('\n') + '\n';
      if (s.features && s.features.length) slideText += s.features.map(f => `- **${f.title}**: ${f.desc}`).join('\n') + '\n';
      if (s.splitLeft || s.splitRight) slideText += `<<< Left Col\n${s.splitLeft}\n===\nRight Col\n${s.splitRight}\n>>>\n`;
      if (s.bullets && s.bullets.length) slideText += s.bullets.map(b => `* ${b}`).join('\n') + '\n';
      return slideText;
    }).join('\n\n');

    addFileToWorkspace({
      name: cleanName,
      type: "presentation",
      size: "244 KB",
      content: contentText
    });
    setIsSaved(true);
    addActivityLog("Saved generated presentation deck", `File: ${cleanName}`);
    setTimeout(() => setIsSaved(false), 2500);
  };

  // Download slides data as JSON file
  const handleDownloadJson = () => {
    if (slides.length === 0) return;
    const jsonData = JSON.stringify({ slides, topic, theme: selectedTheme }, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic.substring(0, 20).replace(/\s+/g, '_')}_slides.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addActivityLog("Downloaded slides as JSON", `${slides.length} slides exported`);
  };

  // Print slides as PDF (uses browser print dialog)
  const handlePrintPdf = () => {
    if (slides.length === 0) return;
    
    // Resolve font styling for printing
    const headingFont = getHeadingStyle().fontFamily || "'Outfit', sans-serif";
    const bodyFont = getBodyStyle().fontFamily || "'Plus Jakarta Sans', sans-serif";
    
    const themeColors = {
      "obsidian-dark": { bg: "#09090b", text: "#f4f4f5", textMuted: "#a1a1aa", card: "#18181b", accent: "#52525b", bullet: "#a1a1aa" },
      "glass-violet": { bg: "#0b071a", text: "#f3e8ff", textMuted: "#d8b4fe", card: "rgba(88, 28, 135, 0.25)", accent: "#a855f7", bullet: "#c084fc" },
      "mint-fresh": { bg: "#061212", text: "#ecfeff", textMuted: "#67e8f9", card: "rgba(8, 51, 68, 0.25)", accent: "#14b8a6", bullet: "#2dd4bf" },
      "emerald-aurora": { bg: "#04150a", text: "#f0fdf4", textMuted: "#34d399", card: "rgba(6, 78, 36, 0.3)", accent: "#10b981", bullet: "#34d399" },
      "sunset-gold": { bg: "#140e02", text: "#fffbeb", textMuted: "#fbbf24", card: "rgba(120, 53, 4, 0.2)", accent: "#f59e0b", bullet: "#fbbf24" },
      "coral-blaze": { bg: "#160604", text: "#fff5f5", textMuted: "#fb923c", card: "rgba(154, 52, 18, 0.2)", accent: "#f97316", bullet: "#fb923c" },
      "cream-quartz": { bg: "#F5EFE4", text: "#2A3226", textMuted: "#6B7365", card: "rgba(229, 221, 208, 0.5)", accent: "#3D4833", bullet: "#3D4833" },
      "mint-glass-light": { bg: "#EBF5F3", text: "#115E59", textMuted: "#0F766E", card: "rgba(209, 250, 229, 0.4)", accent: "#10B981", bullet: "#0D9488" },
      "soft-lavender-light": { bg: "#F3E8FF", text: "#4c1d95", textMuted: "#7c3aed", card: "rgba(255, 255, 255, 0.4)", accent: "#8b5cf6", bullet: "#7c3aed" },
      "rose-quartz-light": { bg: "#FFF1F2", text: "#881337", textMuted: "#db2777", card: "rgba(255, 255, 255, 0.4)", accent: "#f43f5e", bullet: "#ec4899" },
      "custom": { bg: customThemeBgType === "solid" ? customThemeBg : `linear-gradient(135deg, ${customThemeBg} 0%, ${customThemeBg2} 100%)`, text: customThemeText, textMuted: `${customThemeText}aa`, card: customThemeCard, accent: customThemeAccent, bullet: customThemeAccent }
    };

    const theme = themeColors[selectedTheme as keyof typeof themeColors] || themeColors["obsidian-dark"];
    
    // Style block for fonts and custom theme background override
    const styleHeader = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Outfit:wght@100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Lora:ital,wght@0,400..700;1,400..700&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&family=Syne:wght@400..800&family=Hanken+Grotesk:ital,wght@0,100..900;1,100..900&family=Space+Grotesk:wght@300..700&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Inter:wght@100..900&display=swap');
        
        @page {
          size: landscape;
          margin: 0;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          background: #000;
          font-family: ${bodyFont};
        }
        .slide-print-card {
          page-break-after: always;
          width: 100%;
          aspect-ratio: 16/9;
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-sizing: border-box;
          position: relative;
          background: ${selectedTheme === "custom" && customThemeBgType === "gradient" ? theme.bg : theme.bg};
          color: ${theme.text};
          overflow: hidden;
        }
        .slide-print-card h1, .slide-print-card h2, .slide-print-card h3, .slide-print-card h4 {
          font-family: ${headingFont};
          color: ${theme.text};
        }
        .slide-print-card p, .slide-print-card li, .slide-print-card blockquote {
          font-family: ${bodyFont};
          color: ${theme.text};
        }
        .accent-line {
          background-color: ${theme.accent} !important;
        }
        .bullet-dot {
          background-color: ${theme.bullet} !important;
        }
        .card-elem {
          background-color: ${theme.card} !important;
          border: 1px solid ${theme.text}15 !important;
          color: ${theme.text} !important;
          border-radius: 12px;
          padding: 16px;
        }
      </style>
    `;

    const slidesHtml = slides.map((slide, idx) => {
      const layout = slide.layout || "bullets";
      const hasImage = !!(slide.imageKeyword || slide.imageUrl);
      const imageUrl = slide.imageUrl || (slide.imageKeyword ? `https://images.unsplash.com/featured/800x450/?${encodeURIComponent(slide.imageKeyword)}` : "");
      
      let innerHtml = '';
      if (layout === 'hero') {
        innerHtml = `
          <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;height:100%;">
            <div style="border:1px solid ${theme.accent}40;background:${theme.accent}15;color:${theme.accent};font-size:10px;font-weight:bold;text-transform:uppercase;padding:4px 12px;border-radius:99px;margin-bottom:16px;letter-spacing:1px;">Keynote Presentation</div>
            <h1 style="font-size:36px;margin-bottom:16px;line-height:1.2;font-weight:800;">${slide.title}</h1>
            ${slide.subtitle ? `<p style="font-size:16px;opacity:0.8;max-width:500px;margin:0 auto;line-height:1.5;">${slide.subtitle}</p>` : ''}
            <div class="accent-line" style="width:64px;height:4px;border-radius:99px;margin-top:24px;"></div>
          </div>
        `;
      } else if (layout === 'stats' && slide.stats?.length) {
        innerHtml = `
          <div style="display:flex;flex-direction:column;justify-content:space-between;height:100%;">
            <h3 style="font-size:24px;border-bottom:1px solid ${theme.text}15;padding-bottom:8px;margin-bottom:16px;text-transform:uppercase;letter-spacing:1px;">${slide.title}</h3>
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;margin:auto 0;">
              ${slide.stats.slice(0, 3).map(s => `
                <div class="card-elem" style="text-align:center;">
                  <div style="font-size:32px;font-weight:800;color:${theme.accent};">${s.value}</div>
                  <div style="font-size:11px;opacity:0.7;text-transform:uppercase;margin-top:8px;">${s.label}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else if (layout === 'features' && slide.features?.length) {
        innerHtml = `
          <div style="display:flex;flex-direction:column;justify-content:space-between;height:100%;">
            <h3 style="font-size:24px;border-bottom:1px solid ${theme.text}15;padding-bottom:8px;margin-bottom:16px;text-transform:uppercase;letter-spacing:1px;">${slide.title}</h3>
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;margin:auto 0;">
              ${slide.features.slice(0, 3).map((f, fidx) => `
                <div class="card-elem" style="display:flex;flex-direction:column;justify-content:space-between;height:100%;">
                  <div style="width:24px;height:24px;border-radius:50%;border:1px solid ${theme.accent}40;background:${theme.accent}15;color:${theme.accent};font-family:monospace;font-weight:bold;display:flex;align-items:center;justify-content:center;font-size:10px;margin-bottom:12px;">0${fidx + 1}</div>
                  <div>
                    <h4 style="font-size:14px;margin-bottom:6px;font-weight:700;">${f.title}</h4>
                    <p style="font-size:11px;opacity:0.7;line-height:1.4;">${f.desc}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else if (layout === 'quote') {
        innerHtml = `
          <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;padding:0 32px;position:relative;">
            <span style="position:absolute;top:-10px;left:16px;font-size:72px;font-family:serif;opacity:0.1;line-height:1;">&ldquo;</span>
            <blockquote style="font-size:20px;font-style:italic;text-align:center;line-height:1.5;margin-bottom:20px;font-family:serif;">&ldquo;${slide.quote || ''}&rdquo;</blockquote>
            ${slide.author ? `<cite style="font-style:normal;font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:0.7;border-top:1px solid ${theme.text}10;padding-top:8px;">&mdash; ${slide.author}</cite>` : ''}
          </div>
        `;
      } else if (layout === 'split') {
        innerHtml = `
          <div style="display:flex;flex-direction:column;justify-content:space-between;height:100%;">
            <h3 style="font-size:24px;border-bottom:1px solid ${theme.text}15;padding-bottom:8px;margin-bottom:16px;text-transform:uppercase;letter-spacing:1px;">${slide.title}</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;flex-grow:1;margin-top:12px;">
              <div class="card-elem" style="display:flex;flex-direction:column;justify-content:center;">
                <span style="font-size:10px;font-weight:bold;opacity:0.6;text-transform:uppercase;margin-bottom:8px;letter-spacing:0.5px;">Context & Details</span>
                <div style="font-size:12px;line-height:1.5;white-space:pre-wrap;">${slide.splitLeft || ''}</div>
              </div>
              <div class="card-elem" style="display:flex;flex-direction:column;justify-content:center;">
                <span style="font-size:10px;font-weight:bold;opacity:0.6;text-transform:uppercase;margin-bottom:8px;letter-spacing:0.5px;">Key Takeaways</span>
                <div style="font-size:12px;line-height:1.5;white-space:pre-wrap;">${slide.splitRight || ''}</div>
              </div>
            </div>
          </div>
        `;
      } else {
        innerHtml = `
          <div style="display:flex;flex-direction:column;justify-content:space-between;height:100%;">
            <h3 style="font-size:24px;border-bottom:1px solid ${theme.text}15;padding-bottom:8px;margin-bottom:16px;text-transform:uppercase;letter-spacing:1px;">${slide.title}</h3>
            <ul style="list-style:none;padding:0;display:flex;flex-direction:column;justify-content:center;gap:12px;flex-grow:1;">
              ${(slide.bullets || []).map(b => `
                <li style="display:flex;align-items:flex-start;gap:10px;font-size:13px;line-height:1.5;">
                  <span class="bullet-dot" style="margin-top:5px;flex-shrink:0;width:8px;height:8px;border-radius:50%;display:inline-block;"></span>
                  <span>${b}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        `;
      }

      if (hasImage) {
        return `
          <div class="slide-print-card">
            <div style="position:absolute;top:12px;right:16px;font-size:9px;opacity:0.4;font-family:monospace;">${idx + 1}/${slides.length}</div>
            <div style="display:flex;gap:32px;align-items:stretch;height:100%;width:100%;">
              <div style="width:60%;display:flex;flex-direction:column;justify-content:space-between;height:100%;">
                ${innerHtml}
              </div>
              <div style="width:40%;height:100%;display:flex;align-items:center;justify-content:center;">
                <div style="position:relative;width:100%;height:100%;border-radius:16px;overflow:hidden;border:1px solid ${theme.text}15;box-shadow:0 10px 15px -3px rgba(0,0,0,0.3);">
                  <img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" />
                  <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,0.4), transparent);"></div>
                  ${slide.imageKeyword ? `<span style="position:absolute;bottom:10px;right:12px;font-size:8px;font-family:monospace;background:rgba(0,0,0,0.5);color:white;padding:2px 6px;border-radius:4px;text-transform:capitalize;">${slide.imageKeyword}</span>` : ''}
                </div>
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div class="slide-print-card">
          <div style="position:absolute;top:12px;right:16px;font-size:9px;opacity:0.4;font-family:monospace;">${idx + 1}/${slides.length}</div>
          <div style="height:100%;display:flex;flex-direction:column;justify-content:space-between;">
            ${innerHtml}
          </div>
        </div>
      `;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`<!DOCTYPE html><html><head><title>${topic} - Slides</title>${styleHeader}</head><body>${slidesHtml}</body></html>`);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const handleBulletChange = (bulletIdx: number, val: string) => {
    setSlides(prev => prev.map((slide, sIdx) => {
      if (sIdx === activeSlideIdx) {
        const updatedBullets = [...slide.bullets];
        updatedBullets[bulletIdx] = val;
        return { ...slide, bullets: updatedBullets };
      }
      return slide;
    }));
  };

  const handleSlideFieldChange = (field: keyof Slide, val: any) => {
    setSlides(prev => prev.map((slide, sIdx) => {
      if (sIdx === activeSlideIdx) {
        return { ...slide, [field]: val };
      }
      return slide;
    }));
  };

  const handleStatChange = (statIdx: number, key: "value" | "label", val: string) => {
    setSlides(prev => prev.map((slide, sIdx) => {
      if (sIdx === activeSlideIdx && slide.stats) {
        const updatedStats = [...slide.stats];
        updatedStats[statIdx] = { ...updatedStats[statIdx], [key]: val };
        return { ...slide, stats: updatedStats };
      }
      return slide;
    }));
  };

  const handleFeatureChange = (featureIdx: number, key: "title" | "desc", val: string) => {
    setSlides(prev => prev.map((slide, sIdx) => {
      if (sIdx === activeSlideIdx && slide.features) {
        const updatedFeatures = [...slide.features];
        updatedFeatures[featureIdx] = { ...updatedFeatures[featureIdx], [key]: val };
        return { ...slide, features: updatedFeatures };
      }
      return slide;
    }));
  };

  const getHeadingStyle = () => {
    switch (selectedFont) {
      case "modern-serif": return { fontFamily: "'Playfair Display', serif" };
      case "tech-minimal": return { fontFamily: "'Space Grotesk', sans-serif" };
      case "editorial-serif": return { fontFamily: "'Lora', serif" };
      case "bold-brutalism": return { fontFamily: "'Syne', sans-serif", fontWeight: 800 };
      case "modern-sans":
      default: return { fontFamily: "'Outfit', sans-serif" };
    }
  };

  const getBodyStyle = () => {
    switch (selectedFont) {
      case "modern-serif": return { fontFamily: "'Inter', sans-serif" };
      case "tech-minimal": return { fontFamily: "'JetBrains Mono', monospace" };
      case "editorial-serif": return { fontFamily: "'Merriweather', serif" };
      case "bold-brutalism": return { fontFamily: "'Hanken Grotesk', sans-serif" };
      case "modern-sans":
      default: return { fontFamily: "'Plus Jakarta Sans', sans-serif" };
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.15
      }
    }
  };

  const staggerItem = {
    hidden: { opacity: 0, y: 15 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring" as const, stiffness: 100, damping: 15 }
    }
  } as const;

  const renderSlideContent = (slide: Slide) => {
    const layout = slide.layout || "bullets";
    const themeObj = themes.find(t => t.id === selectedTheme) || themes[0];
    const hasImage = !!(slide.imageKeyword || slide.imageUrl);
    const imageUrl = slide.imageUrl || (slide.imageKeyword ? `https://images.unsplash.com/featured/800x450/?${encodeURIComponent(slide.imageKeyword)}` : "");
    
    const renderInnerContent = () => {
      switch (layout) {
        case "hero":
          return (
            <div className="flex-grow flex flex-col justify-center items-center text-center px-6 py-4 relative z-10 h-full">
              <motion.div 
                variants={staggerItem}
                className={`px-3 py-1 rounded-full border text-[9px] font-bold tracking-widest uppercase select-none mb-4 ${themeObj.badgeClass}`}
              >
                Keynote Presentation
              </motion.div>
              <motion.h1 
                variants={staggerItem}
                className={`text-3xl lg:text-4xl font-extrabold tracking-tight leading-normal drop-shadow-sm ${themeObj.titleClass}`}
                style={getHeadingStyle()}
              >
                {slide.title}
              </motion.h1>
              {slide.subtitle && (
                <motion.p 
                  variants={staggerItem}
                  className={`mt-4 text-sm max-w-lg leading-relaxed font-sans font-medium ${themeObj.subtitleClass}`}
                  style={getBodyStyle()}
                >
                  {slide.subtitle}
                </motion.p>
              )}
              <motion.div variants={staggerItem} className={`w-16 h-1 rounded-full mt-6 opacity-80 ${themeObj.accentLine}`} />
            </div>
          );
          
        case "split":
          return (
            <div className="flex-grow flex flex-col justify-between my-4 min-h-0 overflow-hidden relative z-10 h-full">
              <h3 className={`text-lg font-bold border-b border-white/10 pb-2 uppercase tracking-wider ${themeObj.titleClass}`} style={getHeadingStyle()}>
                {slide.title}
              </h3>
              <motion.div 
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 gap-6 flex-grow items-stretch mt-4"
              >
                <motion.div variants={staggerItem} className={`p-4 rounded-xl border ${themeObj.cardClass} flex flex-col justify-center`}>
                  <span className={`text-[9px] font-bold font-mono uppercase tracking-wider mb-2 block ${themeObj.textMuted}`}>Context & Details</span>
                  <div className={`text-[11px] leading-relaxed font-sans font-medium whitespace-pre-wrap ${themeObj.textNormal}`} style={getBodyStyle()}>
                    {slide.splitLeft || "Left side content placeholder."}
                  </div>
                </motion.div>
                <motion.div variants={staggerItem} className={`p-4 rounded-xl border ${themeObj.cardClass} flex flex-col justify-center`}>
                  <span className={`text-[9px] font-bold font-mono uppercase tracking-wider mb-2 block ${themeObj.textMuted}`}>Key Takeaways</span>
                  <div className={`text-[11px] leading-relaxed font-sans font-medium whitespace-pre-wrap ${themeObj.textNormal}`} style={getBodyStyle()}>
                    {slide.splitRight || "Right side content placeholder."}
                  </div>
                </motion.div>
              </motion.div>
            </div>
          );
          
        case "features":
          return (
            <div className="flex-grow flex flex-col justify-between my-4 min-h-0 overflow-hidden relative z-10 h-full">
              <h3 className={`text-lg font-bold border-b border-white/10 pb-2 uppercase tracking-wider ${themeObj.titleClass}`} style={getHeadingStyle()}>
                {slide.title}
              </h3>
              <motion.div 
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="grid grid-cols-3 gap-4 flex-grow items-stretch mt-6"
              >
                {(slide.features && slide.features.length ? slide.features : [
                  { title: "Feature One", desc: "Description placeholder" },
                  { title: "Feature Two", desc: "Description placeholder" },
                  { title: "Feature Three", desc: "Description placeholder" }
                ]).slice(0, 3).map((feat, idx) => (
                  <motion.div 
                    key={idx} 
                    variants={staggerItem}
                    className={`p-4 rounded-xl border ${themeObj.cardClass} transition-all duration-300 flex flex-col justify-between`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border font-mono mb-3 shadow-inner ${themeObj.badgeClass}`}>
                      0{idx + 1}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold mb-1 tracking-wide text-white" style={getHeadingStyle()}>{feat.title}</h4>
                      <p className={`text-[10px] leading-relaxed font-sans font-medium ${themeObj.textNormal}`} style={getBodyStyle()}>{feat.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          );
          
        case "stats":
          return (
            <div className="flex-grow flex flex-col justify-between my-4 min-h-0 overflow-hidden relative z-10 h-full">
              <h3 className={`text-lg font-bold border-b border-white/10 pb-2 uppercase tracking-wider ${themeObj.titleClass}`} style={getHeadingStyle()}>
                {slide.title}
              </h3>
              <motion.div 
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="grid grid-cols-3 gap-6 flex-grow items-stretch mt-6"
              >
                {(slide.stats && slide.stats.length ? slide.stats : [
                  { value: "99.9%", label: "Uptime SLA" },
                  { value: "24/7", label: "Global Ops" },
                  { value: "$10M+", label: "Saved Yearly" }
                ]).slice(0, 3).map((st, idx) => (
                  <motion.div 
                    key={idx} 
                    variants={staggerItem}
                    className={`p-4 rounded-2xl border backdrop-blur-sm shadow-lg ${themeObj.cardClass} flex flex-col justify-center items-center`}
                  >
                    <span className={`text-2xl lg:text-3xl font-black tracking-tight font-sans ${themeObj.statsValueClass}`} style={getHeadingStyle()}>
                      {st.value}
                    </span>
                    <p className={`text-[9px] font-mono font-bold tracking-widest uppercase mt-2 ${themeObj.textMuted}`} style={getBodyStyle()}>{st.label}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          );
          
        case "quote":
          return (
            <div className="flex-grow flex flex-col justify-center items-center px-8 py-6 relative z-10 h-full">
              <span className="absolute -top-3 left-4 text-7xl font-serif text-white/5 select-none font-black">&ldquo;</span>
              <blockquote className={`text-base lg:text-lg italic text-center font-serif leading-relaxed max-w-2xl ${themeObj.textNormal}`} style={getHeadingStyle()}>
                {slide.quote || "Slide quote content is loading..."}
              </blockquote>
              {slide.author && (
                <cite className={`not-italic text-[10px] font-mono tracking-widest uppercase mt-5 border-t border-white/5 pt-2 flex items-center gap-1.5 font-bold ${themeObj.textMuted}`} style={getBodyStyle()}>
                  <span className="w-3 h-[1px] bg-white/10 block" /> {slide.author}
                </cite>
              )}
            </div>
          );
          
        case "bullets":
        default:
          return (
            <div className="flex-grow flex flex-col justify-between my-4 min-h-0 overflow-hidden relative z-10 h-full">
              <h3 className={`text-lg font-bold border-b border-white/10 pb-2 uppercase tracking-wider ${themeObj.titleClass}`} style={getHeadingStyle()}>
                {slide.title}
              </h3>
              <motion.ul 
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="flex-1 flex flex-col justify-center gap-3.5 my-4 pl-1"
              >
                {(slide.bullets && slide.bullets.length ? slide.bullets : ["Bullet point number one."]).map((bullet, idx) => (
                  <motion.li 
                    key={idx} 
                    variants={staggerItem}
                    className={`flex items-start gap-3 text-xs font-sans font-medium leading-relaxed ${themeObj.textNormal}`}
                    style={getBodyStyle()}
                  >
                    <span className="mt-1 flex-shrink-0 w-3 h-3 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
                      <span className={`w-1 h-1 rounded-full ${themeObj.bulletDot}`} />
                    </span>
                    <span>{bullet}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>
          );
      }
    };

    const inner = renderInnerContent();
    if (hasImage) {
      return (
        <div className="flex-1 flex gap-8 items-stretch h-full min-h-0">
          <div className="w-[60%] flex flex-col justify-between min-h-0 h-full">
            {inner}
          </div>
          <div className="w-[40%] flex items-center justify-center py-2 h-full min-h-0 shrink-0">
            <div className="relative h-full w-full rounded-2xl overflow-hidden border border-white/10 shadow-xl group">
              <img 
                src={imageUrl} 
                alt={slide.imageKeyword || "Slide image"} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
              {slide.imageKeyword && (
                <span className="absolute bottom-2.5 right-3 text-[8px] font-mono text-white/80 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded capitalize">
                  {slide.imageKeyword}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }
    return inner;
  };

  const activeThemeClass = themes.find(t => t.id === selectedTheme)?.class || "bg-zinc-950";

  return (
    <div className="flex-1 flex flex-col h-full rounded-2xl glass-panel relative overflow-hidden font-sans">
      
      {/* Header bar */}
      <div className="h-14 border-b border-[#3D4833]/20 px-6 flex items-center justify-between bg-[#F0E8DC]/40 shrink-0">
        <div className="flex items-center gap-2">
          <Presentation className="h-4.5 w-4.5 text-rose-400" />
          <span className="text-xs font-bold text-[#2A3226] tracking-wider uppercase">AI Presentation Generator</span>
        </div>

        {slides.length > 0 && (
          <div className="flex items-center gap-4">
            {/* Header Theme selector dropdown */}
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase">Theme:</span>
              <select 
                value={selectedTheme}
                onChange={(e) => setSelectedTheme(e.target.value)}
                className="text-[10px] px-2 py-1 !bg-[#F0E8DC] border border-[#3D4833]/25 rounded-md outline-none !text-[#2A3226] font-semibold focus:border-[#3D4833]/60 cursor-pointer shadow-sm"
              >
                {themes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Header Font Pairing selector */}
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase">Font:</span>
              <select 
                value={selectedFont}
                onChange={(e) => setSelectedFont(e.target.value)}
                className="text-[10px] px-2 py-1 !bg-[#F0E8DC] border border-[#3D4833]/25 rounded-md outline-none !text-[#2A3226] font-semibold focus:border-[#3D4833]/60 cursor-pointer shadow-sm"
              >
                <option value="modern-sans">Modern Sans</option>
                <option value="modern-serif">Modern Serif</option>
                <option value="tech-minimal">Tech Minimal</option>
                <option value="editorial-serif">Editorial Serif</option>
                <option value="bold-brutalism">Bold Brutalism</option>
              </select>
            </div>

            {/* Header Transition selector */}
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase">Transition:</span>
              <select 
                value={transitionAnimation}
                onChange={(e) => setTransitionAnimation(e.target.value)}
                className="text-[10px] px-2 py-1 !bg-[#F0E8DC] border border-[#3D4833]/25 rounded-md outline-none !text-[#2A3226] font-semibold focus:border-[#3D4833]/60 cursor-pointer shadow-sm"
              >
                <option value="slide-blur">Slide & Blur</option>
                <option value="flip-3d">3D Flip</option>
                <option value="zoom-fade">Zoom Fade</option>
                <option value="slide-up">Slide Up</option>
                <option value="spring-bounce">Spring Bounce</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-[#F0E8DC] border border-[#3D4833]/20">
              <button
                onClick={() => setPreviewMode("preview")}
                className={`px-3 py-1 rounded text-[10px] font-semibold flex items-center gap-1.5 transition-all ${previewMode === "preview" ? 'workspace-tab-active' : 'text-[#2A3226]/60 hover:text-[#2A3226]'}`}
              >
                <Eye className="h-3 w-3" />
                <span>Live Preview</span>
              </button>
              <button
                onClick={() => setPreviewMode("code")}
                className={`px-3 py-1 rounded text-[10px] font-semibold flex items-center gap-1.5 transition-all ${previewMode === "code" ? 'workspace-tab-active' : 'text-[#2A3226]/60 hover:text-[#2A3226]'}`}
              >
                <Code className="h-3 w-3" />
                <span>Code Editor</span>
              </button>
            </div>
          </div>
        )}
      </div>
 
      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-y-auto p-6">
        
        {slides.length === 0 && !isGenerating && !errorMsg ? (
          /* Parameter form settings screen */
          <div className="max-w-md mx-auto w-full my-auto flex flex-col gap-6">
            <div className="text-center flex flex-col gap-2">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
                <LayoutTemplate className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-[#2A3226] mt-3">Generate Presentations</h2>
              <p className="text-xs text-[#6B7365] max-w-sm mx-auto leading-relaxed">
                Configure topic targets, presentation slides length, and visual color styles. The generator compiles visual slide layouts.
              </p>
            </div>
 
            <div className="rounded-2xl border border-[#3D4833]/30 !bg-[#F0E8DC] p-5 flex flex-col gap-4 shadow-sm">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase">Presentation Topic</span>
                <input 
                  type="text" 
                  placeholder="e.g. Q3 Startup Pitch Deck & Marketing Actionables"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="text-xs p-3 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] !placeholder-[#6B7365]/60 focus:border-[#3D4833]/60 shadow-inner"
                />
              </div>
 
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase">Slide Count</span>
                  <select 
                    value={slideCount}
                    onChange={(e) => setSlideCount(parseInt(e.target.value))}
                    className="text-xs p-2.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] focus:border-[#3D4833]/60 shadow-inner"
                  >
                    <option value={4}>4 Slides (Proposal)</option>
                    <option value={6}>6 Slides (Pitch Deck)</option>
                    <option value={8}>8 Slides (Detailed Review)</option>
                  </select>
                </div>
 
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase">Theme Style</span>
                  <select 
                    value={selectedTheme}
                    onChange={(e) => setSelectedTheme(e.target.value)}
                    className="text-xs p-2.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] focus:border-[#3D4833]/60 shadow-inner"
                  >
                    {themes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase">Font Pairing</span>
                  <select 
                    value={selectedFont}
                    onChange={(e) => setSelectedFont(e.target.value)}
                    className="text-xs p-2.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] focus:border-[#3D4833]/60 shadow-inner"
                  >
                    <option value="modern-sans">Modern Sans</option>
                    <option value="modern-serif">Modern Serif</option>
                    <option value="tech-minimal">Tech Minimal</option>
                    <option value="editorial-serif">Editorial Serif</option>
                    <option value="bold-brutalism">Bold Brutalism</option>
                  </select>
                </div>
 
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase">Transition Style</span>
                  <select 
                    value={transitionAnimation}
                    onChange={(e) => setTransitionAnimation(e.target.value)}
                    className="text-xs p-2.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] focus:border-[#3D4833]/60 shadow-inner"
                  >
                    <option value="slide-blur">Slide & Blur</option>
                    <option value="flip-3d">3D Flip</option>
                    <option value="zoom-fade">Zoom Fade</option>
                    <option value="slide-up">Slide Up</option>
                    <option value="spring-bounce">Spring Bounce</option>
                  </select>
                </div>
              </div>

              {/* Initial Custom Theme Creator Panel */}
              {selectedTheme === "custom" && (
                <div className="mt-1 p-3.5 rounded-xl border border-[#3D4833]/20 bg-[#E5DDD0]/50 flex flex-col gap-3">
                  <span className="text-[9px] font-bold text-[#6B7365] font-mono uppercase">Custom Theme Settings</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-bold text-[#6B7365] uppercase">Background Type</span>
                      <select 
                        value={customThemeBgType}
                        onChange={(e) => setCustomThemeBgType(e.target.value as any)}
                        className="text-[10px] p-1.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded outline-none !text-[#2A3226]"
                      >
                        <option value="solid">Solid Color</option>
                        <option value="gradient">Gradient</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-bold text-[#6B7365] uppercase">Text Color</span>
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="color" 
                          value={customThemeText}
                          onChange={(e) => setCustomThemeText(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer border border-[#3D4833]/25 p-0 bg-transparent"
                        />
                        <span className="text-[9px] font-mono">{customThemeText}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-bold text-[#6B7365] uppercase">Bg Color 1</span>
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="color" 
                          value={customThemeBg}
                          onChange={(e) => setCustomThemeBg(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer border border-[#3D4833]/25 p-0 bg-transparent"
                        />
                        <span className="text-[9px] font-mono">{customThemeBg}</span>
                      </div>
                    </div>
                    {customThemeBgType === "gradient" && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-bold text-[#6B7365] uppercase">Bg Color 2</span>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="color" 
                            value={customThemeBg2}
                            onChange={(e) => setCustomThemeBg2(e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer border border-[#3D4833]/25 p-0 bg-transparent"
                          />
                          <span className="text-[9px] font-mono">{customThemeBg2}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-bold text-[#6B7365] uppercase">Accent Color</span>
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="color" 
                          value={customThemeAccent}
                          onChange={(e) => setCustomThemeAccent(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer border border-[#3D4833]/25 p-0 bg-transparent"
                        />
                        <span className="text-[9px] font-mono">{customThemeAccent}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] font-bold text-[#6B7365] uppercase">Card Glass Color</span>
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="color" 
                          value={customThemeCard.startsWith("rgba") ? "#ffffff" : customThemeCard}
                          onChange={(e) => {
                            const hex = e.target.value;
                            const r = parseInt(hex.slice(1, 3), 16);
                            const g = parseInt(hex.slice(3, 5), 16);
                            const b = parseInt(hex.slice(5, 7), 16);
                            setCustomThemeCard(`rgba(${r}, ${g}, ${b}, 0.35)`);
                          }}
                          className="w-6 h-6 rounded cursor-pointer border border-[#3D4833]/25 p-0 bg-transparent"
                        />
                        <span className="text-[9px] font-mono truncate">{customThemeCard}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
 
              <button 
                onClick={() => handleGenerateDecks()}
                disabled={!topic.trim()}
                className={`w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${topic.trim() ? '!bg-[#3D4833] hover:!bg-[#2A3226] !text-[#F5EFE4] active:scale-95 shadow-sm' : '!bg-[#F0E8DC] !text-[#2A3226]/30 border border-[#3D4833]/15 cursor-not-allowed'}`}
              >
                Generate Slide Deck
                <Sparkles className="h-3.5 w-3.5" />
              </button>
            </div>

            {presentationDecks.length > 0 && (
              <div className="flex flex-col gap-2 mt-4 text-left max-w-sm mx-auto w-full">
                <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase tracking-wider px-1">Recent Presentations</span>
                <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto pr-1">
                  {presentationDecks.map((deck) => (
                    <button
                      key={deck.id}
                      onClick={() => loadPresentation(deck)}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs bg-[#F0E8DC] border border-[#3D4833]/20 hover:border-[#3D4833] hover:bg-[#F0E8DC] text-[#2A3226] flex items-center justify-between transition-all shadow-sm"
                    >
                      <span className="font-semibold truncate">{deck.name}</span>
                      <span className="text-[9px] text-[#6B7365]/60 font-mono">{deck.size || "Unknown"}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : errorMsg && !isGenerating ? (
          /* Error State display */
          <div className="max-w-md mx-auto w-full my-auto flex flex-col gap-5 text-center animate-fade-in font-sans">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-500">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold !text-[#2A3226] mb-1.5">Presentation Generation Failed</h3>
              <p className="text-xs !text-[#6B7365] leading-relaxed px-4">
                {errorMsg}
              </p>
            </div>
            <button 
              onClick={() => {
                setErrorMsg(null);
                setSlides([]);
              }}
              className="px-6 py-2 rounded-full !bg-[#3D4833] hover:!bg-[#2A3226] !text-[#F5EFE4] text-xs font-semibold self-center transition-all shadow-md active:scale-95"
            >
              Try Again
            </button>
          </div>
        ) : isGenerating ? (
          /* Generator Loader */
          <div className="my-auto text-center flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[#3D4833] border-t-transparent animate-spin" />
            <span className="text-xs !text-[#6B7365] font-sans font-medium tracking-wider">Compiling PPTX slides XML nodes...</span>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
            
            {/* Left Slides catalog column (1/4 space) */}
            <div className="lg:col-span-1 rounded-xl border border-[#3D4833]/20 bg-[#F0E8DC]/80 p-4 flex flex-col gap-3">
              <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase px-1 mb-1">Slide List</span>
              <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-[220px]">
                {slides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    onClick={() => setActiveSlideIdx(idx)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${activeSlideIdx === idx ? 'bg-[#3D4833]/10 text-[#2A3226] border border-[#3D4833]/20 shadow-sm font-semibold' : 'text-[#6B7365] hover:text-[#2A3226] border border-transparent'}`}
                  >
                    <span className="font-semibold">{idx + 1}. {slide.title}</span>
                  </button>
                ))}
              </div>

              <div className="h-[1px] bg-[#3D4833]/15 my-1" />

              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase tracking-wider">Recent Decks</span>
              </div>
              <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto pr-1">
                {presentationDecks.map((deck) => (
                  <button
                    key={deck.id}
                    onClick={() => loadPresentation(deck)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#3D4833]/10 text-[#6B7365] hover:text-[#2A3226] truncate transition-all"
                    title={deck.name}
                  >
                    {deck.name}
                  </button>
                ))}
              </div>

              {/* Sidebar Custom Theme Creator Panel */}
              {selectedTheme === "custom" && (
                <div className="flex flex-col gap-2 p-3 rounded-xl border border-[#3D4833]/20 bg-[#F0E8DC]/95 text-[10px] text-[#2A3226] shadow-inner shrink-0">
                  <span className="font-bold text-[#6B7365] font-mono uppercase tracking-wider block">Custom Theme Creator</span>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#6B7365]">Bg Type:</span>
                      <select 
                        value={customThemeBgType}
                        onChange={(e) => setCustomThemeBgType(e.target.value as any)}
                        className="p-1 text-[9px] !bg-[#E5DDD0] border border-[#3D4833]/25 rounded outline-none"
                      >
                        <option value="solid">Solid</option>
                        <option value="gradient">Gradient</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#6B7365]">Bg Color 1:</span>
                      <input 
                        type="color" 
                        value={customThemeBg}
                        onChange={(e) => setCustomThemeBg(e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border border-[#3D4833]/20 p-0 bg-transparent"
                      />
                    </div>

                    {customThemeBgType === "gradient" && (
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[#6B7365]">Bg Color 2:</span>
                        <input 
                          type="color" 
                          value={customThemeBg2}
                          onChange={(e) => setCustomThemeBg2(e.target.value)}
                          className="w-5 h-5 rounded cursor-pointer border border-[#3D4833]/20 p-0 bg-transparent"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#6B7365]">Text Color:</span>
                      <input 
                        type="color" 
                        value={customThemeText}
                        onChange={(e) => setCustomThemeText(e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border border-[#3D4833]/20 p-0 bg-transparent"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#6B7365]">Accent Color:</span>
                      <input 
                        type="color" 
                        value={customThemeAccent}
                        onChange={(e) => setCustomThemeAccent(e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border border-[#3D4833]/20 p-0 bg-transparent"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#6B7365]">Card Glass:</span>
                      <input 
                        type="color" 
                        value={customThemeCard.startsWith("rgba") ? "#ffffff" : customThemeCard}
                        onChange={(e) => {
                          const hex = e.target.value;
                          const r = parseInt(hex.slice(1, 3), 16);
                          const g = parseInt(hex.slice(3, 5), 16);
                          const b = parseInt(hex.slice(5, 7), 16);
                          setCustomThemeCard(`rgba(${r}, ${g}, ${b}, 0.35)`);
                        }}
                        className="w-5 h-5 rounded cursor-pointer border border-[#3D4833]/20 p-0 bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="h-[1px] bg-[#3D4833]/15 my-1" />

              <button 
                onClick={handleSaveToWorkspace}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${isSaved ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 font-semibold' : 'workspace-primary-button'}`}
              >
                {isSaved ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                <span>{isSaved ? "Saved Deck File" : "Save to Workspace"}</span>
              </button>

              <button 
                onClick={() => setSlides([])}
                className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border border-[#3D4833]/20 bg-[#F0E8DC]/80 hover:bg-[#F0E8DC] text-[#2A3226] transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Create New Deck</span>
              </button>

              <div className="h-[1px] bg-[#3D4833]/15 my-1" />

              <button 
                onClick={handleDownloadJson}
                className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border border-[#3D4833]/20 bg-[#F0E8DC]/80 hover:bg-[#F0E8DC] text-[#2A3226] transition-all"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>Download JSON</span>
              </button>

              <button 
                onClick={handlePrintPdf}
                className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border border-[#3D4833]/20 bg-[#F0E8DC]/80 hover:bg-[#F0E8DC] text-[#2A3226] transition-all"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print / Save PDF</span>
              </button>
            </div>            {/* Right Slide Canvas Preview & Bullet points editor (3/4 space) */}
            {previewMode === "code" ? (
              <div className="lg:col-span-3 flex flex-col overflow-hidden bg-zinc-950 rounded-xl border border-zinc-800">
                <div className="h-9 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-400">presentation.md</span>
                    <span className="text-[9px] font-mono text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                      {codeContent.split('\n').length} lines
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadMarkdown}
                      className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-all cursor-pointer"
                      title="Download Markdown Code"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download MD</span>
                    </button>
                    <button 
                      onClick={handleCopyCode}
                      className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-all cursor-pointer"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      <span>{copied ? "Copied!" : "Copy"}</span>
                    </button>
                  </div>
                </div>
                <div className="flex-1 flex overflow-hidden relative min-h-[400px]">
                  {/* Line numbers */}
                  <div 
                    ref={lineNumbersRef}
                    className="w-10 bg-zinc-900/80 border-r border-zinc-800/50 text-right select-none shrink-0 overflow-hidden py-5 px-1"
                  >
                    {codeContent.split('\n').map((_, i) => (
                      <div 
                        key={i} 
                        className="text-[10px] font-mono text-zinc-600 pr-1"
                        style={{ height: '20px', lineHeight: '20px' }}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  {/* Code textarea with highlights */}
                  <div className="flex-1 relative overflow-hidden bg-zinc-950">
                    {prismReady && (window as any).Prism && (
                      <pre
                        ref={preRef}
                        className="absolute inset-0 p-5 font-mono text-xs leading-relaxed pointer-events-none select-none overflow-hidden"
                        aria-hidden="true"
                        style={{
                          background: 'transparent',
                          margin: 0,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          lineHeight: '20px',
                          whiteSpace: 'pre',
                        }}
                      >
                        <code
                          dangerouslySetInnerHTML={{
                            __html: (window as any).Prism.highlight(
                              codeContent,
                              (window as any).Prism.languages.markdown || (window as any).Prism.languages.javascript,
                              "markdown"
                            )
                          }}
                          className="language-markdown"
                          style={{
                            background: 'transparent',
                            lineHeight: '20px',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          }}
                        />
                      </pre>
                    )}
                    <textarea
                      ref={textareaRef}
                      value={codeContent}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      onScroll={handleEditorScroll}
                      className="w-full h-full p-5 bg-transparent font-mono text-xs outline-none border-none resize-none overflow-y-auto scrollbar-thin select-text relative z-10"
                      spellCheck="false"
                      wrap="off"
                      style={{
                        color: 'transparent',
                        WebkitTextFillColor: 'transparent',
                        caretColor: '#d4d4d8',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        lineHeight: '20px',
                        whiteSpace: 'pre',
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-3 flex flex-col gap-6">
                
                {slides[activeSlideIdx] && (() => {
                  const themeObj = themes.find(t => t.id === selectedTheme) || themes[0];
                  return (
                    <div 
                      className={`aspect-[16/9] w-full rounded-xl border p-8 flex flex-col justify-between shadow-2xl relative select-none overflow-hidden ${themeObj.class}`}
                      style={containerStyle}
                    >
                      
                      {/* Animated dynamic blobs from theme */}
                      {themeObj.blobs && themeObj.blobs.map((blob, bIdx) => (
                        <div key={bIdx} className={blob.className} />
                      ))}
                      
                      {/* Subtle paper-like physical noise pattern overlay */}
                      <div className="absolute inset-0 pointer-events-none opacity-[0.035] mix-blend-overlay bg-repeat z-0" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                      }} />
                      
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeSlideIdx}
                          variants={transitionVariants[transitionAnimation as keyof typeof transitionVariants] || transitionVariants["slide-blur"]}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          className="flex-grow flex flex-col justify-between relative z-10"
                        >
                          {renderSlideContent(slides[activeSlideIdx])}
                        </motion.div>
                      </AnimatePresence>
                      
                      <div className={`flex justify-between text-[8px] font-mono border-t pt-2 z-10 relative ${themeObj.badgeClass.split(" ")[0]}`}>
                        <span className={themeObj.textMuted}>Neuroflow Presentations v1.0</span>
                        <span className={themeObj.textMuted}>Slide {activeSlideIdx + 1} of {slides.length}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Slide Editor controls based on active slide layout */}
                {slides[activeSlideIdx] && (
                  <div className="rounded-xl border border-[#3D4833]/30 !bg-[#F0E8DC] p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-[#3D4833]/15 pb-2 mb-1">
                      <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase">Edit Slide Content</span>
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded !bg-[#E5DDD0] border border-[#3D4833]/25 text-[#6B7365] capitalize">Layout: {slides[activeSlideIdx].layout || "bullets"}</span>
                    </div>
                    
                    {/* Render editor fields dynamically */}
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-[#6B7365] font-mono uppercase">Slide Title</span>
                        <input 
                          type="text" 
                          value={slides[activeSlideIdx].title}
                          onChange={(e) => handleSlideFieldChange("title", e.target.value)}
                          className="text-xs p-2.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] focus:border-[#3D4833]/60 font-sans shadow-inner"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-bold text-[#6B7365] font-mono uppercase">Image Keyword (Unsplash Search)</span>
                          <input 
                            type="text" 
                            placeholder="e.g. business analytics graph"
                            value={slides[activeSlideIdx].imageKeyword || ""}
                            onChange={(e) => handleSlideFieldChange("imageKeyword", e.target.value)}
                            className="text-xs p-2.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] focus:border-[#3D4833]/60 font-sans shadow-inner"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-bold text-[#6B7365] font-mono uppercase">Direct Image URL (Overrides Keyword)</span>
                          <input 
                            type="text" 
                            placeholder="e.g. https://images.unsplash.com/photo-..."
                            value={slides[activeSlideIdx].imageUrl || ""}
                            onChange={(e) => handleSlideFieldChange("imageUrl", e.target.value)}
                            className="text-xs p-2.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] focus:border-[#3D4833]/60 font-sans shadow-inner"
                          />
                        </div>
                      </div>
                      
                      {slides[activeSlideIdx].layout === "hero" && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-bold text-[#6B7365] font-mono uppercase">Subtitle</span>
                          <input 
                            type="text" 
                            value={slides[activeSlideIdx].subtitle || ""}
                            onChange={(e) => handleSlideFieldChange("subtitle", e.target.value)}
                            className="text-xs p-2.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] focus:border-[#3D4833]/60 font-sans shadow-inner"
                          />
                        </div>
                      )}
   
                      {slides[activeSlideIdx].layout === "split" && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-[#6B7365] font-mono uppercase">Left Column (Markdown)</span>
                            <textarea 
                              value={slides[activeSlideIdx].splitLeft || ""}
                              onChange={(e) => handleSlideFieldChange("splitLeft", e.target.value)}
                              rows={3}
                              className="text-xs p-2.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] focus:border-[#3D4833]/60 font-sans resize-none scrollbar-thin shadow-inner"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-[#6B7365] font-mono uppercase">Right Column (Markdown)</span>
                            <textarea 
                              value={slides[activeSlideIdx].splitRight || ""}
                              onChange={(e) => handleSlideFieldChange("splitRight", e.target.value)}
                              rows={3}
                              className="text-xs p-2.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] focus:border-[#3D4833]/60 font-sans resize-none scrollbar-thin shadow-inner"
                            />
                          </div>
                        </div>
                      )}
   
                      {slides[activeSlideIdx].layout === "features" && (
                        <div className="grid grid-cols-3 gap-3">
                          {(slides[activeSlideIdx].features || []).map((feat, idx) => (
                            <div key={idx} className="flex flex-col gap-1.5 p-2 rounded-lg border border-[#3D4833]/20 !bg-[#F0E8DC]/50">
                              <span className="text-[8px] font-mono text-[#6B7365] uppercase">Feature 0{idx + 1}</span>
                              <input 
                                type="text" 
                                placeholder="Title"
                                value={feat.title || ""}
                                onChange={(e) => handleFeatureChange(idx, "title", e.target.value)}
                                className="text-[10px] p-2 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded outline-none !text-[#2A3226] focus:border-[#3D4833]/60 font-sans shadow-inner"
                              />
                              <textarea 
                                placeholder="Description"
                                value={feat.desc || ""}
                                onChange={(e) => handleFeatureChange(idx, "desc", e.target.value)}
                                rows={2}
                                className="text-[9px] p-2 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded outline-none !text-[#2A3226] focus:border-[#3D4833]/60 resize-none font-sans shadow-inner"
                              />
                            </div>
                          ))}
                        </div>
                      )}
   
                      {slides[activeSlideIdx].layout === "stats" && (
                        <div className="grid grid-cols-3 gap-3">
                          {(slides[activeSlideIdx].stats || []).map((st, idx) => (
                            <div key={idx} className="flex flex-col gap-1.5 p-2 rounded-lg border border-[#3D4833]/20 !bg-[#F0E8DC]/50">
                              <span className="text-[8px] font-mono text-[#6B7365] uppercase">Stat 0{idx + 1}</span>
                              <input 
                                type="text" 
                                placeholder="Value (e.g. 99%)"
                                value={st.value || ""}
                                onChange={(e) => handleStatChange(idx, "value", e.target.value)}
                                className="text-[10px] p-2 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded outline-none !text-[#2A3226] focus:border-[#3D4833]/60 font-sans font-bold shadow-inner"
                              />
                              <input 
                                type="text" 
                                placeholder="Label"
                                value={st.label || ""}
                                onChange={(e) => handleStatChange(idx, "label", e.target.value)}
                                className="text-[9px] p-2 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded outline-none !text-[#2A3226] focus:border-[#3D4833]/60 font-sans shadow-inner"
                              />
                            </div>
                          ))}
                        </div>
                      )}
   
                      {slides[activeSlideIdx].layout === "quote" && (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="col-span-2 flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-[#6B7365] font-mono uppercase">Quote Text</span>
                            <input 
                              type="text" 
                              value={slides[activeSlideIdx].quote || ""}
                              onChange={(e) => handleSlideFieldChange("quote", e.target.value)}
                              className="text-xs p-2.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] focus:border-[#3D4833]/60 font-sans shadow-inner"
                            />
                          </div>
                          <div className="col-span-1 flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-[#6B7365] font-mono uppercase">Author / Role</span>
                            <input 
                              type="text" 
                              value={slides[activeSlideIdx].author || ""}
                              onChange={(e) => handleSlideFieldChange("author", e.target.value)}
                              className="text-xs p-2.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] focus:border-[#3D4833]/60 font-sans shadow-inner"
                            />
                          </div>
                        </div>
                      )}
   
                      {(slides[activeSlideIdx].layout === "bullets" || !slides[activeSlideIdx].layout) && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[9px] font-bold text-[#6B7365] font-mono uppercase">Slide Bullets</span>
                          {(slides[activeSlideIdx].bullets || []).map((bullet, idx) => (
                            <input 
                              key={idx}
                              type="text" 
                              value={bullet}
                              onChange={(e) => handleBulletChange(idx, e.target.value)}
                              className="text-xs p-2.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] focus:border-[#3D4833]/60 font-sans shadow-inner"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
  
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
