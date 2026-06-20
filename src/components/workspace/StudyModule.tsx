"use client";

import React, { useState, useRef } from "react";
import { 
  FileText, 
  Sparkles, 
  Check, 
  BookOpen, 
  HelpCircle, 
  ListChecks, 
  Layers, 
  MessageSquare, 
  ArrowRight,
  RefreshCw,
  FolderOpen,
  AlertCircle,
  Upload,
  Download
} from "lucide-react";
import { useWorkspaceStore, WorkspaceFile } from "@/lib/store/workspaceStore";
import { useAuthStore } from "@/lib/store/authStore";
import { requestAIJson } from "@/lib/ai/client";
import { parseFile } from "@/lib/utils/fileParser";

type StudyTab = "document" | "flashcard" | "mcq" | "notes" | "concept";

// Inline markdown helper for study notes bold/italic/code parsing
function parseInlineNotesMarkdown(text: string): React.ReactNode[] | string {
  if (!text) return "";
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} className="font-bold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={idx} className="italic text-zinc-200">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={idx} className="px-1.5 py-0.5 rounded bg-black/45 border border-white/10 text-[10px] font-mono text-zinc-300">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

// Custom Markdown notes renderer
function StudyNotesRenderer({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/);
  return (
    <div className="prose prose-invert prose-xs text-xs space-y-4 text-zinc-300 leading-relaxed font-sans">
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Render headings
        if (trimmed.startsWith("#")) {
          const match = trimmed.match(/^(#+)\s+(.*)$/);
          if (match) {
            const level = match[1].length;
            const text = match[2];
            const sizeClass = level === 1 
              ? "text-xl font-bold text-white border-b border-white/5 pb-2 mt-4" 
              : level === 2 
                ? "text-base font-bold text-white mt-4 mb-2 border-b border-white/10 pb-1" 
                : "text-xs font-semibold text-white mt-3 mb-1";
            return React.createElement(`h${Math.min(level, 6)}`, { key: bIdx, className: sizeClass }, parseInlineNotesMarkdown(text));
          }
        }

        // Render bullet lists
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          const lines = trimmed.split("\n");
          return (
            <ul key={bIdx} className="list-disc pl-5 space-y-1.5 my-3 text-zinc-400">
              {lines.map((line, lIdx) => {
                const clean = line.replace(/^[*|-|•]\s+/, "");
                return <li key={lIdx}>{parseInlineNotesMarkdown(clean)}</li>;
              })}
            </ul>
          );
        }

        // Regular paragraph
        return <p key={bIdx} className="text-zinc-400 leading-relaxed">{parseInlineNotesMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

export default function StudyModule() {
  const { files, addFileToWorkspace, activeFolderId } = useWorkspaceStore();
  const { addActivityLog } = useAuthStore();

  const handleSaveSummary = () => {
    if (summary.length === 0 && insights.length === 0) return;
    const baseName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : "Document";
    const name = `Summary_Insights_${baseName}.md`;
    
    let content = `# Document Analysis: ${selectedFile?.name || baseName}\n\n`;
    content += `## Bullet Summary\n`;
    summary.forEach(sum => {
      content += `- ${sum}\n`;
    });
    content += `\n## Critical Insights\n`;
    insights.forEach(ins => {
      content += `- ${ins}\n`;
    });
    
    addFileToWorkspace({
      name,
      type: "md",
      size: `${(content.length / 1024).toFixed(1)} KB`,
      content,
      folderId: activeFolderId || "folder-research",
    });
    addActivityLog("Saved summary to workspace", `File: ${name}`);
    alert(`Saved "${name}" to your workspace files! 💾`);
  };

  const handleSaveFlashcards = () => {
    if (flashcards.length === 0) return;
    const baseName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : "Document";
    const name = `Flashcards_${baseName}.md`;
    
    let content = `# Flashcards: ${selectedFile?.name || baseName}\n\n`;
    flashcards.forEach((card, idx) => {
      content += `### Card ${idx + 1}\n**Q:** ${card.q}\n**A:** ${card.a}\n\n`;
    });
    
    addFileToWorkspace({
      name,
      type: "md",
      size: `${(content.length / 1024).toFixed(1)} KB`,
      content,
      folderId: activeFolderId || "folder-research",
    });
    addActivityLog("Saved flashcards to workspace", `File: ${name}`);
    alert(`Saved "${name}" to your workspace files! 💾`);
  };

  const handleSaveQuiz = () => {
    if (mcqs.length === 0) return;
    const baseName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : "Document";
    const name = `Quiz_${baseName}.md`;
    
    let content = `# MCQ Quiz: ${selectedFile?.name || baseName}\n\n`;
    mcqs.forEach((mcq, qIdx) => {
      content += `### Question ${qIdx + 1}: ${mcq.q}\n`;
      mcq.options.forEach((opt, oIdx) => {
        const isCorrect = mcq.answerIdx === oIdx;
        content += `${oIdx + 1}. [${isCorrect ? "x" : " "}] ${opt}\n`;
      });
      content += `\n`;
    });
    
    addFileToWorkspace({
      name,
      type: "md",
      size: `${(content.length / 1024).toFixed(1)} KB`,
      content,
      folderId: activeFolderId || "folder-research",
    });
    addActivityLog("Saved quiz to workspace", `File: ${name}`);
    alert(`Saved "${name}" to your workspace files! 💾`);
  };

  const handleSaveNotes = () => {
    if (!notes) return;
    const baseName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : "Document";
    const name = `Study_Notes_${baseName}.md`;
    addFileToWorkspace({
      name,
      type: "md",
      size: `${(notes.length / 1024).toFixed(1)} KB`,
      content: notes,
      folderId: activeFolderId || "folder-research",
    });
    addActivityLog("Saved study notes to workspace", `File: ${name}`);
    alert(`Saved "${name}" to your workspace files! 💾`);
  };

  const handleSaveConcepts = () => {
    if (concepts.length === 0) return;
    const baseName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : "Document";
    const name = `Concepts_${baseName}.md`;
    
    let content = `# Concept Definitions: ${selectedFile?.name || baseName}\n\n`;
    concepts.forEach((con) => {
      content += `### ${con.term}\n${con.explanation}\n\n`;
    });
    
    addFileToWorkspace({
      name,
      type: "md",
      size: `${(content.length / 1024).toFixed(1)} KB`,
      content,
      folderId: activeFolderId || "folder-research",
    });
    addActivityLog("Saved concepts to workspace", `File: ${name}`);
    alert(`Saved "${name}" to your workspace files! 💾`);
  };

  const [activeTab, setActiveTab] = useState<StudyTab>("document");
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // File upload states
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    setErrorMsg(null);
    try {
      const parsed = await parseFile(file);
      const newFile = addFileToWorkspace({
        name: parsed.name,
        type: parsed.type,
        size: parsed.size,
        content: parsed.content,
        folderId: activeFolderId || "folder-research", // Default to Web Research Reports folder
      });
      setSelectedFileId(newFile.id);
      addActivityLog("Uploaded Study File", `File: ${file.name}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to upload and parse document file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Document outputs
  const [summary, setSummary] = useState<string[]>([]);
  const [insights, setInsights] = useState<string[]>([]);

  // Flashcards state
  const [flashcards, setFlashcards] = useState<{ q: string; a: string }[]>([]);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // MCQ state
  const [mcqs, setMcqs] = useState<{ q: string; options: string[]; answerIdx: number; selectedIdx: number | null }[]>([]);

  // Revision notes state
  const [notes, setNotes] = useState<string>("");

  // Concept state
  const [concepts, setConcepts] = useState<{ term: string; explanation: string }[]>([]);

  const selectedFile = files.find(f => f.id === selectedFileId);

  const handleDocumentAudit = async () => {
    if (!selectedFileId) return;
    setIsGenerating(true);
    setErrorMsg(null);
    addActivityLog("Analyzed document insights", `File: ${selectedFile?.name}`);

    try {
      const result = await requestAIJson<{ summary: string[]; insights: string[] }>("study_document", {
        fileName: selectedFile?.name,
        content: selectedFile?.content || "",
      });
      setSummary(result.summary || []);
      setInsights(result.insights || []);
      setIsGenerating(false);
    } catch (error) {
      console.error("Document audit failed:", error);
      setErrorMsg(error instanceof Error ? error.message : "Document analysis failed");
      setIsGenerating(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!selectedFileId) return;
    setIsGenerating(true);
    setErrorMsg(null);
    addActivityLog("Generated study flashcards", `File: ${selectedFile?.name}`);

    try {
      const result = await requestAIJson<{ flashcards: { q: string; a: string }[] }>("study_flashcards", {
        fileName: selectedFile?.name,
        content: selectedFile?.content || "",
      });
      setFlashcards(result.flashcards || []);
      setActiveCardIdx(0);
      setIsFlipped(false);
      setIsGenerating(false);
    } catch (error) {
      console.error("Flashcards failed:", error);
      setErrorMsg(error instanceof Error ? error.message : "Flashcards generation failed");
      setIsGenerating(false);
    }
  };

  const handleGenerateMCQs = async () => {
    if (!selectedFileId) return;
    setIsGenerating(true);
    setErrorMsg(null);
    addActivityLog("Generated study MCQs", `File: ${selectedFile?.name}`);

    try {
      const result = await requestAIJson<{ mcqs: { q: string; options: string[]; answerIdx: number }[] }>("study_mcq", {
        fileName: selectedFile?.name,
        content: selectedFile?.content || "",
      });
      setMcqs((result.mcqs || []).map((mcq) => ({ ...mcq, selectedIdx: null })));
      setIsGenerating(false);
    } catch (error) {
      console.error("MCQs failed:", error);
      setErrorMsg(error instanceof Error ? error.message : "Quiz generation failed");
      setIsGenerating(false);
    }
  };

  const handleGenerateNotes = async () => {
    if (!selectedFileId) return;
    setIsGenerating(true);
    setErrorMsg(null);
    addActivityLog("Generated revision notes", `File: ${selectedFile?.name}`);

    try {
      const result = await requestAIJson<{ notes: string }>("study_notes", {
        fileName: selectedFile?.name,
        content: selectedFile?.content || "",
      });
      setNotes(result.notes || "");
      setIsGenerating(false);
    } catch (error) {
      console.error("Notes failed:", error);
      setErrorMsg(error instanceof Error ? error.message : "Revision notes generation failed");
      setIsGenerating(false);
    }
  };

  const handleGenerateConcepts = async () => {
    if (!selectedFileId) return;
    setIsGenerating(true);
    setErrorMsg(null);
    addActivityLog("Generated concept explainer", `File: ${selectedFile?.name}`);

    try {
      const result = await requestAIJson<{ concepts: { term: string; explanation: string }[] }>("study_concepts", {
        fileName: selectedFile?.name,
        content: selectedFile?.content || "",
      });
      setConcepts(result.concepts || []);
      setIsGenerating(false);
    } catch (error) {
      console.error("Concepts failed:", error);
      setErrorMsg(error instanceof Error ? error.message : "Concept scanning failed");
      setIsGenerating(false);
    }
  };

  React.useEffect(() => {
    const handleSherlockAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: string; target: string; value: string }>;
      if (customEvent.detail.target === "study_query") {
        // Auto select first file if none selected
        let activeFileId = selectedFileId;
        if (!activeFileId && files.length > 0) {
          activeFileId = files[0].id;
          setSelectedFileId(files[0].id);
        }
        if (!activeFileId) return;

        const val = customEvent.detail.value.toLowerCase().trim();
        if (val.includes("flashcard") || val.includes("card")) {
          setActiveTab("flashcard");
          if (customEvent.detail.type === "generate") {
            // Use setTimeout to ensure selectedFileId state update has propagated if needed
            setTimeout(() => {
              handleGenerateFlashcards();
            }, 100);
          }
        } else if (val.includes("mcq") || val.includes("quiz") || val.includes("test")) {
          setActiveTab("mcq");
          if (customEvent.detail.type === "generate") {
            setTimeout(() => {
              handleGenerateMCQs();
            }, 100);
          }
        } else if (val.includes("note") || val.includes("revision")) {
          setActiveTab("notes");
          if (customEvent.detail.type === "generate") {
            setTimeout(() => {
              handleGenerateNotes();
            }, 100);
          }
        } else if (val.includes("concept") || val.includes("term") || val.includes("explain")) {
          setActiveTab("concept");
          if (customEvent.detail.type === "generate") {
            setTimeout(() => {
              handleGenerateConcepts();
            }, 100);
          }
        } else {
          setActiveTab("document");
          if (customEvent.detail.type === "generate") {
            setTimeout(() => {
              handleDocumentAudit();
            }, 100);
          }
        }
      }
    };
    window.addEventListener("newton-action", handleSherlockAction);
    window.addEventListener("sherlock-action", handleSherlockAction);
    return () => {
      window.removeEventListener("newton-action", handleSherlockAction);
      window.removeEventListener("sherlock-action", handleSherlockAction);
    };
  }, [selectedFileId, files]);

  const handleMCQSelect = (qIdx: number, oIdx: number) => {
    setMcqs(prev => prev.map((mcq, idx) => 
      idx === qIdx ? { ...mcq, selectedIdx: oIdx } : mcq
    ));
  };

  const studyTabs: { id: StudyTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "document", label: "Doc Workspace", icon: FileText },
    { id: "flashcard", label: "Flashcards", icon: Layers },
    { id: "mcq", label: "Quiz Builder", icon: HelpCircle },
    { id: "notes", label: "Study Notes", icon: ListChecks },
    { id: "concept", label: "Concepts", icon: BookOpen }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508]/40 border border-white/5 rounded-2xl glass-panel relative overflow-hidden font-sans">
      
      {/* Sub tabs bar */}
      <div className="border-b border-white/5 bg-zinc-950/20 px-6 py-2 flex flex-wrap gap-1 items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {studyTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSummary([]);
                  setInsights([]);
                  setFlashcards([]);
                  setMcqs([]);
                  setNotes("");
                  setConcepts([]);
                  setErrorMsg(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${activeTab === tab.id ? 'bg-secondary/15 text-white border border-primary/20' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col">
        
        {/* Step 1: Select File */}
        {!selectedFileId && (
          <div className="max-w-md mx-auto w-full my-auto text-center flex flex-col gap-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1.5">Select a document to study</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Choose an uploaded file from your workspace folders or upload a new file from your device to begin.
              </p>
            </div>

            {/* Premium Upload Area */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
                dragActive 
                  ? "border-primary bg-primary/5 scale-[1.01] shadow-lg shadow-primary/5" 
                  : "border-white/10 bg-zinc-950/20 hover:bg-zinc-950/40 hover:border-primary/30"
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.xls,.txt,.csv,.md,.json"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
              
              {isUploading ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-[11px] font-medium text-zinc-400">Extracting document content...</span>
                </div>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-primary transition-colors">
                    <Upload className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="text-xs font-semibold text-zinc-200">
                      Upload study file
                    </div>
                    <div className="text-[9.5px] text-zinc-500 font-medium">
                      Drag & drop or click to browse
                    </div>
                  </div>
                  <div className="text-[8.5px] text-zinc-600 font-mono tracking-wider uppercase border border-white/5 bg-white/2% px-2 py-0.5 rounded">
                    PDF, DOCX, XLSX, TXT (Max 10MB)
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 my-1.5">
              <div className="h-[1px] bg-white/5 flex-1" />
              <span className="text-[9px] font-bold text-zinc-600 font-mono uppercase tracking-wider">Or Select Recent</span>
              <div className="h-[1px] bg-white/5 flex-1" />
            </div>

            <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
              {files.length === 0 ? (
                <div className="p-4 border border-dashed border-white/10 rounded-xl text-xs text-zinc-600">
                  No files uploaded. Upload a file above to begin.
                </div>
              ) : (
                files.map(file => (
                  <button
                    key={file.id}
                    onClick={() => {
                      setSelectedFileId(file.id);
                      setErrorMsg(null);
                    }}
                    className="w-full p-2.5 rounded-xl border border-white/5 bg-zinc-900/40 hover:bg-zinc-900 text-xs text-left text-zinc-300 hover:text-white flex items-center gap-3 transition-all cursor-pointer"
                  >
                    <FileText className="h-4.5 w-4.5 text-primary shrink-0" />
                    <div className="flex-1 truncate">
                      <div className="font-semibold truncate leading-tight">{file.name}</div>
                      <div className="text-[8.5px] text-zinc-500 font-mono mt-0.5 uppercase tracking-wide">
                        {file.type} • {file.size || "Unknown size"}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Selected file banner */}
        {selectedFileId && (
          <div className="flex items-center gap-2 mb-6 text-xs border-b border-white/5 pb-3">
            <span className="text-zinc-500">Active Study File:</span>
            <span className="px-2.5 py-0.5 rounded bg-[#3D4833] border border-[#3D4833]/10 !text-[#F5EFE4] font-mono font-semibold shadow-sm">{selectedFile?.name}</span>
            <button 
              onClick={() => {
                setSelectedFileId("");
                setErrorMsg(null);
              }} 
              className="text-zinc-600 hover:text-white ml-2 text-[10px]"
            >
              Change file
            </button>
          </div>
        )}

        {/* Error State Banner */}
        {errorMsg && selectedFileId && (
          <div className="max-w-md mx-auto w-full my-auto flex flex-col gap-5 text-center animate-fade-in font-sans">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1.5">Study Task Failed</h3>
              <p className="text-xs text-zinc-500 leading-relaxed px-4">
                {errorMsg}
              </p>
            </div>
            <button 
              onClick={() => {
                setErrorMsg(null);
                setSummary([]);
                setInsights([]);
                setFlashcards([]);
                setMcqs([]);
                setNotes("");
                setConcepts([]);
              }}
              className="px-6 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-white text-xs font-semibold self-center transition-all shadow-md active:scale-95"
            >
              Try Again
            </button>
          </div>
        )}

        {/* DOC WORKSPACE VIEW */}
        {activeTab === "document" && selectedFileId && !errorMsg && (
          <div className="flex-1 flex flex-col">
            {summary.length === 0 && !isGenerating ? (
              <div className="my-auto text-center flex flex-col items-center gap-4 max-w-sm mx-auto">
                <FileText className="h-8 w-8 text-primary animate-pulse" />
                <h4 className="text-sm font-semibold text-white">Extract Document Insights</h4>
                <p className="text-xs text-zinc-500">Conduct structural audits, extract bullet summary lists, and outline key actionable insights.</p>
                <button 
                  onClick={handleDocumentAudit}
                  className="px-6 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold text-white"
                >
                  Analyze Document
                </button>
              </div>
            ) : isGenerating ? (
              <div className="my-auto text-center flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs text-zinc-400">Parsing document indices & vectors...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-4 w-full">
                <div className="flex justify-end">
                  <button 
                    onClick={handleSaveSummary}
                    className="px-3 py-1.5 rounded-lg border border-[#3D4833]/15 bg-[#FAF6E8] text-[#2A3226] text-[10px] font-semibold hover:bg-[#F0E8DC] transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Save Analysis to Workspace
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Summary panel */}
                  <div className="rounded-xl p-5 paper-texture">
                    <span className="text-[10px] font-bold text-[#1c331d]/60 font-mono uppercase block mb-3">Bullet Summary</span>
                    <ul className="flex flex-col gap-3 text-xs text-[#1c331d]/85">
                      {summary.map((sum, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-[#1c331d] shrink-0 mt-0.5" />
                          <span>{sum}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Insights panel */}
                  <div className="rounded-xl p-5 paper-texture">
                    <span className="text-[10px] font-bold text-[#1c331d]/60 font-mono uppercase block mb-3">Critical Insights</span>
                    <ul className="flex flex-col gap-3 text-xs text-[#1c331d]/85">
                      {insights.map((ins, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-800 shrink-0 mt-0.5" />
                          <span>{ins}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {/* FLASHCARDS VIEW */}
        {activeTab === "flashcard" && selectedFileId && !errorMsg && (
          <div className="flex-1 flex flex-col">
            {flashcards.length === 0 && !isGenerating ? (
              <div className="my-auto text-center flex flex-col items-center gap-4 max-w-sm mx-auto">
                <Layers className="h-8 w-8 text-primary" />
                <h4 className="text-sm font-semibold text-white">Generate Flashcard Decks</h4>
                <p className="text-xs text-zinc-500">Synthesize critical terms, definitions, and concepts into interactive study cards.</p>
                <button 
                  onClick={handleGenerateFlashcards}
                  className="px-6 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold text-white"
                >
                  Generate Flashcards
                </button>
              </div>
            ) : isGenerating ? (
              <div className="my-auto text-center flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs text-zinc-400">Synthesizing flashcard terms...</span>
              </div>
            ) : (
              <div className="max-w-md mx-auto w-full flex flex-col gap-4">
                {/* Interactive Flashcard with click-to-flip */}
                <div 
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="h-56 rounded-2xl border border-[#3D4833]/12 paper-texture p-6 flex flex-col items-center justify-center text-center cursor-pointer shadow-md relative overflow-hidden select-none hover:border-[#3D4833]/30 transition-all duration-300"
                >
                  <div className="absolute top-4 right-4 text-[8px] font-mono text-[#3D4833]/50 uppercase">
                    Click card to flip
                  </div>
                  
                  {isFlipped ? (
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-mono font-bold text-[#3D4833]/60 uppercase tracking-widest">Definition</span>
                      <p className="text-xs text-[#2A3226] font-semibold leading-relaxed font-sans px-4">
                        {flashcards[activeCardIdx].a}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-mono font-bold text-[#3D4833]/60 uppercase tracking-widest">Question / Term</span>
                      <h4 className="text-sm font-bold text-[#2A3226] px-4 leading-relaxed">
                        {flashcards[activeCardIdx].q}
                      </h4>
                    </div>
                  )}
                </div>

                {/* Card Nav Controls */}
                <div className="flex justify-between items-center px-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#6B7365] font-mono">
                      Card {activeCardIdx + 1} of {flashcards.length}
                    </span>
                    <button 
                      onClick={handleSaveFlashcards}
                      className="text-[10px] font-semibold text-[#3D4833] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="h-3 w-3" /> Save Deck
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={activeCardIdx === 0}
                      onClick={() => {
                        setActiveCardIdx(prev => prev - 1);
                        setIsFlipped(false);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#3D4833]/15 bg-[#FAF6E8] text-[#2A3226] text-[10px] font-semibold hover:bg-[#F0E8DC] disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                    >
                      Prev
                    </button>
                    <button
                      disabled={activeCardIdx === flashcards.length - 1}
                      onClick={() => {
                        setActiveCardIdx(prev => prev + 1);
                        setIsFlipped(false);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#3D4833]/20 bg-[#3D4833] !text-[#F5EFE4] text-[10px] font-semibold hover:bg-[#2A241C] disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* QUIZ MCQS VIEW */}
        {activeTab === "mcq" && selectedFileId && !errorMsg && (
          <div className="flex-1 flex flex-col">
            {mcqs.length === 0 && !isGenerating ? (
              <div className="my-auto text-center flex flex-col items-center gap-4 max-w-sm mx-auto">
                <HelpCircle className="h-8 w-8 text-primary" />
                <h4 className="text-sm font-semibold text-white">Build Conceptual Quizzes</h4>
                <p className="text-xs text-zinc-500">Generate multiple choice questions based on active files to self-verify key learnings.</p>
                <button 
                  onClick={handleGenerateMCQs}
                  className="px-6 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold text-white"
                >
                  Generate Quiz
                </button>
              </div>
            ) : isGenerating ? (
              <div className="my-auto text-center flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs text-zinc-400">Compiling multiple choice vectors...</span>
              </div>
            ) : (
              <div className="max-w-xl mx-auto w-full flex flex-col gap-4">
                <div className="flex justify-end">
                  <button 
                    onClick={handleSaveQuiz}
                    className="px-3 py-1.5 rounded-lg border border-[#3D4833]/15 bg-[#FAF6E8] text-[#2A3226] text-[10px] font-semibold hover:bg-[#F0E8DC] transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Save Quiz to Workspace
                  </button>
                </div>
                
                <div className="flex flex-col gap-6 w-full">
                  {mcqs.map((mcq, qIdx) => (
                    <div key={qIdx} className="rounded-xl border border-[#3D4833]/12 bg-[#FAF6E8]/40 p-5 flex flex-col gap-3 shadow-sm">
                      <span className="text-[9px] font-mono text-[#3D4833]/60 uppercase">Question {qIdx + 1}</span>
                      <h4 className="text-xs font-bold text-[#2A3226] leading-relaxed">{mcq.q}</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        {mcq.options.map((opt, oIdx) => {
                          const isSelected = mcq.selectedIdx === oIdx;
                          const isCorrect = mcq.answerIdx === oIdx;
                          const showResult = mcq.selectedIdx !== null;
                          
                          let optClass = "border-[#3D4833]/15 bg-[#FAF6E8] hover:bg-[#F0E8DC] text-[#2A3226] shadow-sm";
                          if (isSelected) {
                            optClass = "bg-[#3D4833] border-[#3D4833]/20 !text-[#F5EFE4] shadow-sm font-semibold";
                          }
                          if (showResult) {
                            if (isCorrect) {
                              optClass = "bg-[#d1e7dd] border-[#a3cfbb] !text-[#0f5132] font-semibold";
                            } else if (isSelected) {
                              optClass = "bg-[#f8d7da] border-[#f5c2c7] !text-[#842029]";
                            }
                          }

                          return (
                            <button
                              key={oIdx}
                              onClick={() => handleMCQSelect(qIdx, oIdx)}
                              disabled={showResult}
                              className={`w-full p-2.5 rounded-lg border text-xs text-left transition-all cursor-pointer ${optClass}`}
                            >
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STUDY NOTES REVISION VIEW */}
        {activeTab === "notes" && selectedFileId && !errorMsg && (
          <div className="flex-1 flex flex-col">
            {!notes && !isGenerating ? (
              <div className="my-auto text-center flex flex-col items-center gap-4 max-w-sm mx-auto">
                <ListChecks className="h-8 w-8 text-primary" />
                <h4 className="text-sm font-semibold text-white">Compile Revision Outlines</h4>
                <p className="text-xs text-zinc-500">Create structured summary notes containing outlines, checklists, and summary blocks.</p>
                <button 
                  onClick={handleGenerateNotes}
                  className="px-6 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold text-white"
                >
                  Generate Notes
                </button>
              </div>
            ) : isGenerating ? (
              <div className="my-auto text-center flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs text-zinc-400">Synthesizing markdown headers...</span>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto w-full rounded-xl border border-white/5 bg-zinc-900/10 p-6 leading-relaxed text-zinc-300">
                <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-4">
                  <span className="text-[10px] font-bold text-zinc-500 font-mono uppercase">Revision Outline</span>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => navigator.clipboard.writeText(notes)}
                      className="text-[10px] font-semibold text-[#3D4833] hover:underline cursor-pointer"
                    >
                      Copy Text
                    </button>
                    <button 
                      onClick={handleSaveNotes}
                      className="text-[10px] font-semibold text-[#3D4833] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="h-3 w-3" /> Save to Workspace
                    </button>
                  </div>
                </div>
                <StudyNotesRenderer content={notes} />
              </div>
            )}
          </div>
        )}

        {/* CONCEPT EXPLAINER VIEW */}
        {activeTab === "concept" && selectedFileId && !errorMsg && (
          <div className="flex-1 flex flex-col">
            {concepts.length === 0 && !isGenerating ? (
              <div className="my-auto text-center flex flex-col items-center gap-4 max-w-sm mx-auto">
                <BookOpen className="h-8 w-8 text-primary" />
                <h4 className="text-sm font-semibold text-white">Explain Difficult Concepts</h4>
                <p className="text-xs text-zinc-500">Scan files for advanced technical terms and generate simplified laymans explanations.</p>
                <button 
                  onClick={handleGenerateConcepts}
                  className="px-6 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold text-white"
                >
                  Scan Concepts
                </button>
              </div>
            ) : isGenerating ? (
              <div className="my-auto text-center flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs text-zinc-400">Scanning terms index...</span>
              </div>
            ) : (
              <div className="max-w-xl mx-auto w-full flex flex-col gap-4">
                <div className="flex justify-end">
                  <button 
                    onClick={handleSaveConcepts}
                    className="px-3 py-1.5 rounded-lg border border-[#3D4833]/15 bg-[#FAF6E8] text-[#2A3226] text-[10px] font-semibold hover:bg-[#F0E8DC] transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Save Concepts to Workspace
                  </button>
                </div>
                <div className="flex flex-col gap-4 w-full">
                  {concepts.map((con, idx) => (
                    <div key={idx} className="rounded-xl p-4 flex flex-col gap-1.5 paper-texture">
                      <span className="text-xs font-bold text-[#1c331d]">{con.term}</span>
                      <p className="text-xs text-[#1c331d]/80 leading-relaxed font-sans">{con.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
