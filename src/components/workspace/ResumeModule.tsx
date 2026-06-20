"use client";

import React, { useState, useRef } from "react";
import { 
  FileText, 
  Search, 
  Sparkles, 
  Check, 
  Briefcase, 
  Plus, 
  UserCheck, 
  ArrowRight, 
  Clipboard, 
  HelpCircle,
  TrendingUp,
  Brain,
  RotateCcw,
  AlertCircle,
  Upload
} from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/workspaceStore";
import { useAuthStore } from "@/lib/store/authStore";
import { requestAIJson } from "@/lib/ai/client";
import { parseFile } from "@/lib/utils/fileParser";

type ResumeTab = "ats" | "match" | "rewrite" | "cover" | "linkedin" | "interview";

export default function ResumeModule() {
  const { files, addFileToWorkspace } = useWorkspaceStore();
  const { addActivityLog } = useAuthStore();

  const [activeTab, setActiveTab] = useState<ResumeTab>("ats");
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [jobDescription, setJobDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // File upload states
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resume Scorer states
  const [atsScore, setAtsScore] = useState<number | null>(null);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [formattingAudits, setFormattingAudits] = useState<{ item: string; pass: boolean }[]>([]);

  // Match states
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [missingSkills, setMissingSkills] = useState<string[]>([]);

  // Rewriter states
  const [bulletPoint, setBulletPoint] = useState("");
  const [rewrittenBullet, setRewrittenBullet] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);

  // Cover Letter states
  const [roleTitle, setRoleTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);

  // LinkedIn states
  const [linkedinOutput, setLinkedinOutput] = useState<{ headline: string; about: string } | null>(null);
  const [isOptimizingLinkedin, setIsOptimizingLinkedin] = useState(false);

  // Interview Prep states
  const [interviewQuestions, setInterviewQuestions] = useState<{ q: string; a: string; cat: "tech" | "hr" | "behavioral" }[]>([]);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const selectedFile = files.find(f => f.id === selectedFileId);

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
        folderId: "folder-careers", // Careers folder for resumes
      });
      setSelectedFileId(newFile.id);
      addActivityLog("Uploaded Resume", `File: ${file.name}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to upload and parse resume file");
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

  const handleATSAnalyze = async () => {
    if (!selectedFileId) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    addActivityLog("Conducted ATS Resume Analysis", `Resume: ${selectedFile?.name}`);

    try {
      const result = await requestAIJson<{
        atsScore: number;
        missingKeywords: string[];
        formattingAudits: { item: string; pass: boolean }[];
      }>("resume_ats", { resume: selectedFile?.content || "" });
      setAtsScore(result.atsScore);
      setMissingKeywords(result.missingKeywords || []);
      setFormattingAudits(result.formattingAudits || []);
      setIsAnalyzing(false);
    } catch (error) {
      console.error("ATS analysis failed:", error);
      setErrorMsg(error instanceof Error ? error.message : "ATS resume analysis failed");
      setIsAnalyzing(false);
    }
  };

  const handleJobMatch = async (overrideJobDesc?: string) => {
    const activeJobDesc = overrideJobDesc !== undefined ? overrideJobDesc : jobDescription;
    if (!selectedFileId || !activeJobDesc.trim()) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    addActivityLog("Conducted Resume Job Matching Audit", `Job Match check against ${selectedFile?.name}`);

    try {
      const result = await requestAIJson<{ matchScore: number; missingSkills: string[] }>("resume_match", {
        resume: selectedFile?.content || "",
        jobDescription: activeJobDesc,
      });
      setMatchScore(result.matchScore);
      setMissingSkills(result.missingSkills || []);
      setIsAnalyzing(false);
    } catch (error) {
      console.error("Job match analysis failed:", error);
      setErrorMsg(error instanceof Error ? error.message : "Job match analysis failed");
      setIsAnalyzing(false);
    }
  };

  const handleRewriteBullet = async (overrideBullet?: string) => {
    const activeBullet = overrideBullet !== undefined ? overrideBullet : bulletPoint;
    if (!activeBullet.trim()) return;
    setIsRewriting(true);
    setErrorMsg(null);
    addActivityLog("Rewrote resume bullet point");

    try {
      const result = await requestAIJson<{ rewrittenBullet: string }>("resume_rewrite", { bulletPoint: activeBullet });
      setRewrittenBullet(result.rewrittenBullet || "");
      setIsRewriting(false);
    } catch (error) {
      console.error("Rewrite bullet point failed:", error);
      setErrorMsg(error instanceof Error ? error.message : "Bullet point rewrite failed");
      setIsRewriting(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!roleTitle.trim() || !companyName.trim()) return;
    setIsGeneratingCover(true);
    setErrorMsg(null);
    addActivityLog("Generated tailored cover letter", `Role: ${roleTitle} at ${companyName}`);

    try {
      const result = await requestAIJson<{ coverLetter: string }>("resume_cover", {
        roleTitle,
        companyName,
        resume: selectedFile?.content || "",
      });
      setCoverLetter(result.coverLetter || "");
      setIsGeneratingCover(false);
    } catch (error) {
      console.error("Cover letter failed:", error);
      setErrorMsg(error instanceof Error ? error.message : "Cover letter generation failed");
      setIsGeneratingCover(false);
    }
  };

  const handleOptimizeLinkedIn = async () => {
    if (!selectedFileId) return;
    setIsOptimizingLinkedin(true);
    setErrorMsg(null);
    addActivityLog("Optimized LinkedIn Profile", `Resume parsed: ${selectedFile?.name}`);

    try {
      const result = await requestAIJson<{ headline: string; about: string }>("resume_linkedin", {
        resume: selectedFile?.content || "",
      });
      setLinkedinOutput(result);
      setIsOptimizingLinkedin(false);
    } catch (error) {
      console.error("LinkedIn optimization failed:", error);
      setErrorMsg(error instanceof Error ? error.message : "LinkedIn optimization failed");
      setIsOptimizingLinkedin(false);
    }
  };

  const handleGenerateInterviewPrep = async () => {
    if (!selectedFileId) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    addActivityLog("Generated Interview Prep Questions", `Resume parsed: ${selectedFile?.name}`);

    try {
      const result = await requestAIJson<{ questions: { q: string; a: string; cat: "tech" | "hr" | "behavioral" }[] }>("resume_interview", {
        resume: selectedFile?.content || "",
      });
      setInterviewQuestions(result.questions || []);
      setActiveQuestionIdx(0);
      setShowAnswer(false);
      setIsAnalyzing(false);
    } catch (error) {
      console.error("Interview prep failed:", error);
      setErrorMsg(error instanceof Error ? error.message : "Interview prep questions generation failed");
      setIsAnalyzing(false);
    }
  };

  React.useEffect(() => {
    const handleSherlockAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: string; target: string; value: string }>;
      if (customEvent.detail.target === "resume_skills") {
        // Auto select first file if none selected
        let activeFileId = selectedFileId;
        if (!activeFileId && files.length > 0) {
          activeFileId = files[0].id;
          setSelectedFileId(files[0].id);
        }

        const val = customEvent.detail.value.toLowerCase().trim();
        if (val.includes("rewrite") || val.includes("bullet")) {
          setActiveTab("rewrite");
          setBulletPoint(customEvent.detail.value);
          if (customEvent.detail.type === "generate") {
            setTimeout(() => {
              handleRewriteBullet(customEvent.detail.value);
            }, 100);
          }
        } else if (val.includes("cover") || val.includes("letter")) {
          setActiveTab("cover");
          setRoleTitle("Software Engineer");
          setCompanyName("Innovate Tech");
          if (customEvent.detail.type === "generate") {
            setTimeout(() => {
              handleGenerateCoverLetter();
            }, 100);
          }
        } else if (val.includes("linkedin") || val.includes("headline")) {
          setActiveTab("linkedin");
          if (customEvent.detail.type === "generate") {
            setTimeout(() => {
              handleOptimizeLinkedIn();
            }, 100);
          }
        } else if (val.includes("interview") || val.includes("prep") || val.includes("question")) {
          setActiveTab("interview");
          if (customEvent.detail.type === "generate") {
            setTimeout(() => {
              handleGenerateInterviewPrep();
            }, 100);
          }
        } else if (val.includes("match") || val.includes("job")) {
          setActiveTab("match");
          setJobDescription(customEvent.detail.value);
          if (customEvent.detail.type === "generate") {
            setTimeout(() => {
              handleJobMatch(customEvent.detail.value);
            }, 100);
          }
        } else {
          setActiveTab("ats");
          if (customEvent.detail.type === "generate") {
            setTimeout(() => {
              handleATSAnalyze();
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

  const tabs: { id: ResumeTab; label: string }[] = [
    { id: "ats", label: "ATS Scorer" },
    { id: "match", label: "Job Matcher" },
    { id: "rewrite", label: "Bullet Rewriter" },
    { id: "cover", label: "Cover Letter" },
    { id: "linkedin", label: "LinkedIn Optimizer" },
    { id: "interview", label: "Interview Prep" }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508]/40 border border-white/5 rounded-2xl glass-panel relative overflow-hidden font-sans">
      
      {/* Tab selectors bar */}
      <div className="border-b border-white/5 bg-zinc-950/20 px-6 py-2 flex flex-wrap gap-1 items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                // Clear tab states
                setAtsScore(null);
                setMatchScore(null);
                setRewrittenBullet("");
                setCoverLetter("");
                setLinkedinOutput(null);
                setInterviewQuestions([]);
                setActiveQuestionIdx(null);
                setErrorMsg(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.id ? 'bg-secondary/15 text-white border border-primary/20 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col">
        
        {/* Step 1: Select Resume File wrapper */}
        {activeTab !== "rewrite" && activeTab !== "cover" && !selectedFileId && (
          <div className="max-w-md mx-auto w-full my-auto text-center flex flex-col gap-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1.5">Select a resume to parse</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Choose an uploaded PDF, DOCX, or TXT resume, or upload a new one from your device to run evaluations.
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
                accept=".pdf,.docx,.txt"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
              
              {isUploading ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-[11px] font-medium text-zinc-400">Extracting text content...</span>
                </div>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-primary transition-colors">
                    <Upload className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="text-xs font-semibold text-zinc-200">
                      Upload from device
                    </div>
                    <div className="text-[9.5px] text-zinc-500 font-medium">
                      Drag & drop or click to browse
                    </div>
                  </div>
                  <div className="text-[8.5px] text-zinc-600 font-mono tracking-wider uppercase border border-white/5 bg-white/2% px-2 py-0.5 rounded">
                    PDF, DOCX, TXT (Max 10MB)
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
              {files.filter(f => f.type === "pdf" || f.type === "docx" || f.type === "txt").length === 0 ? (
                <div className="p-4 border border-dashed border-white/10 rounded-xl text-xs text-zinc-600">
                  No resumes uploaded. Upload a file above to begin.
                </div>
              ) : (
                files.filter(f => f.type === "pdf" || f.type === "docx" || f.type === "txt").map(file => (
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

        {/* Tab View Contents */}
        {selectedFileId && (
          <div className="flex items-center gap-2 mb-6 text-xs border-b border-white/5 pb-3">
            <span className="text-zinc-500">Active Resume File:</span>
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
        {errorMsg && (
          <div className="max-w-md mx-auto w-full my-auto flex flex-col gap-5 text-center animate-fade-in font-sans">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1.5">Resume Task Failed</h3>
              <p className="text-xs text-zinc-500 leading-relaxed px-4">
                {errorMsg}
              </p>
            </div>
            <button 
              onClick={() => {
                setErrorMsg(null);
                setAtsScore(null);
                setMatchScore(null);
                setRewrittenBullet("");
                setCoverLetter("");
                setLinkedinOutput(null);
                setInterviewQuestions([]);
                setActiveQuestionIdx(null);
              }}
              className="px-6 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-white text-xs font-semibold self-center transition-all shadow-md active:scale-95"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ATS SCORER TAB */}
        {activeTab === "ats" && selectedFileId && !errorMsg && (
          <div className="flex-1 flex flex-col">
            {atsScore === null && !isAnalyzing ? (
              <div className="my-auto text-center flex flex-col items-center gap-4 max-w-sm mx-auto">
                <TrendingUp className="h-8 w-8 text-primary" />
                <h4 className="text-sm font-semibold text-white">Analyze ATS Compatibility</h4>
                <p className="text-xs text-zinc-500">Run structural formatting audits, verify standard header indices, and locate missing keywords.</p>
                <button 
                  onClick={handleATSAnalyze}
                  className="px-6 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold text-white"
                >
                  Analyze Resume
                </button>
              </div>
            ) : isAnalyzing ? (
              <div className="my-auto text-center flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs text-zinc-400">Auditing formatting layout constraints...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Score panel */}
                <div className="rounded-xl p-5 flex flex-col items-center gap-4 paper-texture">
                  <span className="text-[10px] font-bold text-[#1c331d]/60 font-mono uppercase">ATS Compatibility Score</span>
                  <div className="w-24 h-24 rounded-full border-8 border-emerald-800 flex items-center justify-center shadow-lg shadow-emerald-800/10">
                    <span className="text-2xl font-extrabold text-[#1c331d] font-mono">{atsScore}%</span>
                  </div>
                  <span className="text-xs text-emerald-800 font-semibold">Ready for Job Application submissions</span>
                </div>

                {/* Audit and Keywords */}
                <div className="flex flex-col gap-5">
                  <div className="rounded-xl p-4 paper-texture">
                    <span className="text-[10px] font-bold text-[#1c331d]/60 font-mono uppercase block mb-3">Formatting Checklist</span>
                    <div className="flex flex-col gap-2">
                      {formattingAudits.map((aud, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${aud.pass ? 'bg-emerald-800 text-white' : 'bg-red-800 text-white'}`}>
                            {aud.pass ? "✓" : "×"}
                          </div>
                          <span className={aud.pass ? 'text-[#1c331d]/90' : 'text-[#1c331d]/50'}>{aud.item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl p-4 paper-texture">
                    <span className="text-[10px] font-bold text-[#1c331d]/60 font-mono uppercase block mb-3">Missing Critical Keywords</span>
                    <div className="flex flex-wrap gap-1.5">
                      {missingKeywords.map((kw, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded bg-[#1c331d]/5 border border-[#1c331d]/15 text-[10px] text-[#1c331d] font-semibold">{kw}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* JOB MATCHER TAB */}
        {activeTab === "match" && selectedFileId && !errorMsg && (
          <div className="flex-1 flex flex-col">
            {matchScore === null && !isAnalyzing ? (
              <div className="flex flex-col gap-4">
                <span className="text-[10px] font-bold text-zinc-500 font-mono uppercase">Paste Target Job Description</span>
                <textarea 
                  rows={6}
                  placeholder="Paste the full job post requirements, skills, and responsibility criteria..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full text-xs p-3 bg-zinc-950 border border-white/10 rounded-lg outline-none text-white focus:border-primary resize-none font-sans"
                />
                <button 
                  onClick={() => handleJobMatch()}
                  disabled={!jobDescription.trim()}
                  className={`px-6 py-2.5 rounded-full text-xs font-semibold self-end transition-all ${jobDescription.trim() ? 'bg-secondary hover:bg-secondary/80 text-white shadow-md' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'}`}
                >
                  Analyze Job Match
                </button>
              </div>
            ) : isAnalyzing ? (
              <div className="my-auto text-center flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs text-zinc-400">Comparing job skills to resume indices...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="rounded-xl p-5 flex flex-col items-center gap-4 paper-texture">
                  <span className="text-[10px] font-bold text-[#1c331d]/60 font-mono uppercase">Job Description Match Rating</span>
                  <div className="w-24 h-24 rounded-full border-8 border-emerald-800 flex items-center justify-center shadow-lg shadow-emerald-800/10">
                    <span className="text-2xl font-extrabold text-[#1c331d] font-mono">{matchScore}%</span>
                  </div>
                  <span className="text-xs text-emerald-800 font-semibold">Good alignment, some skills missing</span>
                </div>

                <div className="rounded-xl p-4 paper-texture">
                  <span className="text-[10px] font-bold text-[#1c331d]/60 font-mono uppercase block mb-3 font-semibold font-sans">Suggested Missing Skills</span>
                  <div className="flex flex-col gap-2">
                    {missingSkills.map((sk, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-[#1c331d]/90">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-800 shrink-0" />
                        <span>{sk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BULLET REWRITER TAB */}
        {activeTab === "rewrite" && !errorMsg && (
          <div className="flex-1 flex flex-col gap-6 font-sans">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-zinc-500 font-mono uppercase">Draft Bullet Point</span>
              <textarea 
                rows={3}
                placeholder="Example: Maintained databases and fixed server queries."
                value={bulletPoint}
                onChange={(e) => setBulletPoint(e.target.value)}
                className="w-full text-xs p-3 bg-zinc-950 border border-white/10 rounded-lg outline-none text-white focus:border-primary resize-none font-sans"
              />
              <button 
                onClick={() => handleRewriteBullet()}
                disabled={!bulletPoint.trim() || isRewriting}
                className={`px-6 py-2 rounded-full text-xs font-semibold self-end transition-all ${bulletPoint.trim() && !isRewriting ? 'bg-secondary hover:bg-secondary/80 text-white' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'}`}
              >
                {isRewriting ? "Rewriting..." : "Optimize Bullet Point"}
              </button>
            </div>

            {rewrittenBullet && (
              <div className="rounded-xl border border-white/5 bg-zinc-900/10 p-5 flex flex-col gap-3 font-sans">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-500 font-mono uppercase">Polished Output (ATS Optimized)</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(rewrittenBullet)}
                    className="text-[10px] font-semibold text-primary hover:underline"
                  >
                    Copy to Clipboard
                  </button>
                </div>
                <p className="text-xs text-white italic font-sans leading-relaxed">
                  &quot;{rewrittenBullet}&quot;
                </p>
              </div>
            )}
          </div>
        )}

        {/* COVER LETTER TAB */}
        {activeTab === "cover" && !errorMsg && (
          <div className="flex-1 flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-zinc-500 font-mono uppercase">Job Title / Role</span>
                <input 
                  type="text"
                  placeholder="e.g. Senior Frontend Engineer"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  className="text-xs p-2.5 bg-zinc-950 border border-white/10 rounded-lg outline-none text-white focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-zinc-500 font-mono uppercase">Company Name</span>
                <input 
                  type="text"
                  placeholder="e.g. NeuroFlow AI"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="text-xs p-2.5 bg-zinc-950 border border-white/10 rounded-lg outline-none text-white focus:border-primary"
                />
              </div>
            </div>

            <button 
              onClick={handleGenerateCoverLetter}
              disabled={!roleTitle.trim() || !companyName.trim() || isGeneratingCover}
              className={`px-6 py-2.5 rounded-full text-xs font-semibold self-end transition-all ${roleTitle.trim() && companyName.trim() && !isGeneratingCover ? 'bg-secondary hover:bg-secondary/80 text-white' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'}`}
            >
              {isGeneratingCover ? "Generating..." : "Generate Cover Letter"}
            </button>

            {coverLetter && (
              <div className="rounded-xl border border-white/5 bg-zinc-950/80 p-5 flex flex-col gap-3 font-sans leading-relaxed text-zinc-300">
                <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
                  <span className="text-[10px] font-bold text-zinc-500 font-mono uppercase">Generated Letter Template</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(coverLetter)}
                    className="text-[10px] font-semibold text-primary hover:underline"
                  >
                    Copy Text
                  </button>
                </div>
                <pre className="text-xs font-sans whitespace-pre-wrap text-zinc-300 leading-relaxed max-h-[220px] overflow-y-auto">
                  {coverLetter}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* LINKEDIN OPTIMIZER TAB */}
        {activeTab === "linkedin" && selectedFileId && !errorMsg && (
          <div className="flex-1 flex flex-col">
            {linkedinOutput === null && !isOptimizingLinkedin ? (
              <div className="my-auto text-center flex flex-col items-center gap-4 max-w-sm mx-auto">
                <Briefcase className="h-8 w-8 text-primary" />
                <h4 className="text-sm font-semibold text-white">Optimize LinkedIn Profile</h4>
                <p className="text-xs text-zinc-500">Analyze your resume details and draft an attention-grabbing LinkedIn headline and comprehensive &quot;About&quot; description.</p>
                <button 
                  onClick={handleOptimizeLinkedIn}
                  className="px-6 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold text-white"
                >
                  Generate Content
                </button>
              </div>
            ) : isOptimizingLinkedin ? (
              <div className="my-auto text-center flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs text-zinc-400">Analyzing professional qualifications...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="rounded-xl border border-white/5 bg-zinc-950/40 p-4 flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 font-mono uppercase">LinkedIn Professional Headline</span>
                  <p className="text-xs text-white leading-relaxed font-semibold">&quot;{linkedinOutput?.headline}&quot;</p>
                  <button 
                    onClick={() => navigator.clipboard.writeText(linkedinOutput?.headline || "")}
                    className="text-[9px] text-primary font-bold self-end hover:underline"
                  >
                    Copy Headline
                  </button>
                </div>

                <div className="rounded-xl border border-white/5 bg-zinc-950/40 p-4 flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 font-mono uppercase">LinkedIn About Description</span>
                  <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{linkedinOutput?.about}</p>
                  <button 
                    onClick={() => navigator.clipboard.writeText(linkedinOutput?.about || "")}
                    className="text-[9px] text-primary font-bold self-end hover:underline"
                  >
                    Copy About Summary
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* INTERVIEW PREPARATION TAB */}
        {activeTab === "interview" && selectedFileId && !errorMsg && (
          <div className="flex-1 flex flex-col">
            {interviewQuestions.length === 0 && !isAnalyzing ? (
              <div className="my-auto text-center flex flex-col items-center gap-4 max-w-sm mx-auto">
                <Brain className="h-8 w-8 text-primary" />
                <h4 className="text-sm font-semibold text-white">Generate Interview Prep Questions</h4>
                <p className="text-xs text-zinc-500">We analyze your resume details and draft technical questions, behavioral STAR prompts, and HR responses.</p>
                <button 
                  onClick={handleGenerateInterviewPrep}
                  className="px-6 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold text-white"
                >
                  Generate Q&A Cards
                </button>
              </div>
            ) : isAnalyzing ? (
              <div className="my-auto text-center flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs text-zinc-400">Synthesizing personalized Q&A cards...</span>
              </div>
            ) : (
              <div className="max-w-md mx-auto w-full flex flex-col gap-4">
                {activeQuestionIdx !== null && interviewQuestions[activeQuestionIdx] && (
                  <div className="rounded-2xl border border-white/5 bg-zinc-900/10 p-6 flex flex-col gap-4 relative min-h-[180px]">
                    <span className="text-[9px] font-bold text-primary font-mono uppercase tracking-widest">
                      {interviewQuestions[activeQuestionIdx].cat} Question
                    </span>
                    <h4 className="text-xs font-bold text-white leading-relaxed">
                      {interviewQuestions[activeQuestionIdx].q}
                    </h4>

                    {showAnswer ? (
                      <p className="text-xs text-zinc-400 leading-relaxed pt-2 border-t border-white/5">
                        {interviewQuestions[activeQuestionIdx].a}
                      </p>
                    ) : (
                      <button 
                        onClick={() => setShowAnswer(true)}
                        className="mt-4 px-4 py-1.5 rounded-lg border border-white/10 hover:border-white/20 text-[10px] font-semibold text-zinc-400 hover:text-white bg-zinc-950/40"
                      >
                        Reveal Model Answer
                      </button>
                    )}
                  </div>
                )}

                {/* Navigation controls */}
                <div className="flex justify-between items-center px-2">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Question {activeQuestionIdx! + 1} of {interviewQuestions.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={activeQuestionIdx === 0}
                      onClick={() => {
                        setActiveQuestionIdx(prev => prev! - 1);
                        setShowAnswer(false);
                      }}
                      className="px-3 py-1 rounded bg-zinc-900 border border-white/5 text-[10px] font-semibold hover:bg-zinc-800 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      disabled={activeQuestionIdx === interviewQuestions.length - 1}
                      onClick={() => {
                        setActiveQuestionIdx(prev => prev! + 1);
                        setShowAnswer(false);
                      }}
                      className="px-3 py-1 rounded bg-secondary text-[10px] font-semibold hover:bg-secondary/80 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
