"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Paperclip, 
  Mic, 
  MicOff, 
  Sparkles, 
  Check, 
  Copy, 
  Bot, 
  User, 
  FileText, 
  BrainCircuit, 
  ChevronDown,
  Trash2,
  FolderOpen
} from "lucide-react";
import { useChatStore, Message } from "@/lib/store/chatStore";
import { useWorkspaceStore } from "@/lib/store/workspaceStore";
import { useAuthStore } from "@/lib/store/authStore";
import { useUIStore } from "@/lib/store/uiStore";
import LiquidGlassCard from "@/components/ui/LiquidGlassCard";

// Custom simple parser to render Markdown safely
function MarkdownRenderer({ content }: { content: string }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const paragraphs = content.split("\n\n");

  return (
    <div className="chat-msg-content space-y-3.5 text-sm leading-relaxed">
      {paragraphs.map((p, pIdx) => {
        const trimmed = p.trim();
        if (!trimmed) return null;

        // Code block formatting
        if (trimmed.startsWith("```")) {
          const lines = trimmed.split("\n");
          const lang = lines[0].replace("```", "") || "code";
          const code = lines.slice(1, lines.length - (lines[lines.length - 1] === "```" ? 1 : 0)).join("\n");
          const blockId = `code-${pIdx}`;

          return (
            <div key={pIdx} className="my-4 rounded-xl border border-white/10 bg-black/45 overflow-hidden font-mono text-xs">
              <div className="flex justify-between items-center px-4 py-2 border-b border-white/10 bg-black/25 text-[#FBF5DD]/60">
                <span className="text-[10px] uppercase font-bold tracking-wider">{lang}</span>
                <button 
                  onClick={() => copyToClipboard(code, blockId)}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  {copiedId === blockId ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span className="text-[10px]">Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto scrollbar-thin text-zinc-300 leading-5">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        // Heading formatting
        if (trimmed.startsWith("#")) {
          const level = (trimmed.match(/^#+/) || ["#"])[0].length;
          const text = trimmed.replace(/^#+\s+/, "");
          const classes = level === 1 ? "text-xl font-bold mt-4 mb-2" : level === 2 ? "text-lg font-bold mt-3 mb-1.5" : "text-base font-semibold mt-2 mb-1";
          return React.createElement(`h${Math.min(level + 1, 6)}`, { key: pIdx, className: classes }, text);
        }

        // Bullet lists
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          const items = trimmed.split(/\n[*|-]\s+/);
          return (
            <ul key={pIdx} className="list-disc pl-5 space-y-1.5 my-2">
              {items.map((item, itemIdx) => {
                const cleanItem = item.replace(/^[*|-]\s+/, "");
                return <li key={itemIdx}>{parseBoldItalic(cleanItem)}</li>;
              })}
            </ul>
          );
        }

        return <p key={pIdx}>{parseBoldItalic(trimmed)}</p>;
      })}
    </div>
  );
}

// Inline formatting helper for bold / italic symbols
function parseBoldItalic(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={idx} className="italic">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

// Animated Flowing Particles Typing Indicator using HTML5 Canvas
function FlowingParticlesIndicator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const particles: Array<{ x: number; y: number; speed: number; size: number; alpha: number; angle: number }> = [];

    // Initialize flowing particles
    for (let i = 0; i < 15; i++) {
      particles.push({
        x: Math.random() * 70,
        y: 8 + Math.random() * 12,
        speed: 0.4 + Math.random() * 0.6,
        size: 1.2 + Math.random() * 1.8,
        alpha: 0.3 + Math.random() * 0.7,
        angle: Math.random() * Math.PI * 2
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Move and draw particles
      particles.forEach((p, idx) => {
        p.x += p.speed;
        p.y += Math.sin(p.x * 0.12 + p.angle) * 0.22;

        // Reset if it flows out
        if (p.x > canvas.width) {
          p.x = -2;
          p.y = 6 + Math.random() * 16;
          p.speed = 0.4 + Math.random() * 0.6;
          p.alpha = 0.3 + Math.random() * 0.7;
        }

        // Draw particle node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251, 245, 221, ${p.alpha})`; // Light cream
        ctx.fill();

        // Connect nearby nodes
        for (let j = idx + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 14) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(231, 225, 177, ${(1 - dist / 14) * 0.15})`; // Sage cream
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <canvas 
        ref={canvasRef} 
        width={75} 
        height={26} 
        className="w-[75px] h-[26px] opacity-80"
      />
      <span className="text-[10px] font-mono font-bold text-[#E0D6C6] animate-pulse">thinking...</span>
    </div>
  );
}

export default function ChatModule() {
  const { 
    conversations, 
    messages, 
    activeConversationId, 
    selectedModel, 
    tokenContextSize,
    isStreaming,
    setSelectedModel,
    setTokenContextSize,
    createConversation,
    addMessage,
    clearConversation,
    simulateStreamingResponse,
    setActiveConversation
  } = useChatStore();

  const { files } = useWorkspaceStore();
  const { addActivityLog, checkAndIncrementUsage, user } = useAuthStore();
  const setLimitWarning = useUIStore((s) => s.setLimitWarning);

  const [inputPrompt, setInputPrompt] = useState("");
  const [isAttachedMenuOpen, setIsAttachedMenuOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize a conversation if none exist, or auto-select the first one if activeConversationId is null/invalid
  useEffect(() => {
    if (conversations.length === 0) {
      createConversation();
    } else if (!activeConversationId || !conversations.some(c => c.id === activeConversationId)) {
      setActiveConversation(conversations[0].id);
    }
  }, [activeConversationId, conversations, createConversation, setActiveConversation]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, activeConversationId]);

  const activeMessages = activeConversationId ? (messages[activeConversationId] || []) : [];
  const selectedFile = files.find(f => f.id === selectedFileId);

  const handleSend = async (e?: React.FormEvent, overridePrompt?: string) => {
    e?.preventDefault();
    const activePrompt = overridePrompt !== undefined ? overridePrompt : inputPrompt;
    if (!activePrompt.trim() || isStreaming || !activeConversationId) return;

    const limitCheck = checkAndIncrementUsage("message");
    if (!limitCheck.allowed) {
      setLimitWarning({ type: "message", limit: limitCheck.limit, plan: user?.plan || "free" });
      return;
    }

    setInputPrompt("");
    
    // Add user message
    const attachments = selectedFile ? [{ id: selectedFile.id, name: selectedFile.name, type: selectedFile.type }] : undefined;
    addMessage(activeConversationId, "user", activePrompt.trim(), undefined, attachments);
    
    const fileContext = selectedFile?.content || "";
    setSelectedFileId(null); // clear attachment for next message

    addActivityLog("Sent prompt to AI Chat", `Prompt: "${activePrompt.trim().substring(0, 30)}...", Model: ${selectedModel}`);

    // Trigger dynamic simulation stream response
    await simulateStreamingResponse(activeConversationId, activePrompt.trim(), "", fileContext);
  };

  useEffect(() => {
    const handleSherlockAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: string; target: string; value: string }>;
      if (customEvent.detail.target === "chat_input") {
        setInputPrompt(customEvent.detail.value);
        if (customEvent.detail.type === "generate") {
          handleSend(undefined, customEvent.detail.value);
        }
      }
    };
    window.addEventListener("newton-action", handleSherlockAction);
    window.addEventListener("sherlock-action", handleSherlockAction);
    return () => {
      window.removeEventListener("newton-action", handleSherlockAction);
      window.removeEventListener("sherlock-action", handleSherlockAction);
    };
  }, [activeConversationId, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Simulating speech to text
  const toggleVoiceInput = () => {
    if (isListening) {
      setIsListening(false);
    } else {
      setIsListening(true);
      setInputPrompt("Listening... Speak now.");
      setTimeout(() => {
        setInputPrompt("How can I build a premium landing page with Framer Motion?");
        setIsListening(false);
      }, 2500);
    }
  };

  const modelsList = [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", tier: "Free" },
    { id: "groq-deepseek-r1", name: "Groq DeepSeek R1", tier: "Free" },
    { id: "groq-llama-3", name: "Groq Llama 3.3", tier: "Free" },
    { id: "openai-gpt-4o", name: "OpenAI GPT-4o", tier: "Premium" },
    { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", tier: "Premium" },
    { id: "ollama-local", name: "Ollama Local Models", tier: "Local" }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent border border-[#3D4833]/[0.08] rounded-2xl relative overflow-hidden font-sans">
      
      {/* Module Header Bar */}
      <div className="h-14 border-b border-[#3D4833]/[0.08] px-6 flex items-center justify-between bg-black/5">
        <div className="flex items-center gap-3">
          <div className="h-8 px-2.5 rounded-lg border border-[#3D4833]/10 bg-[#3D4833]/5 hover:bg-[#3D4833]/10 flex items-center gap-1.5 text-xs text-[#2A3226] font-semibold cursor-pointer relative transition-all"
               onClick={() => setIsSettingsOpen(!isSettingsOpen)}>
            <BrainCircuit className="h-4 w-4 text-[#3D4833]" />
            <span>{modelsList.find(m => m.id === selectedModel)?.name}</span>
            <ChevronDown className="h-3 w-3 text-[#3D4833]/60" />
            
            {/* Model Dropdown Popup */}
            {isSettingsOpen && (
              <div className="absolute top-[calc(100%+8px)] left-0 z-40 p-1.5 rounded-xl border border-[#3D4833]/15 bg-[#F0E8DC] shadow-2xl flex flex-col gap-1 w-52 select-none">
                <span className="text-[9px] font-bold text-[#3D4833]/50 font-mono uppercase px-2.5 py-1">Available Models</span>
                {modelsList.map((m) => (
                  <button
                    key={m.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedModel(m.id);
                      setIsSettingsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-xs transition-all ${m.id === selectedModel ? 'bg-[#3D4833]/10 text-[#3D4833] border border-[#3D4833]/15' : 'hover:bg-[#3D4833]/5 text-[#2A3226]/75 hover:text-[#2A3226]'}`}
                  >
                    <span>{m.name}</span>
                    <span className={`text-[8px] font-mono px-1 py-0.2 rounded ${m.tier === 'Premium' ? 'bg-[#3D4833]/15 text-[#3D4833]' : m.tier === 'Local' ? 'bg-cyan-500/10 text-cyan-700' : 'bg-[#3D4833]/5 text-[#3D4833]/60'}`}>{m.tier}</span>
                  </button>
                ))}
                
                <div className="h-[1px] bg-[#FBF5DD]/10 my-1" />
                <span className="text-[9px] font-bold text-zinc-500 font-mono uppercase px-2.5 py-1">Sliding Token Memory</span>
                <div className="px-3 py-2 flex flex-col gap-1">
                  <input 
                    type="range" 
                    min="1024" 
                    max="16384" 
                    step="1024"
                    value={tokenContextSize}
                    onChange={(e) => setTokenContextSize(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-black/45 rounded-lg appearance-none cursor-pointer accent-[#E0D6C6]"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-zinc-500">
                    <span>1K tokens</span>
                    <span className="text-[#E0D6C6] font-bold">{tokenContextSize} tkn</span>
                    <span>16K tokens</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={() => activeConversationId && clearConversation(activeConversationId)}
          title="Clear Conversation History"
          className="p-2 rounded-full hover:bg-[#3D4833]/5 text-[#3D4833]/50 hover:text-red-600 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Messages Scroll Panel */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
        {activeMessages.length === 0 ? (
          /* Empty Chat Welcome Grid */
          <div className="flex-1 flex flex-col justify-center items-center max-w-lg mx-auto text-center gap-6 mt-10">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#3D4833] to-[#E5DDD0] flex items-center justify-center shadow-lg border border-[#3D4833]/15 animate-pulse">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-[20px] font-extrabold text-[#2A3226] font-sans">How can I assist your workspace today?</h3>
              <p className="text-xs text-[#2A3226]/70 leading-relaxed">
                NeuroFlow AI supports multi-model chat flows, context-compressed sliding buffers, and document integrations. Get started with a default workflow:
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3.5 w-full mt-4">
              <button 
                onClick={() => setInputPrompt("Write a TypeScript function to sort data lists dynamically")}
                className="p-4 text-left rounded-xl border border-[#3D4833]/12 bg-[#F0E8DC] hover:bg-[#3D4833]/5 hover:border-[#3D4833]/30 text-xs transition-all flex flex-col gap-1 text-[#2A3226]/65 hover:text-[#2A3226] shadow-sm"
              >
                <span className="font-bold text-[#2A3226]">TypeScript Utility</span>
                <span className="text-[#3D4833]/50 text-[10px]">Sort arrays using quicksort algorithms.</span>
              </button>
              <button 
                onClick={() => setInputPrompt("Audit my resume and suggest bullet point optimizations")}
                className="p-4 text-left rounded-xl border border-[#3D4833]/12 bg-[#F0E8DC] hover:bg-[#3D4833]/5 hover:border-[#3D4833]/30 text-xs transition-all flex flex-col gap-1 text-[#2A3226]/65 hover:text-[#2A3226] shadow-sm"
              >
                <span className="font-bold text-[#2A3226]">Resume Optimize</span>
                <span className="text-[#3D4833]/50 text-[10px]">Polish bullet points to fit ATS systems.</span>
              </button>
            </div>
          </div>
        ) : (
          /* Conversation Messages List */
          activeMessages.map((msg, index) => {
            const isAssistant = msg.role === "assistant";
            const isLastMsg = index === activeMessages.length - 1;
            const isMsgStreamingAndEmpty = isAssistant && isLastMsg && isStreaming && msg.content === "";
            
            return (
              <div 
                key={msg.id}
                className={`flex gap-4 max-w-3xl ${isAssistant ? 'self-start' : 'self-end flex-row-reverse'}`}
              >
                {/* Profile Avatars */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md ${isAssistant ? 'bg-[#3D4833]/10 border border-[#3D4833]/20 text-[#3D4833]' : 'bg-[#3D4833] text-[#F5EFE4] font-bold'}`}>
                  {isAssistant ? <Bot className="h-4.5 w-4.5" /> : <User className="h-4 w-4" />}
                </div>

                {/* Message Box */}
                <div className="flex flex-col gap-1.5 max-w-full">
                  {isAssistant ? (
                    <LiquidGlassCard 
                      material="liquid" 
                      className="px-4 py-3 text-[#2A3226]"
                      containerClassName="rounded-2xl"
                    >
                      {/* Attachment files badge if any */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {msg.attachments.map((file) => (
                            <div key={file.id} className="inline-flex items-center gap-1 px-2 py-0.8 rounded bg-[#3D4833]/5 border border-[#3D4833]/15 text-[9px] font-mono text-[#2A3226]/60">
                              <FileText className="h-3 w-3 text-[#3D4833]" />
                              <span>{file.name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {isMsgStreamingAndEmpty ? (
                        <FlowingParticlesIndicator />
                      ) : msg.content === "" && isStreaming ? (
                        <div className="flex flex-col gap-2.5 w-40 md:w-56 py-1">
                          <div className="h-3 w-3/4 rounded bg-gradient-to-r from-[#3D4833]/5 via-[#3D4833]/15 to-[#3D4833]/5 bg-[length:200%_100%] animate-shimmer" />
                          <div className="h-3 w-5/6 rounded bg-gradient-to-r from-[#3D4833]/5 via-[#3D4833]/15 to-[#3D4833]/5 bg-[length:200%_100%] animate-shimmer" />
                          <div className="h-3 w-1/2 rounded bg-gradient-to-r from-[#3D4833]/5 via-[#3D4833]/15 to-[#3D4833]/5 bg-[length:200%_100%] animate-shimmer" />
                        </div>
                      ) : (
                        <MarkdownRenderer content={msg.content} />
                      )}
                    </LiquidGlassCard>
                  ) : (
                    <div className="user-msg-bubble rounded-2xl px-4 py-3 shadow-md bg-[#3D4833]/10 border border-[#3D4833]/20 text-[#2A3226]">
                      {/* Attachment files badge if any */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {msg.attachments.map((file) => (
                            <div key={file.id} className="inline-flex items-center gap-1 px-2 py-0.8 rounded bg-[#3D4833]/5 border border-[#3D4833]/15 text-[9px] font-mono text-[#2A3226]/65">
                              <FileText className="h-3 w-3 text-[#3D4833]" />
                              <span>{file.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <MarkdownRenderer content={msg.content} />
                    </div>
                  )}
                  <span className="text-[9px] text-[#3D4833]/40 px-2 self-start font-mono" suppressHydrationWarning>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Attachment Menu Popup */}
      {isAttachedMenuOpen && (
        <div className="absolute bottom-[80px] left-6 z-40 p-2 rounded-xl border border-[#3D4833]/15 bg-[#F0E8DC] shadow-2xl flex flex-col gap-1 w-64 select-none animate-fade-in">
          <span className="text-[9px] font-bold text-[#3D4833]/50 font-mono uppercase px-2.5 py-1">Attach Workspace File</span>
          {files.length === 0 ? (
            <span className="text-[10px] text-[#2A3226]/40 px-3 py-2 italic">No files available. Upload one in workspace.</span>
          ) : (
            files.map((file) => (
              <button
                key={file.id}
                onClick={() => {
                  setSelectedFileId(file.id);
                  setIsAttachedMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-xs transition-all ${file.id === selectedFileId ? 'bg-[#3D4833]/10 text-[#3D4833] border border-[#3D4833]/15' : 'hover:bg-[#3D4833]/5 text-[#2A3226]/65 hover:text-[#2A3226]'}`}
              >
                <FileText className="h-3.5 w-3.5 text-[#3D4833]/50 shrink-0" />
                <span className="truncate">{file.name}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Message Input Form container */}
      <div className="p-4 border-t border-[#3D4833]/[0.08] bg-transparent">
        <form onSubmit={handleSend} className="relative flex items-end gap-2.5 rounded-xl border border-[#3D4833]/15 bg-[#F0E8DC] p-2 shadow-lg">
          
          {/* Attach Button */}
          <button
            type="button"
            onClick={() => setIsAttachedMenuOpen(!isAttachedMenuOpen)}
            className={`p-2.5 rounded-lg hover:bg-[#3D4833]/5 text-[#3D4833]/65 hover:text-[#3D4833] transition-all shrink-0 ${selectedFileId ? 'bg-[#3D4833]/10 text-[#3D4833] border border-[#3D4833]/15' : ''}`}
          >
            <Paperclip className="h-4.5 w-4.5" />
          </button>

          {/* Prompt Input text area */}
          <div className="flex-1 flex flex-col">
            
            {/* Attachment preview banner */}
            {selectedFile && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#3D4833]/5 border border-[#3D4833]/15 text-[9px] font-mono text-[#2A3226] w-fit mb-1.5">
                <FileText className="h-3.5 w-3.5 text-[#3D4833]" />
                <span>Selected: {selectedFile.name}</span>
                <button type="button" onClick={() => setSelectedFileId(null)} className="text-[#3D4833]/60 hover:text-[#2A3226] font-bold ml-1">×</button>
              </div>
            )}

            <textarea
              ref={inputRef}
              rows={1}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything, attach code blocks, or write scripts..."
              className="w-full bg-transparent text-sm text-[#2A3226] placeholder-[#3D4833]/40 outline-none border-none py-1.5 px-1 resize-none max-h-32 min-h-[24px]"
            />
          </div>

          {/* Voice Input Button */}
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`p-2.5 rounded-lg hover:bg-[#3D4833]/5 transition-all shrink-0 ${isListening ? 'bg-red-500/10 text-red-500 animate-pulse' : 'text-[#3D4833]/65 hover:text-[#3D4833]'}`}
            title="Speech to Text Simulation"
          >
            {isListening ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
          </button>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isStreaming}
            className={`p-2.5 rounded-lg transition-all shrink-0 ${inputPrompt.trim() && !isStreaming ? 'bg-[#3D4833] text-[#F5EFE4] hover:bg-[#2A3226] hover:scale-[1.02]' : 'bg-[#3D4833]/10 text-[#3D4833]/25 cursor-not-allowed'}`}
          >
            <Send className="h-4 w-4" />
          </button>

        </form>

        <div className="flex justify-between text-[10px] text-[#3D4833]/45 font-mono mt-2 px-1">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span>Buffer: {tokenContextSize} tkns</span>
        </div>
      </div>

    </div>
  );
}
