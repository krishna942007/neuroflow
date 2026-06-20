"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  Layout, 
  Sparkles, 
  Code, 
  Eye, 
  Download, 
  Check, 
  ArrowRight, 
  RefreshCw,
  Copy,
  AlertCircle,
  Folder,
  FileCode,
  Plus,
  Trash2,
  Send,
  Bot,
  MessageSquare,
  Play,
  FileArchive,
  FileDown,
  Palette
} from "lucide-react";
import { useWorkspaceStore } from "@/lib/store/workspaceStore";
import { useAuthStore } from "@/lib/store/authStore";
import { useUIStore } from "@/lib/store/uiStore";
import { requestAIJson, requestAIStream, AIGenerationError } from "@/lib/ai/client";
import type { ProgressCallback } from "@/lib/ai/client";
import type { WorkspaceFile } from "@/lib/store/workspaceStore";

// Helper to resolve relative path references inside files to match importMap bare specifiers
function resolveRelativePath(sourceFile: string, importPath: string): string {
  let cleanImportPath = importPath;
  if (cleanImportPath.startsWith("/")) {
    cleanImportPath = cleanImportPath.substring(1);
  }
  if (!cleanImportPath.startsWith("./") && !cleanImportPath.startsWith("../") && cleanImportPath !== "." && cleanImportPath !== "..") {
    return cleanImportPath;
  }
  
  const sourceParts = sourceFile.split("/");
  sourceParts.pop(); // Remove the filename to get the directory
  
  const importParts = cleanImportPath.split("/");
  for (const part of importParts) {
    if (part === "." || part === "") {
      // Do nothing
    } else if (part === "..") {
      sourceParts.pop();
    } else {
      sourceParts.push(part);
    }
  }
  
  return sourceParts.join("/");
}

function rewriteImports(filename: string, content: string): string {
  // Replace: import ... from './relative' or export ... from './relative'
  let updated = content.replace(
    /(import|export)\s+([\s\S]*?\s+from\s+['"])([^'"]+)(['"])/g,
    (match, p1, p2, specifier, p4) => {
      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        const resolved = resolveRelativePath(filename, specifier);
        return `${p1} ${p2}${resolved}${p4}`;
      }
      return match;
    }
  );

  // Replace: import './relative'
  updated = updated.replace(
    /import\s+['"]([^'"]+)['"]/g,
    (match, specifier) => {
      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        const resolved = resolveRelativePath(filename, specifier);
        return `import "${resolved}"`;
      }
      return match;
    }
  );

  // Replace: import('./relative') or import("./relative")
  updated = updated.replace(
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    (match, specifier) => {
      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        const resolved = resolveRelativePath(filename, specifier);
        return `import("${resolved}")`;
      }
      return match;
    }
  );

  return updated;
}

// Sanitizer to convert standard HTML class and SVG dash-case attributes to React camelCase attributes
function sanitizeJsxProps(content: string): string {
  return content.replace(/<([a-zA-Z0-9_.:-]+)([\s\S]*?)(\/?>)/g, (match, tagName, attrs, closing) => {
    if (match.startsWith("</") || !attrs.trim()) {
      return match;
    }
    
    let sanitizedAttrs = attrs;
    
    // Replace class="..." with className="..."
    sanitizedAttrs = sanitizedAttrs.replace(/\bclass\s*=\s*(["'{])/g, 'className=$1');
    
    // Replace SVG linecap, linejoin, width, etc.
    sanitizedAttrs = sanitizedAttrs.replace(/\bstroke-linecap\s*=/g, 'strokeLinecap=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bstroke-linejoin\s*=/g, 'strokeLinejoin=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bstroke-width\s*=/g, 'strokeWidth=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bstroke-dasharray\s*=/g, 'strokeDasharray=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bstroke-dashoffset\s*=/g, 'strokeDashoffset=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bstroke-opacity\s*=/g, 'strokeOpacity=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bfill-opacity\s*=/g, 'fillOpacity=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bfill-rule\s*=/g, 'fillRule=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bclip-rule\s*=/g, 'clipRule=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bfont-size\s*=/g, 'fontSize=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bfont-weight\s*=/g, 'fontWeight=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bfont-family\s*=/g, 'fontFamily=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bletter-spacing\s*=/g, 'letterSpacing=');
    sanitizedAttrs = sanitizedAttrs.replace(/\btext-anchor\s*=/g, 'textAnchor=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bstop-color\s*=/g, 'stopColor=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bstop-opacity\s*=/g, 'stopOpacity=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bxmlns:xlink\s*=/g, 'xmlnsXlink=');
    sanitizedAttrs = sanitizedAttrs.replace(/\bxml:space\s*=/g, 'xmlSpace=');

    return `<${tagName}${sanitizedAttrs}${closing}`;
  });
}

// Utility function to bundle CSS & JS into index.html for live sandbox preview execution
// Helper to transpile React JSX / TypeScript using Babel Standalone
function transpileFile(filename: string, content: string, onCompileError: (err: string | null) => void): string {
  const contentWithRewrittenImports = rewriteImports(filename, content);
  
  if (filename.endsWith(".jsx") || filename.endsWith(".tsx") || filename.endsWith(".ts")) {
    const sanitizedContent = sanitizeJsxProps(contentWithRewrittenImports);
    if (typeof window !== "undefined" && (window as any).Babel) {
      try {
        const presets = ["react"];
        if (filename.endsWith(".ts") || filename.endsWith(".tsx")) {
          presets.push("typescript");
        }
        const transpiled = (window as any).Babel.transform(sanitizedContent, {
          presets,
          filename
        }).code;
        return transpiled.replace(/^\s*import\s+["'][^"']+\.css["'];?\s*$/gm, "");
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Babel compilation error in ${filename}:`, err);
        onCompileError(`Babel compilation error in ${filename}:\n${errMsg}`);
        return `throw new Error(${JSON.stringify(`Transpile error in ${filename}: ` + errMsg)});`;
      }
    } else {
      console.warn("Babel Standalone not loaded yet. Skipping compilation.");
      return sanitizedContent.replace(/^\s*import\s+["'][^"']+\.css["'];?\s*$/gm, "");
    }
  }
  return contentWithRewrittenImports.replace(/^\s*import\s+["'][^"']+\.css["'];?\s*$/gm, "");
}

const getProgressPercent = (step: string): number => {
  if (!step) return 0;
  const s = step.toLowerCase();
  if (s.includes("initializing ai design pipeline")) return 5;
  if (s.includes("initializing google stitch")) return 10;
  if (s.includes("stitch design project") || s.includes("new stitch design project")) return 20;
  if (s.includes("connecting to existing")) return 25;
  if (s.includes("original screen layout")) return 35;
  if (s.includes("generating ui components") || s.includes("generating...")) return 55;
  if (s.includes("applying modifications")) return 65;
  if (s.includes("retrieving layout code") || s.includes("retrieving updated layout")) return 75;
  if (s.includes("stitch api failed")) return 30;
  if (s.includes("analyzing prompt")) return 35;
  if (s.includes("generating with")) return 45;
  if (s.includes("building component architecture")) return 65;
  if (s.includes("parsing and validating")) return 85;
  if (s.includes("compiling html") || s.includes("refreshing sandbox") || s.includes("finalizing")) return 95;
  return 0;
};

export default function WebsiteModule() {
  const { addFileToWorkspace, files: workspaceFiles } = useWorkspaceStore();
  const { addActivityLog, checkAndIncrementUsage, user } = useAuthStore();
  const setLimitWarning = useUIStore((s) => s.setLimitWarning);

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [activeFileName, setActiveFileName] = useState("index.html");
  const [currentPreviewFile, setCurrentPreviewFile] = useState("index.html");
  const [previewMode, setPreviewMode] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

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

  // Babel compilation and error states
  const [babelReady, setBabelReady] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [jsZipReady, setJsZipReady] = useState(false);
  const [prismReady, setPrismReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Active blob URLs tracking
  const activeBlobsRef = useRef<string[]>([]);
  const chatLogsRef = useRef<HTMLDivElement>(null);

  const websiteProjects = workspaceFiles.filter(f => f.type === "website");

  const loadProject = (file: WorkspaceFile) => {
    if (!file.content) return;
    try {
      if (file.content.trim().startsWith("{")) {
        const parsed = JSON.parse(file.content);
        if (parsed && typeof parsed === "object" && parsed.files) {
          setFiles(parsed.files);
          const fileNames = Object.keys(parsed.files);
          const defaultEntry = fileNames.includes("index.html") ? "index.html" : fileNames[0];
          setActiveFileName(defaultEntry);
          setCurrentPreviewFile(defaultEntry.endsWith(".html") ? defaultEntry : "index.html");
          setChatHistory([
            { sender: "assistant", text: `Loaded multi-file website project "${file.name}". You can preview it or continue editing!` }
          ]);
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to parse website project as JSON, loading as fallback single HTML file:", e);
    }

    const parsedFiles = { "index.html": file.content };
    setFiles(parsedFiles);
    setActiveFileName("index.html");
    setCurrentPreviewFile("index.html");
    setChatHistory([
      { sender: "assistant", text: `Loaded website project "${file.name}". You can preview it or continue editing!` }
    ]);
  };

  // Load Babel Standalone dynamically
  useEffect(() => {
    if (typeof window !== "undefined") {
      if ((window as any).Babel) {
        try {
          (window as any).Babel.disableScriptTags();
        } catch (e) {}
        setBabelReady(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@babel/standalone@7.26.4/babel.min.js";
      script.async = true;
      script.onload = () => {
        if ((window as any).Babel) {
          try {
            (window as any).Babel.disableScriptTags();
          } catch (e) {}
        }
        setBabelReady(true);
      };
      script.onerror = () => {
        console.error("Failed to load Babel Standalone CDN. React JSX compiling may fail.");
      };
      document.head.appendChild(script);
    }
  }, []);

  // Load JSZip for ZIP export
  useEffect(() => {
    if (typeof window !== "undefined") {
      if ((window as any).JSZip) {
        setJsZipReady(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.async = true;
      script.onload = () => setJsZipReady(true);
      document.head.appendChild(script);
    }
  }, []);

  // Load Prism.js for syntax highlighting
  useEffect(() => {
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
      script.onload = async () => {
        // Load language extensions sequentially to respect dependency order
        const langs = ["markup", "css", "javascript", "jsx", "typescript", "tsx"];
        for (const lang of langs) {
          await new Promise<void>((resolve) => {
            const langScript = document.createElement("script");
            langScript.src = `https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-${lang}.min.js`;
            langScript.async = true;
            langScript.onload = () => resolve();
            langScript.onerror = () => resolve();
            document.head.appendChild(langScript);
          });
        }
        setPrismReady(true);
      };
      document.head.appendChild(script);
    }
  }, []);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      activeBlobsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Handle iframe sandbox subpage navigation messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "SANDBOX_NAVIGATE") {
        const targetHref = event.data.href;
        let cleanHref = targetHref;
        if (cleanHref.startsWith("./")) {
          cleanHref = cleanHref.substring(2);
        } else if (cleanHref.startsWith("/")) {
          cleanHref = cleanHref.substring(1);
        }
        
        // Strip query strings or hashes to find the file key
        const qIdx = cleanHref.indexOf('?');
        if (qIdx !== -1) cleanHref = cleanHref.substring(0, qIdx);
        const hIdx = cleanHref.indexOf('#');
        if (hIdx !== -1) cleanHref = cleanHref.substring(0, hIdx);
        
        if (!cleanHref) return;

        if (files && files[cleanHref] !== undefined) {
          setActiveFileName(cleanHref);
          if (cleanHref.endsWith(".html")) {
            setCurrentPreviewFile(cleanHref);
          }
          setChatHistory(prev => [
            ...prev,
            { sender: "assistant", text: `Subpage Loaded: Previewing page "${cleanHref}"` }
          ]);
        } else {
          alert(`Link points to "${targetHref}", but "${cleanHref}" does not exist in this project sandbox. You can ask Assistant Newton to create it!`);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [files]);

  // Live compiler/bundler using native Import Maps and Blobs
  const bundleWebProject = (projectFiles: Record<string, string>, entryFile: string = "index.html"): string => {
    // Revoke old blob URLs to prevent memory leaks
    activeBlobsRef.current.forEach(url => URL.revokeObjectURL(url));
    activeBlobsRef.current = [];

    // Client-side safety: fix double-escaped file content from AI models
    const fixedFiles: Record<string, string> = {};
    for (const [name, content] of Object.entries(projectFiles)) {
      if (typeof content !== 'string') { fixedFiles[name] = content; continue; }
      const realNewlinesCount = (content.match(/\n/g) || []).length;
      const literalEscapesCount = (content.match(/\\n/g) || []).length;
      const hasLiteralQuotes = content.includes('\\"');
      
      if (literalEscapesCount > 0 && (realNewlinesCount < 3 || literalEscapesCount > realNewlinesCount) || hasLiteralQuotes) {
        fixedFiles[name] = content
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'")
          .replace(/\\\\/g, '\\');
      } else {
        fixedFiles[name] = content;
      }
    }
    projectFiles = fixedFiles;

    let hasError = false;
    let errorDetails: string | null = null;

    const onCompileError = (err: string | null) => {
      if (err) {
        hasError = true;
        errorDetails = err;
      }
    };

    // Keep every preview dependency on the exact same React module instance.
    // esm.sh otherwise may bundle a package's own production React copy, which
    // makes hooks fail when ReactDOM renders components from that package.
    const reactExternals = "external=react,react-dom,react/jsx-runtime,react/jsx-dev-runtime";
    const importMap: Record<string, string> = {
      "react": "https://esm.sh/react@18.3.1?dev",
      "react-dom": "https://esm.sh/react-dom@18.3.1?dev&external=react",
      "react-dom/client": "https://esm.sh/react-dom@18.3.1/client?dev&external=react",
      "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime?dev",
      "react/jsx-dev-runtime": "https://esm.sh/react@18.3.1/jsx-runtime?dev",
      "lucide-react": `https://esm.sh/lucide-react@0.344.0?dev&${reactExternals}`,
      "framer-motion": `https://esm.sh/framer-motion@11.1.7?dev&${reactExternals}`,
      "gsap": "https://esm.sh/gsap@3.12.5?external=react"
    };
    const localModuleNames = new Set<string>();
    Object.keys(projectFiles).forEach((name) => {
      if (
        name.endsWith(".js") ||
        name.endsWith(".jsx") ||
        name.endsWith(".ts") ||
        name.endsWith(".tsx")
      ) {
        localModuleNames.add(name);
        const lastDot = name.lastIndexOf(".");
        if (lastDot > 0) {
          localModuleNames.add(name.substring(0, lastDot));
        }
      }
    });

    // Scan all project files for third-party imports and map them to esm.sh
    Object.entries(projectFiles).forEach(([name, content]) => {
      if (
        name.endsWith(".js") ||
        name.endsWith(".jsx") ||
        name.endsWith(".ts") ||
        name.endsWith(".tsx")
      ) {
        const importRegex = /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          const specifier = match[1];
          // Skip: relative imports, already-mapped, local files, and full URLs
          if (
            specifier.startsWith(".") ||
            specifier.startsWith("/") ||
            specifier.startsWith("http://") ||
            specifier.startsWith("https://") ||
            specifier.startsWith("//") ||
            importMap[specifier] ||
            localModuleNames.has(specifier)
          ) {
            continue;
          }
          importMap[specifier] = `https://esm.sh/${specifier}?dev&${reactExternals}`;
        }
      }
    });

    // Create dummy blob URLs for missing relative imports to prevent 404 HTML syntax errors
    const emptyJsBlob = new Blob(["export default function Dummy() { return null; };"], { type: "text/javascript" });
    const emptyJsUrl = URL.createObjectURL(emptyJsBlob);
    activeBlobsRef.current.push(emptyJsUrl);

    const emptyCssBlob = new Blob(["/* Empty CSS placeholder */"], { type: "text/javascript" });
    const emptyCssUrl = URL.createObjectURL(emptyCssBlob);
    activeBlobsRef.current.push(emptyCssUrl);

    const dummyAssetBlob = new Blob(["export default '';"], { type: "text/javascript" });
    const dummyAssetUrl = URL.createObjectURL(dummyAssetBlob);
    activeBlobsRef.current.push(dummyAssetUrl);

    const fileExists = (path: string): boolean => {
      if (projectFiles[path] !== undefined) return true;
      const extensions = [".jsx", ".js", ".tsx", ".ts", "/index.js", "/index.jsx", "/index.tsx"];
      for (const ext of extensions) {
        if (projectFiles[path + ext] !== undefined) return true;
      }
      return false;
    };

    // Scan all project files for relative imports and map missing ones
    Object.entries(projectFiles).forEach(([filename, content]) => {
      if (
        filename.endsWith(".js") ||
        filename.endsWith(".jsx") ||
        filename.endsWith(".ts") ||
        filename.endsWith(".tsx")
      ) {
        const importRegex = /(?:import|export)\s+([\s\S]*?\s+from\s+['"]|['"])([^'"]+)(['"])/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          const specifier = match[2];
          if (specifier.startsWith(".") || specifier.startsWith("/")) {
            const resolved = resolveRelativePath(filename, specifier);
            if (!fileExists(resolved)) {
              let dummyUrl = emptyJsUrl;
              if (resolved.endsWith(".css")) {
                dummyUrl = emptyCssUrl;
              } else if (/\.(svg|png|jpg|jpeg|gif|webp|ico|bmp)$/i.test(resolved)) {
                dummyUrl = dummyAssetUrl;
              }
              
              importMap[resolved] = dummyUrl;
              importMap[specifier] = dummyUrl;
              if (!specifier.startsWith("./") && !specifier.startsWith("/")) {
                importMap[`./${specifier}`] = dummyUrl;
              }
            }
          }
        }
      }
    });

    const cssContents: Record<string, string> = {};

    // 1. Collect CSS file contents for inline injection (link tags don't resolve in srcDoc iframes)
    Object.entries(projectFiles).forEach(([name, content]) => {
      if (name.endsWith(".css")) {
        cssContents[name] = content;
      }
    });

    // 2. Process JS/JSX/TS/TSX files and create transpiled Blob URLs
    Object.entries(projectFiles).forEach(([name, content]) => {
      if (
        name.endsWith(".js") ||
        name.endsWith(".jsx") ||
        name.endsWith(".ts") ||
        name.endsWith(".tsx")
      ) {
        const transpiled = transpileFile(name, content, onCompileError);
        const blob = new Blob([transpiled], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        activeBlobsRef.current.push(url);
        importMap[`./${name}`] = url;
        importMap[name] = url;

        // Map extensionless version for import convenience (e.g. import App from './App')
        const lastDot = name.lastIndexOf(".");
        if (lastDot > 0) {
          const withoutExt = name.substring(0, lastDot);
          importMap[`./${withoutExt}`] = url;
          importMap[withoutExt] = url;
        }
      }
    });

    // Resolve entrypoint mapping to unified './App.jsx' in the import map
    const entrypoints = ["App.jsx", "App.js", "App.tsx", "app.js", "app.jsx", "app.tsx"];
    let detectedEntry = entrypoints.find(entry => projectFiles[entry] !== undefined);
    
    if (!detectedEntry) {
      detectedEntry = Object.keys(projectFiles).find(name => 
        (name.endsWith(".jsx") || name.endsWith(".tsx")) && !name.includes("/")
      );
      if (!detectedEntry) {
        detectedEntry = Object.keys(projectFiles).find(name => 
          (name.endsWith(".jsx") || name.endsWith(".tsx"))
        );
      }
      if (!detectedEntry) {
        detectedEntry = Object.keys(projectFiles).find(name => 
          (name.endsWith(".js") || name.endsWith(".ts")) && !name.includes("/")
        );
      }
      if (!detectedEntry) {
        detectedEntry = Object.keys(projectFiles).find(name => 
          (name.endsWith(".js") || name.endsWith(".ts"))
        );
      }
    }
    
    if (detectedEntry) {
      const entryUrl = importMap[`./${detectedEntry}`];
      if (entryUrl) {
        importMap["./App.jsx"] = entryUrl;
        importMap["App.jsx"] = entryUrl;
        importMap["./App"] = entryUrl;
        importMap["App"] = entryUrl;
        importMap["./app"] = entryUrl;
        importMap["app"] = entryUrl;
      }
    }

    // Update compilation error state
    if (hasError && errorDetails) {
      if (compileError !== errorDetails) {
        setTimeout(() => setCompileError(errorDetails), 0);
      }
    } else {
      if (compileError !== null) {
        setTimeout(() => setCompileError(null), 0);
      }
    }

    // 3. Resolve entrypoint HTML structure
    let html = projectFiles[entryFile] || projectFiles["index.html"] || "";
    
    if (!html.trim()) {
      html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview Sandbox</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#E5DDD0] text-[#2A3226]">
  <div id="root"></div>
  <script type="module">
    import React from 'react';
    import ReactDOM from 'react-dom/client';
    let App = null;
    try {
      const mod = await import('./App.jsx');
      App = mod.default || mod.App || mod;
    } catch (e) {
      try {
        const mod = await import('./App.js');
        App = mod.default || mod.App || mod;
      } catch (e2) {
        try {
          const mod = await import('./app.js');
          App = mod.default || mod.App || mod;
        } catch (e3) {
          console.error("Could not find App entrypoint component. Ensure App.jsx, App.js, or app.js exists.");
        }
      }
    }
    if (App) {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App));
    } else {
      document.getElementById('root').innerHTML = '<div class="p-8 text-center text-red-500 font-sans"><h1 class="text-xl font-bold">Entrypoint App Not Found</h1><p class="text-sm mt-2">Create an App.jsx or App.js component to run your React app.</p></div>';
    }
  </script>
</body>
</html>`;
    }

    // Import map MUST be the very first <script> in <head> — before any <script type="module">
    // Otherwise module scripts execute before the import map is registered, causing resolution failures
    const importMapScript = `<script type="importmap">\n${JSON.stringify({ imports: importMap }, null, 2)}\n</script>`;
    
    let cssInjections = "";
    Object.entries(cssContents).forEach(([cssName, cssCode]) => {
      cssInjections += `<style data-file="${cssName}">\n${cssCode}\n</style>\n`;
    });

    // Relative links inside srcDoc resolve against the parent route and cause 404s.
    html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
      const hrefMatch = tag.match(/\shref=["']([^"']+)["']/i);
      if (!hrefMatch) return tag;
      const href = hrefMatch[1];
      const isRelativeHref = !href.startsWith("#") && !/^[a-z][a-z\d+.-]*:/i.test(href);
      return isRelativeHref ? "" : tag;
    });

    // Rewrite relative imports in script tags in index.html to be bare specifiers
    html = html.replace(/import\s+['"]([^'"]+)['"]/g, (match, specifier) => {
      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        const resolved = resolveRelativePath("index.html", specifier);
        return `import "${resolved}"`;
      }
      return match;
    });
    html = html.replace(/import\(\s*['"]([^'"]+)['"]\s*\)/g, (match, specifier) => {
      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        const resolved = resolveRelativePath("index.html", specifier);
        return `import("${resolved}")`;
      }
      return match;
    });

    // Rewrite relative script src tags or transpile inline JSX/Babel script tags
    html = html.replace(/<script\b([\s\S]*?)>([\s\S]*?)<\/script>/gi, (match, attrs, content) => {
      const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
      if (srcMatch) {
        const src = srcMatch[1];
        // Generated HTML sometimes includes React UMD scripts. Mixing that
        // global runtime with ESM components (such as Framer Motion) creates a
        // second hook dispatcher and crashes with `useContext` of null.
        if (/^https?:\/\/.*\/(?:react|react-dom)(?:\.(?:production|development))?(?:\.min)?\.js(?:[?#]|$)/i.test(src)) {
          return "";
        }
        const isRelative = !src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("//") && !/^[a-z][a-z\d+.-]*:/i.test(src);
        if (isRelative) {
          const resolved = resolveRelativePath("index.html", src);
          return `<script type="module">import "${resolved}";</script>`;
        }
        return match;
      }

      // Inline script: Check if it requires Babel transpilation (matches text/babel or text/jsx with single/double/no quotes)
      const isBabelType = /type\s*=\s*["']?(text\/babel|text\/jsx)["']?/i.test(attrs);
      const hasJsxContent = content.includes('React.') || content.includes('<App') || /<\w+\s+[^>]*\/>/g.test(content) || /<\w+[^>]*>[\s\S]*?<\/\w+>/g.test(content);
      const isBabel = isBabelType || hasJsxContent;

      if (isBabel) {
        if ((window as any).Babel) {
          try {
            const transpiled = (window as any).Babel.transform(content, {
              presets: ["react"],
              filename: "inline.jsx"
            }).code;
            const reactImport = /(?:import|export)[\s\S]*?from\s+["']react["']/.test(content)
              ? ""
              : "import * as React from 'react';\n";
            const reactDomImport = /(?:import|export)[\s\S]*?from\s+["']react-dom(?:\/client)?["']/.test(content)
              ? ""
              : "import * as ReactDOM from 'react-dom/client';\n";
            return `<script type="module">\n${reactImport}${reactDomImport}${transpiled}\n</script>`;
          } catch (err) {
            console.error("Failed to transpile inline script inside iframe:", err);
            return `<script type="module">console.error("Inline script compilation failed: " + ${JSON.stringify(String(err))});</script>`;
          }
        } else {
          // If Babel standalone is not loaded yet in parent window, strip the text/babel type to prevent double compilation inside iframe
          const cleanAttrs = attrs.replace(/type\s*=\s*["']?(text\/babel|text\/jsx)["']?/i, 'type="module"');
          return `<script ${cleanAttrs}>\n${content}\n</script>`;
        }
      }
      return match;
    });

    // Remove incorrect link tag imports of cdn.tailwindcss.com if the AI generated them
    html = html.replace(/<link\b[^>]*href=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*>/gi, "");

    // Also inject Tailwind CDN if not already present as a script tag
    const tailwindTag = `<script src="https://cdn.tailwindcss.com"></script>`;
    const hasTailwind = /<script\b[^>]*src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*>/i.test(html);

    // CRITICAL: importMap must come FIRST, then Tailwind, then CSS
    const headInjections = `\n${importMapScript}\n${!hasTailwind ? tailwindTag + '\n' : ''}${cssInjections}`;

    // Strip any existing import maps the AI may have generated (they conflict with ours)
    html = html.replace(/<script\s+type=["']importmap["'][^>]*>[\s\S]*?<\/script>/gi, "");

    if (html.includes("</head>")) {
      // Insert right after <head> opening tag — BEFORE any module scripts
      html = html.replace(/<head([^>]*)>/i, `<head$1>${headInjections}`);
    } else if (html.includes("<head")) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>${headInjections}`);
    } else {
      html = `<head>${headInjections}</head>\n` + html;
    }

    // Auto-mount React App if no mounting/rendering script exists in the HTML
    const hasRenderCode = /ReactDOM\s*\.\s*(createRoot|render)|render\s*\(/i.test(html);
    if (!hasRenderCode) {
      const autoMountScript = `
<script type="module">
  import React from 'react';
  import ReactDOM from 'react-dom/client';
  
  const rootEl = document.getElementById('root');
  if (rootEl && !rootEl.innerHTML.trim()) {
    try {
      let App = null;
      try {
        const mod = await import('./App.jsx');
        App = mod.default || mod.App || mod;
      } catch (e) {
        console.error("Import entrypoint failed:", e);
        throw new Error("Failed to load React entrypoint: " + (e.message || e));
      }
      if (App) {
        const root = ReactDOM.createRoot(rootEl);
        root.render(React.createElement(App));
      } else {
        throw new Error("React entrypoint has no default export or 'App' export.");
      }
    } catch (err) {
      console.error("Auto-mount failed:", err);
      // Show error visually in the preview instead of a black box
      rootEl.innerHTML = '<div style="padding:2rem;font-family:system-ui;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin:1rem;"><h2 style="margin:0 0 0.5rem">⚠️ Render Error</h2><pre style="font-size:12px;white-space:pre-wrap;color:#991b1b">' + (err.message || err) + '</pre></div>';
    }
  }
</script>
`;
      if (html.includes("</body>")) {
        html = html.replace("</body>", `${autoMountScript}</body>`);
      } else {
        html = html + autoMountScript;
      }
    }

    // Intercept clicks on links inside the iframe to prevent layout/nesting bugs
    const navScript = `
<script>
  (function() {
    document.addEventListener('click', function(e) {
      var target = e.target;
      while (target && target.tagName !== 'A') {
        target = target.parentNode;
      }
      if (target && target.tagName === 'A') {
        var href = target.getAttribute('href');
        if (href) {
          if (href.startsWith('#')) {
            e.preventDefault();
            var id = href.substring(1);
            var el = id ? document.getElementById(id) : null;
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
            } else if (!id) {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
          }
          var isAbsolute = href.indexOf('://') !== -1 || href.startsWith('//') || href.startsWith('data:') || href.startsWith('javascript:');
          if (!isAbsolute) {
            e.preventDefault();
            window.parent.postMessage({
              type: 'SANDBOX_NAVIGATE',
              href: href
            }, '*');
          }
        }
      }
    }, true);
  })();
</script>
`;

    if (html.includes("</body>")) {
      html = html.replace("</body>", `${navScript}</body>`);
    } else {
      html = html + navScript;
    }

    return html;
  };

  // AI assistant side chat panel states
  const [chatInput, setChatInput] = useState("");
  const [isApplyingEdit, setIsApplyingEdit] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ sender: "user" | "assistant"; text: string }>>([
    { sender: "assistant", text: "Welcome to the interactive Website Designer! I've loaded your sandbox files. Give me instructions to edit the structure, add animations, styles, or insert new elements." }
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatLogsRef.current) {
      chatLogsRef.current.scrollTop = chatLogsRef.current.scrollHeight;
    }
  }, [chatHistory, isApplyingEdit]);

  // Initial code generation with streaming progress
  const handleGenerate = async (overridePrompt?: string) => {
    const activePrompt = overridePrompt !== undefined ? overridePrompt : prompt;
    if (!activePrompt.trim() || isGenerating) return;

    const limitCheck = checkAndIncrementUsage("web");
    if (!limitCheck.allowed) {
      setLimitWarning({
        type: "web",
        limit: limitCheck.limit,
        plan: user?.plan || "free"
      });
      return;
    }

    setIsGenerating(true);
    setFiles(null);
    setErrorMsg(null);
    setGenerationStep("Initializing AI design pipeline...");
    addActivityLog("Started AI Website design", `Prompt: "${activePrompt.substring(0, 30)}..."`);

    const onProgress: ProgressCallback = (step) => {
      setGenerationStep(step);
    };

    try {
      const result = await requestAIStream<{ files: Record<string, string> }>("website", { prompt: activePrompt }, onProgress);
      if (result.files && Object.keys(result.files).length > 0) {
        setFiles(result.files);
        const fileNames = Object.keys(result.files);
        const defaultEntry = fileNames.includes("index.html") ? "index.html" : fileNames[0];
        setActiveFileName(defaultEntry);
        setCurrentPreviewFile(defaultEntry.endsWith(".html") ? defaultEntry : "index.html");
        setChatHistory([
          { sender: "assistant", text: `I have successfully designed a premium website for: "${activePrompt}". Use the file explorer on the left, the code editor/preview in the center, and instruct me in chat here to make updates!` }
        ]);
        setIsGenerating(false);
        return;
      }
      throw new AIGenerationError("AI returned empty template files. Try a more descriptive prompt.", "EMPTY_RESPONSE", true);
    } catch (error) {
      console.error("Website API failed:", error);
      let userMsg: string;
      if (error instanceof AIGenerationError) {
        userMsg = error.message;
        if (error.code === "TIMEOUT") {
          userMsg = "Design timed out. Try a simpler prompt like 'Design a minimal portfolio page'.";
        } else if (error.code === "AUTH_FAILED") {
          userMsg = "API key is invalid or expired. Go to Settings and update your provider keys.";
        } else if (error.code === "RATE_LIMIT") {
          userMsg = "Rate limit hit. Wait 30 seconds and try again, or switch to a different AI provider.";
        } else if (error.code === "NO_PROVIDER") {
          userMsg = "No AI provider configured. Add an API key (OpenAI, Gemini, or Groq) in your environment.";
        }
      } else {
        userMsg = error instanceof Error ? error.message : "Website design failed. Check your API keys and try again.";
      }
      setErrorMsg(userMsg);
      setIsGenerating(false);
    }
  };

  // Listen to floating Newton companion triggers
  React.useEffect(() => {
    const handleSherlockAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ type: string; target: string; value: string }>;
      if (customEvent.detail.target === "website_prompt") {
        setPrompt(customEvent.detail.value);
        if (customEvent.detail.type === "generate") {
          handleGenerate(customEvent.detail.value);
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

  // Modify website files iteratively using sidechat instructions
  const handleApplyEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isApplyingEdit || !files) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setChatHistory(prev => [...prev, { sender: "user", text: userMsg }]);
    setIsApplyingEdit(true);

    try {
      const fullPrompt = compileError 
        ? `${userMsg}\n\n[System Alert: The preview sandbox currently has a compilation error. Please fix this error in the code:\n${compileError}]` 
        : userMsg;

      const result = await requestAIJson<{ files: Record<string, string> }>("website_edit", {
        currentFiles: files,
        prompt: fullPrompt
      }, (step) => {
        // Update last assistant message with progress
        setChatHistory(prev => {
          const last = prev[prev.length - 1];
          if (last?.sender === "assistant" && last.text.startsWith("⏳")) {
            return [...prev.slice(0, -1), { sender: "assistant" as const, text: `⏳ ${step}` }];
          }
          return [...prev, { sender: "assistant" as const, text: `⏳ ${step}` }];
        });
      });

      if (result.files && Object.keys(result.files).length > 0) {
        setFiles(prev => {
          if (!prev) return result.files;
          return { ...prev, ...result.files };
        });
        // Remove progress message and add success
        setChatHistory(prev => {
          const filtered = prev.filter(m => !(m.sender === "assistant" && m.text.startsWith("⏳")));
          return [...filtered, { 
            sender: "assistant", 
            text: `✅ Applied update successfully! Changes have been compiled and the preview is refreshed.` 
          }];
        });
      } else {
        throw new Error("AI returned empty file list on edit");
      }
    } catch (error) {
      console.error("Website edit failed:", error);
      const errMsg = error instanceof AIGenerationError
        ? error.message
        : (error instanceof Error ? error.message : "Network error. Check your connection.");
      setChatHistory(prev => {
        const filtered = prev.filter(m => !(m.sender === "assistant" && m.text.startsWith("⏳")));
        return [...filtered, { 
          sender: "assistant", 
          text: `❌ Edit failed: ${errMsg}` 
        }];
      });
    } finally {
      setIsApplyingEdit(false);
    }
  };

  // Add new file manually
  const handleCreateFile = () => {
    const name = promptUser("Enter filename (e.g. contact.html, components.js):");
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    if (files && files[cleanName] !== undefined) {
      alert("File already exists!");
      return;
    }
    setFiles(prev => prev ? { ...prev, [cleanName]: "" } : null);
    setActiveFileName(cleanName);
    if (cleanName.endsWith(".html")) {
      setCurrentPreviewFile(cleanName);
    }
  };

  const promptUser = (message: string): string | null => {
    return window.prompt(message);
  };

  // Delete file manually
  const handleDeleteFile = (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileName === "index.html") {
      alert("Core entry file index.html cannot be deleted!");
      return;
    }
    if (confirm(`Are you sure you want to delete ${fileName}?`)) {
      setFiles(prev => {
        if (!prev) return null;
        const copy = { ...prev };
        delete copy[fileName];
        return copy;
      });
      if (activeFileName === fileName) {
        setActiveFileName("index.html");
      }
    }
  };

  // Copy code of active file
  const handleCopyCode = () => {
    if (!files || !files[activeFileName]) return;
    navigator.clipboard.writeText(files[activeFileName]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToWorkspace = () => {
    if (!files) return;
    const name = window.prompt("Enter website project name:", "My_Generated_Website");
    if (!name || !name.trim()) return;
    const cleanName = name.trim().endsWith(".html") ? name.trim() : `${name.trim()}.html`;

    const projectSaveData = JSON.stringify({
      files: files,
      savedAt: new Date().toISOString()
    });

    addFileToWorkspace({
      name: cleanName,
      type: "website",
      size: `${Math.round(projectSaveData.length / 1024)} KB`,
      content: projectSaveData
    });
    setIsSaved(true);
    addActivityLog("Saved designed website project", `File: ${cleanName}`);
    setTimeout(() => setIsSaved(false), 2500);
  };

  // Download bundled HTML as a single file
  const handleDownloadHTML = useCallback(() => {
    if (!files) return;
    setIsExporting(true);
    try {
      const bundledHtml = bundleWebProject(files);
      const blob = new Blob([bundledHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "website.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addActivityLog("Downloaded website as HTML", "Single-file bundled export");
    } catch (err) {
      console.error("HTML download failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, [files]);

  // Download all project files as a ZIP archive
  const handleDownloadZip = useCallback(async () => {
    if (!files || !jsZipReady || !(window as any).JSZip) return;
    setIsExporting(true);
    try {
      const JSZip = (window as any).JSZip;
      const zip = new JSZip();
      Object.entries(files).forEach(([name, content]) => {
        zip.file(name, content);
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "website-project.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addActivityLog("Downloaded website as ZIP", `${Object.keys(files).length} files exported`);
    } catch (err) {
      console.error("ZIP download failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, [files, jsZipReady]);

  // Get Prism language for a filename
  const getPrismLanguage = (filename: string): string => {
    if (filename.endsWith(".html")) return "markup";
    if (filename.endsWith(".css")) return "css";
    if (filename.endsWith(".jsx")) return "jsx";
    if (filename.endsWith(".tsx")) return "tsx";
    if (filename.endsWith(".ts")) return "typescript";
    return "javascript";
  };

  // Get highlighted HTML from Prism
  const getHighlightedCode = useCallback((code: string, filename: string): string => {
    if (!prismReady || !(window as any).Prism) return code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const lang = getPrismLanguage(filename);
    const grammar = (window as any).Prism.languages[lang] || (window as any).Prism.languages.javascript;
    return (window as any).Prism.highlight(code, grammar, lang);
  }, [prismReady]);

  const activeFileContent = files ? files[activeFileName] || "" : "";

  return (
    <div className="flex-1 flex flex-col h-full rounded-2xl glass-panel relative overflow-hidden font-sans">
      
      {/* Header bar */}
      <div className="h-14 border-b border-[#3D4833]/20 px-6 flex items-center justify-between bg-[#F0E8DC]/40 shrink-0">
        <div className="flex items-center gap-2">
          <Layout className="h-4.5 w-4.5 text-primary" />
          <span className="text-xs font-bold text-[#2A3226] tracking-wider uppercase">AI Website IDE Sandbox</span>
        </div>
 
        {files && (
          <div className="flex items-center gap-4">
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

            <button 
              onClick={handleSaveToWorkspace}
              className={`py-1.5 px-3 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 border transition-all ${isSaved ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 font-semibold' : 'workspace-primary-button'}`}
            >
              {isSaved ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Save to Workspace</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadHTML}
              disabled={isExporting}
              className="py-1.5 px-3 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 border border-[#3D4833]/20 bg-[#F0E8DC] hover:bg-[#F0E8DC] text-[#2A3226] transition-all disabled:opacity-50"
              title="Download as single HTML file"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Download HTML</span>
            </button>

            <button
              onClick={handleDownloadZip}
              disabled={isExporting || !jsZipReady}
              className="py-1.5 px-3 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 border border-[#3D4833]/20 bg-[#F0E8DC] hover:bg-[#F0E8DC] text-[#2A3226] transition-all disabled:opacity-50"
              title="Download all files as ZIP"
            >
              <FileArchive className="h-3.5 w-3.5" />
              <span>Download ZIP</span>
            </button>
          </div>
        )}
      </div>
 
      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!files && !isGenerating && !errorMsg ? (
          /* Landing Screen */
          <div className="max-w-md mx-auto w-full my-auto flex flex-col gap-6 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
              <Layout className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#2A3226] mb-2">Design Custom Websites with AI</h2>
              <p className="text-xs text-[#6B7365] max-w-sm mx-auto leading-relaxed">
                Provide a prompt for your website. The designer compiles index.html, custom styles.css, and app.js into a multi-file IDE with live preview and interactive chat coding adjustments.
              </p>
            </div>
 
            <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="flex flex-col gap-3 rounded-2xl border border-[#3D4833]/30 !bg-[#F0E8DC] p-4 mt-4 shadow-sm">
              <input 
                type="text" 
                placeholder="Build a dark-theme SaaS landing page for an AI copywriting tool..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full text-xs p-3 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-xl outline-none !text-[#2A3226] !placeholder-[#6B7365]/60 focus:border-[#3D4833]/60 shadow-inner"
              />
              <button 
                type="submit" 
                disabled={!prompt.trim()}
                className={`px-5 py-2.5 rounded-full text-xs font-semibold self-end flex items-center gap-1.5 transition-all ${prompt.trim() ? '!bg-[#3D4833] hover:!bg-[#2A3226] !text-[#F5EFE4] active:scale-95 shadow-sm' : '!bg-[#F0E8DC] !text-[#2A3226]/30 border border-[#3D4833]/15 cursor-not-allowed'}`}
              >
                Design Website
                <ArrowRight className="h-3 w-3" />
              </button>
            </form>

            <div className="flex flex-col gap-2 mt-4 text-left max-w-md mx-auto w-full">
              <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase tracking-wider px-1">Recent Projects</span>
              {websiteProjects.length > 0 ? (
                <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto pr-1">
                  {websiteProjects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => loadProject(proj)}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs bg-[#F0E8DC] border border-[#3D4833]/20 hover:border-[#3D4833] hover:bg-[#F0E8DC] text-[#2A3226] flex items-center justify-between transition-all shadow-sm"
                    >
                      <span className="font-semibold truncate">{proj.name}</span>
                      <span className="text-[9px] text-[#6B7365]/60 font-mono">{proj.size || "Unknown size"}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-[#6B7365]/60 italic px-1 bg-[#F0E8DC]/50 py-2.5 rounded-xl border border-dashed border-[#3D4833]/25 text-center">
                  No saved website projects yet. Click 'Save to Workspace' after generating to see history.
                </div>
              )}
            </div>
          </div>
        ) : errorMsg && !isGenerating ? (
          /* Error State display */
          <div className="max-w-md mx-auto w-full my-auto flex flex-col gap-5 text-center animate-fade-in px-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-500">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold !text-[#2A3226] mb-1.5 font-sans">Website Design Failed</h3>
              <p className="text-xs !text-[#6B7365] leading-relaxed px-4 font-sans">
                {errorMsg}
              </p>
            </div>
            <button 
              onClick={() => {
                setErrorMsg(null);
                setFiles(null);
              }}
              className="px-6 py-2 rounded-full !bg-[#3D4833] hover:!bg-[#2A3226] !text-[#F5EFE4] text-xs font-semibold self-center transition-all shadow-md active:scale-95"
            >
              Try Again
            </button>
          </div>
        ) : isGenerating ? (
          /* Loading Indicator with Premium Progress Bar */
          <div className="my-auto text-center flex flex-col items-center gap-4 w-full max-w-sm mx-auto px-6">
            <div className="w-10 h-10 rounded-full border-2 border-[#3D4833] border-t-transparent animate-spin" />
            
            <div className="w-full flex flex-col gap-2 mt-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-[#6B7365] font-mono uppercase tracking-wider">
                <span className="truncate max-w-[250px]">{generationStep}</span>
                <span>{getProgressPercent(generationStep)}%</span>
              </div>
              <div className="w-full h-2 bg-[#E5DDD0]/50 rounded-full overflow-hidden border border-[#3D4833]/10 relative shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${getProgressPercent(generationStep)}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-[#3D4833] to-[#556347] rounded-full"
                />
              </div>
            </div>
          </div>
        ) : (
          /* Web IDE Workspace Layout */
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-6 items-stretch h-full overflow-hidden">
            
            {/* Left Panel: File Explorer (1/6 space) */}
            <div className="lg:col-span-1 border-r border-[#3D4833]/20 bg-[#F0E8DC]/70 p-4 flex flex-col gap-4 overflow-y-auto">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase tracking-wider">Explorer</span>
                <button 
                  onClick={handleCreateFile}
                  className="p-1 rounded hover:bg-[#3D4833]/15 text-[#6B7365] hover:text-[#2A3226] transition-all"
                  title="Create New File"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              
              <div className="flex flex-col gap-1">
                {Object.keys(files || {}).map((fileName) => {
                  const isActive = activeFileName === fileName;
                  return (
                    <div
                      key={fileName}
                      className={`w-full px-2.5 py-1.8 rounded-lg text-xs flex items-center justify-between gap-2 group/file transition-all border ${
                        isActive 
                          ? 'bg-[#3D4833]/10 text-[#2A3226] border-[#3D4833]/25 font-semibold shadow-sm' 
                          : 'text-[#6B7365] border-transparent hover:bg-[#3D4833]/10 hover:text-[#2A3226]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFileName(fileName);
                          if (fileName.endsWith(".html")) {
                            setCurrentPreviewFile(fileName);
                          }
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <FileCode className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-[#3D4833]' : 'text-[#6B7365]/70'}`} />
                        <span className="truncate">{fileName}</span>
                      </button>
                      
                      {fileName !== "index.html" && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteFile(fileName, e)}
                          className="opacity-0 group-hover/file:opacity-100 p-0.5 rounded hover:bg-red-500/10 text-red-600 transition-all shrink-0"
                          title="Delete File"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="h-[1px] bg-[#3D4833]/15 my-1" />

              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-[#6B7365] font-mono uppercase tracking-wider">Recent Projects</span>
              </div>
              <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto pr-1">
                {websiteProjects.length > 0 ? (
                  websiteProjects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => loadProject(proj)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-[#3D4833]/10 text-[#6B7365] hover:text-[#2A3226] truncate transition-all"
                      title={proj.name}
                    >
                      {proj.name}
                    </button>
                  ))
                ) : (
                  <span className="text-[10px] text-[#6B7365]/50 italic px-2.5 py-1">No saved projects</span>
                )}
              </div>

              <button 
                onClick={() => {
                  if (confirm("Reset current sandbox project? You will lose unsaved work.")) {
                    setFiles(null);
                  }
                }}
                className="mt-auto py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border border-[#3D4833]/20 bg-[#F0E8DC] hover:bg-[#F0E8DC] text-[#6B7365] hover:text-[#2A3226] transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Build New Page</span>
              </button>
            </div>

            {/* Center Panel: Editor or Preview Sandbox (3/6 space) */}
            <div className="lg:col-span-3 bg-[#F0E8DC] flex flex-col overflow-hidden relative border-r border-[#3D4833]/20">
              {previewMode === "preview" ? (
                /* Live Preview Sandbox frame */
                <div className="flex-1 flex flex-col overflow-hidden bg-[#fafaf9] relative">
                  {compileError && (
                    <div className="absolute inset-x-0 top-0 bg-red-50 border-b border-red-200 p-4 text-xs text-red-700 font-mono z-10 flex items-start gap-3 shadow-md animate-slide-in">
                      <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-bold text-red-800 mb-1">Compilation Error</div>
                        <pre className="whitespace-pre-wrap text-[11px] leading-relaxed select-text">{compileError}</pre>
                      </div>
                    </div>
                  )}
                  {babelReady ? (
                    <iframe 
                      title="Website Sandbox Live Preview"
                      srcDoc={files ? bundleWebProject(files, currentPreviewFile) : ""}
                      sandbox="allow-scripts"
                      className="w-full h-full border-none bg-[#F0E8DC]"
                    />
                  ) : (
                    <div className="my-auto text-center flex flex-col items-center gap-3">
                      <div className="w-8 h-8 rounded-full border-2 border-[#3D4833] border-t-transparent animate-spin" />
                      <span className="text-xs text-[#6B7365] font-sans font-medium tracking-wider">Loading compiler...</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Source Code Editor with Syntax Highlighting */
                <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
                  <div className="h-9 bg-zinc-900 border-b border-zinc-800 px-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-400">{activeFileName}</span>
                      <span className="text-[9px] font-mono text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                        {activeFileContent.split('\n').length} lines
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          try {
                            if (activeFileName.endsWith('.html')) {
                              // Basic HTML formatting
                              const formatted = activeFileContent
                                .replace(/>\s*</g, '>\n<')
                                .split('\n')
                                .map(line => line.trim())
                                .join('\n');
                              setFiles(prev => prev ? { ...prev, [activeFileName]: formatted } : null);
                            }
                          } catch { /* ignore formatting errors */ }
                        }}
                        className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-all"
                        title="Format code"
                      >
                        <Palette className="h-3 w-3" />
                        <span>Format</span>
                      </button>
                      <button 
                        onClick={handleCopyCode}
                        className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-all"
                      >
                        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        <span>{copied ? "Copied!" : "Copy"}</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 flex overflow-hidden relative">
                    {/* Line numbers */}
                    <div 
                      ref={lineNumbersRef}
                      className="w-10 bg-zinc-900/80 border-r border-zinc-800/50 text-right select-none shrink-0 overflow-hidden py-5 px-1"
                    >
                      {activeFileContent.split('\n').map((_, i) => (
                        <div 
                          key={i} 
                          className="text-[10px] font-mono text-zinc-600 pr-1"
                          style={{ height: '20px', lineHeight: '20px' }}
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    {/* Code editor with optional syntax highlight overlay */}
                    <div className="flex-1 relative overflow-hidden bg-zinc-950">
                      {prismReady && (
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
                            dangerouslySetInnerHTML={{ __html: getHighlightedCode(activeFileContent, activeFileName) }}
                            className={`language-${getPrismLanguage(activeFileName)}`}
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
                        value={activeFileContent}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFiles(prev => prev ? { ...prev, [activeFileName]: val } : null);
                        }}
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
              )}
            </div>

            {/* Right Panel: AI Sidekick Chat Assistant (2/6 space) */}
            <div className="lg:col-span-2 bg-[#F0E8DC]/40 flex flex-col overflow-hidden h-full">
              {/* Chat Header */}
              <div className="h-10 border-b border-[#3D4833]/20 px-4 flex items-center gap-2 bg-[#F0E8DC] shrink-0">
                <MessageSquare className="h-3.5 w-3.5 text-[#3D4833]" />
                <span className="text-[10px] font-bold text-[#2A3226] font-mono uppercase tracking-wider">Assistant Sidekick</span>
              </div>

              {/* Message Logs */}
              <div ref={chatLogsRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin">
                {chatHistory.map((msg, idx) => {
                  const isAssistant = msg.sender === "assistant";
                  return (
                    <div 
                      key={idx} 
                      className={`flex gap-2.5 max-w-[85%] ${isAssistant ? 'self-start' : 'self-end flex-row-reverse'}`}
                    >
                      <div className={`w-6.5 h-6.5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold border ${
                        isAssistant 
                          ? 'bg-[#3D4833]/10 border-[#3D4833]/25 text-[#3D4833]' 
                          : 'bg-[#3D4833] border-transparent text-[#F5EFE4]'
                      }`}>
                        {isAssistant ? <Bot className="h-3.5 w-3.5" /> : "U"}
                      </div>
                      
                      <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed shadow-sm font-sans ${
                        isAssistant 
                          ? 'bg-[#F0E8DC] border border-[#3D4833]/20 text-[#2A3226]' 
                          : '!bg-[#3D4833] !text-[#F5EFE4]'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })}

                {isApplyingEdit && (
                  <div className="flex gap-2.5 max-w-[85%] self-start animate-pulse">
                    <div className="w-6.5 h-6.5 rounded-full shrink-0 flex items-center justify-center bg-[#3D4833]/10 border border-[#3D4833]/20 text-[#3D4833]">
                      <Bot className="h-3.5 w-3.5 animate-spin" />
                    </div>
                    <div className="rounded-xl px-3 py-2 text-xs leading-relaxed bg-[#F0E8DC] border border-[#3D4833]/20 text-[#2A3226] flex items-center gap-2">
                      <span>Refactoring workspace code...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleApplyEdit} className="p-3 border-t border-[#3D4833]/20 bg-[#F0E8DC] shrink-0 flex gap-2 items-center">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask Assistant Newton to refactor files..."
                  disabled={isApplyingEdit}
                  className="flex-1 text-xs p-2.5 !bg-[#E5DDD0] border border-[#3D4833]/25 rounded-lg outline-none !text-[#2A3226] !placeholder-[#6B7365]/50 focus:border-[#3D4833]/50 disabled:opacity-50 font-sans shadow-inner"
                />
                <button 
                  type="submit" 
                  disabled={!chatInput.trim() || isApplyingEdit}
                  className={`p-2.5 rounded-lg transition-all shrink-0 ${chatInput.trim() && !isApplyingEdit ? '!bg-[#3D4833] !text-[#F5EFE4] hover:!bg-[#2A3226]' : '!bg-[#F0E8DC] !text-[#2A3226]/30 border border-[#3D4833]/15 cursor-not-allowed'}`}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
