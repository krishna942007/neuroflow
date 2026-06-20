"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, 
  Sparkles, 
  FileText, 
  Download, 
  Check, 
  ArrowRight, 
  Plus, 
  BookOpen, 
  FolderPlus,
  Compass,
  AlertCircle
} from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/workspaceStore";
import { useAuthStore } from "@/lib/store/authStore";
import { requestAIJson } from "@/lib/ai/client";

interface Source {
  id: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

// Inline markdown helper for bold/italic parsing
function parseInlineMarkdown(text: string): React.ReactNode[] | string {
  if (!text) return "";
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} className="font-bold text-[#1c331d]">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={idx} className="italic text-[#1c331d]/90">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

// Dynamic Markdown Renderer for Web Research reports
function ResearchReportRenderer({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/);
  
  return (
    <div className="prose prose-xs text-xs space-y-4 text-[#1c331d]/90 font-sans leading-relaxed">
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        
        // Render markdown table
        if (trimmed.includes("|") && trimmed.split("\n")[1]?.includes("-")) {
          const lines = trimmed.split("\n");
          const headerCells = lines[0].split("|").map(c => c.trim()).filter(Boolean);
          const bodyRows = lines.slice(2).map(line => {
            return line.split("|").map(c => c.trim()).filter(Boolean);
          }).filter(r => r.length > 0);
          
          return (
            <div key={bIdx} className="overflow-x-auto my-4 border border-[#1c331d]/10 rounded-lg p-1.5">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-[#1c331d]/20 text-[#1c331d] font-semibold">
                    {headerCells.map((cell, idx) => (
                      <th key={idx} className="py-2 pr-2">{parseInlineMarkdown(cell)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-[#1c331d]/10 last:border-none">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="py-2 pr-2 text-[#1c331d]/85">{parseInlineMarkdown(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        
        // Render headings
        if (trimmed.startsWith("#")) {
          const match = trimmed.match(/^(#+)\s+(.*)$/);
          if (match) {
            const level = match[1].length;
            const text = match[2];
            const sizeClass = level === 1 
              ? "text-xl font-bold text-[#1c331d] border-b border-[#1c331d]/15 pb-2 mt-4" 
              : level === 2 
                ? "text-base font-bold text-[#1c331d] mt-4 mb-2 border-b border-[#1c331d]/10 pb-1" 
                : "text-xs font-semibold text-[#1c331d] mt-3 mb-1";
            return React.createElement(`h${Math.min(level, 6)}`, { key: bIdx, className: sizeClass }, parseInlineMarkdown(text));
          }
        }
        
        // Render bullet lists
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          const lines = trimmed.split("\n");
          return (
            <ul key={bIdx} className="list-disc pl-5 space-y-1.5 my-3 text-[#1c331d]/85">
              {lines.map((line, lIdx) => {
                const clean = line.replace(/^[*|-|•]\s+/, "");
                return <li key={lIdx}>{parseInlineMarkdown(clean)}</li>;
              })}
            </ul>
          );
        }
        
        // Regular paragraph
        return <p key={bIdx} className="text-[#1c331d]/85 leading-relaxed">{parseInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

export default function ResearchModule() {
  const { addFileToWorkspace } = useWorkspaceStore();
  const { addActivityLog } = useAuthStore();

  const [query, setQuery] = useState("");
  const [deepAnalysis, setDeepAnalysis] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchSteps, setSearchSteps] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [reportTitle, setReportTitle] = useState("");
  const [isExported, setIsExported] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stepsList = [
    "Analyzing search query intent...",
    "Querying global web indices...",
    "Scanning primary sources for facts...",
    "Validating citations and links...",
    "Synthesizing Markdown report & insights..."
  ];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setErrorMsg(null);
    setSearchSteps([]);
    setCurrentStepIndex(0);
    setSources([]);
    setReport(null);
    setIsExported(false);

    addActivityLog("Initiated deep web search", `Query: "${query.substring(0, 30)}...", Deep mode: ${deepAnalysis}`);

    // Cycle through steps simulation
    for (let i = 0; i < stepsList.length; i++) {
      setSearchSteps(prev => [...prev, stepsList[i]]);
      setCurrentStepIndex(i);
      await new Promise(resolve => setTimeout(resolve, deepAnalysis ? 1800 : 900));
    }

    try {
      const result = await requestAIJson<{ report: string; sources?: Omit<Source, "id">[] }>("research", {
        query,
        deepAnalysis,
      });
      const title = query.length > 30 ? `${query.substring(0, 28)}...` : `Web Research: ${query}`;
      setReportTitle(title);
      setSources((result.sources || []).map((source, index) => ({ ...source, id: `src-${index + 1}` })));
      setReport(result.report);
      setIsSearching(false);
      return;
    } catch (error) {
      console.error("Research API failed:", error);
      setErrorMsg(error instanceof Error ? error.message : "AI generation failed. Please verify your environment keys.");
      setIsSearching(false);
      return;
    }
  };

  const handleSaveToWorkspace = () => {
    if (!report) return;

    addFileToWorkspace({
      name: reportTitle + ".report",
      type: "report",
      size: `${Math.round(report.length / 1024)} KB`,
      folderId: "folder-research",
      content: report
    });

    setIsExported(true);
    addActivityLog("Saved research report", `File: ${reportTitle}.report saved to Web Research Reports`);
    setTimeout(() => setIsExported(false), 2500);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent border border-[#3D4833]/[0.08] rounded-2xl relative overflow-hidden font-sans">
      
      {/* Module Header */}
      <div className="h-14 border-b border-[#3D4833]/[0.08] px-6 flex items-center justify-between bg-black/5">
        <div className="flex items-center gap-2">
          <Compass className="h-4.5 w-4.5 text-[#3D4833]" />
          <span className="text-xs font-bold text-[#2A3226] tracking-wider uppercase">AI Research Agent</span>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex flex-col overflow-y-auto p-6">
        
        {/* Search Bar Container */}
        {!report && !isSearching && !errorMsg && (
          <div className="max-w-2xl mx-auto w-full my-auto flex flex-col gap-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#3D4833]/5 border border-[#3D4833]/12 flex items-center justify-center mx-auto text-[#3D4833] animate-pulse">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#2A3226] mb-2">Deep Web Research</h2>
              <p className="text-xs text-[#2A3226]/60 max-w-sm mx-auto leading-relaxed">
                Enter any query or analysis request. The agent will crawl online assets, index facts, cite references, and write a formatted report.
              </p>
            </div>

            <form onSubmit={handleSearch} className="flex flex-col gap-3 rounded-2xl border border-[#3D4833]/15 bg-[#F0E8DC] p-3 mt-4 shadow-md">
              <div className="flex items-center gap-2 px-2">
                <Search className="h-4 w-4 text-[#3D4833]/60 shrink-0" />
                <input 
                  type="text" 
                  placeholder="Analyze competitors, search market sizes, audit technical specs..." 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-[#2A3226] placeholder-[#3D4833]/40 outline-none border-none py-1.5"
                />
              </div>

              <div className="h-[1px] bg-[#3D4833]/10" />

              <div className="flex justify-between items-center px-1">
                {/* Deep Mode Switch */}
                <button
                  type="button"
                  onClick={() => setDeepAnalysis(!deepAnalysis)}
                  className="flex items-center gap-2 text-[10px] font-mono text-[#3D4833]/65 hover:text-[#3D4833] transition-colors select-none"
                >
                  <div className={`w-7 h-4 rounded-full p-0.5 transition-all ${deepAnalysis ? 'bg-[#3D4833]' : 'bg-[#3D4833]/15'}`}>
                    <div className={`w-3 h-3 rounded-full transition-all ${deepAnalysis ? 'translate-x-3 bg-[#F0E8DC]' : 'translate-x-0 bg-[#F0E8DC]/80'}`} />
                  </div>
                  <span>Deep Research Mode</span>
                </button>

                <button 
                  type="submit" 
                  disabled={!query.trim()}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${query.trim() ? '!bg-[#3D4833] hover:!bg-[#2A3226] !text-[#F5EFE4] hover:scale-[1.02] shadow-md active:scale-95' : '!bg-[#F0E8DC] !text-[#2A3226]/30 border border-[#3D4833]/15 cursor-not-allowed'}`}
                >
                  <span>Search</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Error State display */}
        {errorMsg && !isSearching && (
          <div className="max-w-md mx-auto w-full my-auto flex flex-col gap-5 text-center animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2A3226] mb-1.5 font-sans">Research Request Failed</h3>
              <p className="text-xs text-[#2A3226]/70 leading-relaxed px-4 font-sans">
                {errorMsg}
              </p>
            </div>
            <button 
              onClick={() => {
                setErrorMsg(null);
                setReport(null);
              }}
              className="px-6 py-2 rounded-full bg-[#3D4833] text-[#F5EFE4] hover:bg-[#2A3226] text-xs font-semibold self-center transition-all shadow-md workspace-primary-button"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Searching Progress Simulation */}
        {isSearching && (
          <div className="max-w-md mx-auto w-full my-auto flex flex-col gap-6 animate-fade-in">
            <div className="flex flex-col gap-1.5 text-center">
              <span className="text-xs font-mono font-bold text-[#3D4833] uppercase tracking-widest animate-pulse">CRAWLER ACTIVE</span>
              <span className="text-sm font-semibold text-[#2A3226]">Synthesizing resources for &quot;{query}&quot;</span>
            </div>

            <div className="rounded-xl border border-[#3D4833]/12 bg-[#F0E8DC] p-5 flex flex-col gap-3 shadow-md">
              {searchSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs">
                  {idx === currentStepIndex ? (
                    <div className="w-4 h-4 rounded-full border-2 border-[#3D4833] border-t-transparent animate-spin shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-[#3D4833]/10 text-[#3D4833] flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">✓</div>
                  )}
                  <span className={idx === currentStepIndex ? 'text-[#2A3226] font-medium' : 'text-[#2A3226]/50'}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report Preview Panel */}
        {report && !isSearching && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left Column: Report content */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="rounded-xl p-6 shadow-xl leading-relaxed paper-texture">
                {/* Custom Markdown Renderer rendering the actual report */}
                <ResearchReportRenderer content={report} />
              </div>
            </div>

            {/* Right Column: Citations and Actions */}
            <div className="flex flex-col gap-6">
              
              {/* Actions panel */}
              <div className="rounded-xl border border-[#3D4833]/12 bg-[#F0E8DC] p-4 flex flex-col gap-3 shadow-md">
                <span className="text-[10px] font-bold text-[#3D4833]/50 font-mono uppercase px-1">Export Report</span>
                
                <button 
                  onClick={handleSaveToWorkspace}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border transition-all workspace-primary-button ${isExported ? 'bg-emerald-700/10 border-emerald-700/20 text-emerald-800' : 'bg-[#3D4833] text-[#F5EFE4] hover:bg-[#2A3226]'}`}
                >
                  {isExported ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Saved to Workspace</span>
                    </>
                  ) : (
                    <>
                      <FolderPlus className="h-4 w-4" />
                      <span>Save as Report File</span>
                    </>
                  )}
                </button>

                <button 
                  onClick={handlePrintPDF}
                  className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border border-[#3D4833]/12 bg-[#3D4833]/5 hover:bg-[#3D4833]/10 text-[#3D4833] transition-all workspace-muted-button"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Report (PDF)</span>
                </button>

                <button 
                  onClick={() => setReport(null)}
                  className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border border-transparent bg-transparent hover:bg-[#3D4833]/5 text-[#3D4833]/60 hover:text-[#3D4833] transition-all"
                >
                  Conduct New Search
                </button>
              </div>

              {/* Citations panel */}
              <div className="rounded-xl border border-[#3D4833]/12 bg-[#F0E8DC]/50 p-4 flex flex-col gap-4 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-[#2A3226] font-semibold px-1">
                  <Compass className="h-4 w-4 text-[#3D4833]" />
                  <span>Referenced Sources ({sources.length})</span>
                </div>

                <div className="flex flex-col gap-3">
                  {sources.length === 0 ? (
                    <span className="text-[10px] text-[#2A3226]/40 px-1 italic">No sources referenced.</span>
                  ) : (
                    sources.map((src) => (
                      <a 
                        key={src.id}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/src rounded-lg border border-[#3D4833]/10 bg-[#F0E8DC] p-3 flex flex-col gap-1.5 hover:border-[#3D4833]/25 hover:bg-[#F0E8DC] transition-all shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-[#2A3226] truncate max-w-[150px] group-hover/src:text-[#3D4833] transition-colors">{src.title}</span>
                          <span className="text-[8px] font-mono text-[#3D4833]/60 shrink-0">{src.domain}</span>
                        </div>
                        <p className="text-[10px] text-[#2A3226]/65 leading-relaxed font-sans">{src.snippet}</p>
                      </a>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}
