import { NextResponse } from "next/server";
import { getSession, isSameOriginRequest, rateLimit } from "@/lib/security";
import { generateAIText, getConfiguredProviders } from "@/lib/ai/server";
import { stitch } from "@google/stitch-sdk";

// Configure Stitch API key in environment for the SDK
const stitchApiKey = process.env.STITCH_API_KEY;
if (stitchApiKey) {
  process.env.STITCH_API_KEY = stitchApiKey;
}

export const runtime = "nodejs";

type GenerateBody = {
  task?: string;
  input?: Record<string, unknown>;
};

const taskInstructions: Record<string, string> = {
  research: 'Return {"report":"exhaustive, in-depth A-to-Z markdown research report. Do NOT summarize or truncate. Include background context, comprehensive analysis, detailed findings, sub-sections for every key point, data tables, and a complete breakdown of all available details.","sources":[{"title":"source title","url":"https://...","domain":"domain","snippet":"short note"}]}. Only include sources you are confident exist. It is valid to return an empty sources array.',
  study_document: 'Return {"summary":["bullet"],"insights":["bullet"]}.',
  study_flashcards: 'Return {"flashcards":[{"q":"question","a":"answer"}]}.',
  study_mcq: 'Return {"mcqs":[{"q":"question","options":["a","b","c","d"],"answerIdx":0}]}. answerIdx must be a zero-based integer.',
  study_notes: 'Return {"notes":"exhaustive, comprehensive A-to-Z markdown revision notes for students. Do NOT summarize, truncate, or minimize. Include detailed explanations of every topic, definitions, key formulas, bullet lists, step-by-step examples, case studies, and structured tables. Provide complete, in-depth content from A to Z."}.',
  study_concepts: 'Return {"concepts":[{"term":"term","explanation":"simple explanation"}]}.',
  resume_ats: 'Return {"atsScore":0,"missingKeywords":["keyword"],"formattingAudits":[{"item":"audit item","pass":true}]}. atsScore must be 0-100.',
  resume_match: 'Return {"matchScore":0,"missingSkills":["skill"]}. matchScore must be 0-100.',
  resume_rewrite: 'Return {"rewrittenBullet":"one concise ATS-friendly bullet with measurable impact where justified"}.',
  resume_cover: 'Return {"coverLetter":"professional cover letter"}.',
  resume_linkedin: 'Return {"headline":"LinkedIn headline","about":"LinkedIn About section"}.',
  resume_interview: 'Return {"questions":[{"cat":"tech","q":"question","a":"strong answer guidance"}]}. cat must be tech, hr, or behavioral.',
  website: `You are a world-class web designer. Generate a clean, premium, high-performance React/Tailwind single-component application as JSON containing exactly two files: "index.html" and "App.jsx".\n\nCRITICAL RULES:\n1. Do NOT create other jsx files or folders (like components/Footer.jsx); keep the entire page layout, header, footer, sections, navigation, and sub-components inline inside "App.jsx" as a single cohesive default-export component to ensure fast generation and syntax correctness.\n2. Output PURE HTML/JSX ONLY - no markdown, no code fences, no backticks in file content\n3. index.html loads https://cdn.tailwindcss.com via <script> and Google Fonts (Inter, Outfit, etc) via <link>, mounts <div id="root">\n4. App.jsx is a default-export React component with self-closing void tags (<img />, <input />, <br />). Do NOT append extra trailing braces "}}" at the end of the file.\n5. Mobile-first responsive design using Tailwind breakpoints (sm:, md:, lg:, xl:)\n6. Semantic HTML5 structure with proper heading hierarchy\n7. Include ARIA labels for interactive elements\n8. NO third-party chart libs (recharts, chart.js) — use Tailwind divs + inline SVGs instead\n9. Root layout: items-start justify-start with py-12, never vertically centered\n10. Design: premium dark/gradient theme, smooth hover animations (transition-all duration-300), active states, rich color accents\n11. Use modern typography, vibrant gradients, glassmorphism effects, micro-animations\n12. Include proper meta tags for SEO (title, description, viewport)\n13. For rich animations, scroll effects, and visual transitions, you can import and use 'framer-motion' (e.g. import { motion } from 'framer-motion') or 'gsap' (e.g. import gsap from 'gsap') inside App.jsx.`,
  website_edit: 'You receive the current files dictionary and an edit request. Return the COMPLETE updated {"files":{"index.html":"...","App.jsx":"..."}} with all changes applied. Keep the entire UI code self-contained inside "App.jsx". Do NOT create additional files or sub-component folders. Preserve files not mentioned. Self-close all void JSX tags. Maintain premium design with vibrant gradients, hover animations, and interactive states. Root layout: items-start justify-start, never vertically centered. ANIMATIONS: For animations, scroll/fade transitions, or interactive effects, you can import and use \'framer-motion\' (e.g. import { motion } from \'framer-motion\') or \'gsap\' (e.g. import gsap from \'gsap\') if requested.',
  presentation: `Return ONLY valid JSON, no markdown, no code fences. Schema: {"slides":[{"title":"slide title","layout":"hero"|"split"|"features"|"stats"|"quote"|"bullets","subtitle":"optional (hero only)","splitLeft":"left column (split only)","splitRight":"right column (split only)","features":[{"title":"...","desc":"..."}],"stats":[{"value":"e.g. 99.9%","label":"metric label"}],"quote":"quote body","author":"attribution","bullets":["bullet text"],"imageKeyword":"a short stock photo keyword related to this slide's topic"}]}.\n\nCRITICAL RULES:\n1. First slide MUST be "hero" with a compelling subtitle\n2. Use a diverse MIX of layouts — never use the same layout twice in a row\n3. Include at least one "stats" slide with real, impressive metrics\n4. Include at least one "features" slide with 3-4 items\n5. Content must be SPECIFIC to the topic, not generic placeholder text\n6. Match the requested slide count exactly\n7. Each slide title should be unique and engaging\n8. Use professional, compelling language throughout\n9. For "split" layout, left and right columns should have complementary content\n10. For "quote" layout, use relevant, impactful quotes with proper attribution\n11. Always output a highly relevant and specific "imageKeyword" value for each slide (e.g. "artificial intelligence startup" or "financial growth graph")`,
  companion: 'Return {"reply":"direct chat response as a friendly and helpful AI companion assistant puppy named Newton. Be conversational, direct, and under 3 sentences. Optional recommendations: [\\"action label\\"]. Optional navigation: \\"dashboard\\" | \\"chat\\" | \\"research\\" | \\"resume\\" | \\"study\\" | \\"website\\" | \\"presentation\\" | null. Optional state: \\"happy\\" | \\"excited\\" | \\"sad\\" | \\"naughty\\" | \\"thinking\\" | \\"confused\\". Optional action: {\\"type\\": \\"write\\" | \\"generate\\", \\"target\\": \\"chat_input\\" | \\"website_prompt\\" | \\"presentation_prompt\\" | \\"study_query\\" | \\"resume_skills\\", \\"value\\": \\"text to write\\"}. Set action if the user asks you to write, create, generate, or search something in the website."}',
};

async function searchWeb(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      }
    });
    if (!response.ok) {
      return [];
    }
    const html = await response.text();
    const results: Array<{ title: string; url: string; snippet: string }> = [];
    
    // Regex matching title, url, snippet on html.duckduckgo.com, allowing class after other attributes
    const regex = /<a\s+[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a\s+[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null && results.length < 5) {
      let url = match[1];
      
      // Clean redirect uddg query param
      if (url.includes("uddg=")) {
        try {
          const parts = url.split("uddg=");
          if (parts[1]) {
            url = decodeURIComponent(parts[1].split("&")[0]);
          }
        } catch {
          // ignore
        }
      }
      
      const title = match[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      const snippet = match[3].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      
      if (title && url) {
        results.push({ title, url, snippet });
      }
    }
    return results;
  } catch (error) {
    console.error("searchWeb failed:", error);
    return [];
  }
}

function balanceBraces(jsonStr: string): string {
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (char === '"' && !escape) {
      inString = !inString;
    } else if (char === '\\' && inString) {
      escape = !escape;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        openBraces++;
      } else if (char === '}') {
        if (openBraces > 0) openBraces--;
      } else if (char === '[') {
        openBrackets++;
      } else if (char === ']') {
        if (openBrackets > 0) openBrackets--;
      }
    }
    escape = false;
  }
  
  let repaired = jsonStr;
  if (inString) {
    repaired += '"';
  }
  while (openBrackets > 0) {
    repaired += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    repaired += '}';
    openBraces--;
  }
  return repaired;
}

function repairJsonString(jsonStr: string): string {
  let repaired = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    if (char === '"' && !escape) {
      inString = !inString;
      repaired += char;
    } else if (char === '\\' && inString) {
      escape = !escape;
      repaired += char;
    } else if (inString && (char === '\n' || char === '\r')) {
      repaired += '\\n';
      escape = false;
    } else {
      repaired += char;
      escape = false;
    }
  }
  return repaired;
}

function parseMarkdownFiles(content: string): Record<string, string> {
  const files: Record<string, string> = {};
  const regex = /(?:#+|\*\*|File:)\s*([a-zA-Z0-9_\-\.\/]+)\s*(?:\*\*|:)?\s*\r?\n\s*```[a-z]*\r?\n([\s\S]*?)```/gi;
  let match;
  let found = false;
  while ((match = regex.exec(content)) !== null) {
    const filename = match[1].trim();
    files[filename] = match[2];
    found = true;
  }
  
  if (!found) {
    const codeBlockRegex = /```([a-z]*)\s*\r?\n([\s\S]*?)```/gi;
    let idx = 1;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const lang = match[1].trim();
      const code = match[2];
      
      // If the block is JSON, try to extract files from it
      if (lang === "json" || code.trim().startsWith("{")) {
        try {
          const repaired = repairJsonString(code.trim());
          const balanced = balanceBraces(repaired);
          const parsed = JSON.parse(balanced);
          if (parsed && typeof parsed === "object") {
            const extractedFiles = parsed.files || parsed;
            if (extractedFiles && typeof extractedFiles === "object") {
              let merged = false;
              for (const [fName, fContent] of Object.entries(extractedFiles)) {
                if (typeof fContent === "string") {
                  files[fName] = fContent;
                  merged = true;
                }
              }
              if (merged) continue;
            }
          }
        } catch (e) {
          // Ignore parse errors and fall through
        }
      }

      const firstLine = code.split("\n")[0] || "";
      const filenameMatch = firstLine.match(/(?:\/\/|#|\/\*)\s*([a-zA-Z0-9_\-\.\/]+)/);
      if (filenameMatch) {
        files[filenameMatch[1].trim()] = code;
      } else {
        let name = `file_${idx}`;
        const lowerCode = code.toLowerCase();
        if (lang === "json") {
          name = `data_${idx}.json`;
        } else if (lang === "html" || lowerCode.includes("<!doctype html>")) {
          name = "index.html";
        } else if (lang === "css" || lowerCode.includes("margin:") && lowerCode.includes("{")) {
          name = "styles.css";
        } else if (lang === "jsx" || lang === "tsx" || lowerCode.includes("import react") || lowerCode.includes("export default")) {
          name = "App.jsx";
        } else if (lang === "js" || lang === "ts") {
          name = "app.js";
        }
        files[name] = code;
        idx++;
      }
    }
  }
  return files;
}

// Fix double-escaped string content from AI models that output \\n instead of \n
// After JSON.parse, these become literal two-char \n sequences instead of real newlines
function unescapeFileContents(data: { files: Record<string, string> }): { files: Record<string, string> } {
  const fixed: Record<string, string> = {};
  for (const [name, content] of Object.entries(data.files)) {
    if (typeof content !== 'string') {
      fixed[name] = content;
      continue;
    }
    const realNewlinesCount = (content.match(/\n/g) || []).length;
    const literalEscapesCount = (content.match(/\\n/g) || []).length;
    const hasLiteralQuotes = content.includes('\\"');
    
    if (literalEscapesCount > 0 && (realNewlinesCount < 3 || literalEscapesCount > realNewlinesCount) || hasLiteralQuotes) {
      fixed[name] = content
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');
    } else {
      fixed[name] = content;
    }
  }
  return { files: fixed };
}

function extractJson(content: string, task?: string) {
  try {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    const source = fenced || content;
    const start = source.indexOf("{");
    const end = source.lastIndexOf("}");
    if (start !== -1) {
      const jsonPart = end !== -1 && end > start ? source.slice(start, end + 1) : source.slice(start);
      const repaired = repairJsonString(jsonPart);
      const balanced = balanceBraces(repaired);
      const data = JSON.parse(balanced);
      if (data && typeof data === "object") {
        if (task === "website" || task === "website_edit") {
          if (data.files) return unescapeFileContents(data);
          return unescapeFileContents({ files: data });
        }
        return data;
      }
    }
  } catch (e) {
    console.warn("Local JSON parsing failed, trying markdown extraction fallback...", e);
  }

  if (task === "website" || task === "website_edit") {
    const files = parseMarkdownFiles(content);
    if (Object.keys(files).length > 0) {
      return unescapeFileContents({ files });
    }
    throw new Error("AI response did not contain valid JSON or Markdown code files");
  }

  throw new Error("AI response did not contain valid JSON");
}

function getModelForTask(task: string): string {
  if (task === "website_edit") {
    return "anthropic";
  }
  if (["website", "presentation"].includes(task)) {
    return "openai";
  }
  if (task.startsWith("resume_")) {
    return "openai";
  }
  if (task === "research") {
    return "groq";
  }
  if (task === "companion") {
    return "groq";
  }
  if (task.startsWith("study_")) {
    return "groq";
  }
  return "gemini";
}

function getMaxTokensForTask(task: string): number {
  if (task === "website" || task === "website_edit") return 16384;
  if (task === "presentation") return 8192;
  return 4096;
}

export async function GET() {
  try {
    const pythonResponse = await fetch("http://127.0.0.1:8000/api/ai/generate");
    if (pythonResponse.ok) {
      const data = await pythonResponse.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.log("Python backend offline for GET, falling back to local: ", error);
  }
  return NextResponse.json({ providers: getConfiguredProviders() });
}

async function handleStitchWebsiteTask(task: string, input: Record<string, unknown>) {
  const apiKey = process.env.STITCH_API_KEY;
  if (!apiKey) {
    throw new Error("No Stitch API key configured. Please add STITCH_API_KEY to your environment.");
  }

  if (task === "website") {
    const prompt = (input.prompt as string) || "Premium landing page";
    const project = await stitch.createProject(`NeuroFlow_${Date.now()}`);
    const screen = await project.generate(prompt);
    
    const htmlUrl = await screen.getHtml();
    const htmlResponse = await fetch(htmlUrl);
    if (!htmlResponse.ok) {
      throw new Error(`Failed to fetch generated HTML from Stitch: ${htmlResponse.statusText}`);
    }
    let htmlCode = await htmlResponse.text();
    
    htmlCode = `${htmlCode}\n<!-- STITCH_PROJECT_ID: ${project.id} -->\n<!-- STITCH_SCREEN_ID: ${screen.id} -->`;
    
    return {
      result: {
        files: {
          "index.html": htmlCode
        }
      },
      provider: "stitch",
      model: "stitch-generation"
    };
  } else {
    const prompt = (input.prompt as string) || "Modify design";
    const currentFiles = (input.currentFiles as Record<string, string>) || {};
    const htmlContent = currentFiles["index.html"] || "";
    
    const projectIdMatch = htmlContent.match(/<!-- STITCH_PROJECT_ID:\s*([^\s-]+)\s*-->/);
    const screenIdMatch = htmlContent.match(/<!-- STITCH_SCREEN_ID:\s*([^\s-]+)\s*-->/);
    
    let projectId = projectIdMatch?.[1];
    let screenId = screenIdMatch?.[1];
    
    let updatedScreen;
    if (!projectId || !screenId) {
      const project = await stitch.createProject(`NeuroFlow_Edit_${Date.now()}`);
      const screen = await project.generate(prompt);
      projectId = project.id;
      updatedScreen = screen;
    } else {
      const project = stitch.project(projectId);
      const screen = await project.getScreen(screenId);
      updatedScreen = await screen.edit(prompt);
    }
    
    const updatedHtmlUrl = await updatedScreen.getHtml();
    const htmlResponse = await fetch(updatedHtmlUrl);
    if (!htmlResponse.ok) {
      throw new Error(`Failed to fetch updated HTML from Stitch: ${htmlResponse.statusText}`);
    }
    let htmlCode = await htmlResponse.text();
    
    htmlCode = `${htmlCode}\n<!-- STITCH_PROJECT_ID: ${projectId} -->\n<!-- STITCH_SCREEN_ID: ${updatedScreen.id} -->`;
    
    const updatedFiles = { ...currentFiles, "index.html": htmlCode };
    return {
      result: {
        files: updatedFiles
      },
      provider: "stitch",
      model: "stitch-edit"
    };
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const retryAfter = rateLimit(request, `ai-generate-${session.userId}`, 12, 60_000);
  if (retryAfter) return NextResponse.json({ error: "Generation rate limit exceeded." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  const body = (await request.json()) as GenerateBody;
  const task = body.task || "";
  
  if (task === "website") {
    try {
      const result = await handleStitchWebsiteTask(task, body.input || {});
      return NextResponse.json(result);
    } catch (error) {
      console.warn("Stitch API failed, falling back to local GPT-4o/Python generator:", error);
    }
  }

  // Try Python backend first (with timeout to prevent hanging)
  try {
    const proxyController = new AbortController();
    const proxyTimeout = setTimeout(() => proxyController.abort(), 180000); // 3min timeout for heavy tasks

    const pythonResponse = await fetch("http://127.0.0.1:8000/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: proxyController.signal,
    });

    clearTimeout(proxyTimeout);

    if (pythonResponse.ok) {
      const data = await pythonResponse.json();
      return NextResponse.json(data);
    } else {
      const errData = await pythonResponse.json().catch(() => ({}));
      if (errData.error) {
        return NextResponse.json({ error: errData.error }, { status: pythonResponse.status });
      }
    }
  } catch (error) {
    console.log("Python backend offline or timed out, falling back to local: ", error);
  }

  // Local fallback
  let rawContent = "";
  try {
    const task = body.task || "";
    const instruction = taskInstructions[task];
    if (!instruction) {
      return NextResponse.json({ error: "Unsupported AI generation task" }, { status: 400 });
    }

    const query = (body.input?.query as string) || "";
    let promptContent = `${instruction}\n\nInput:\n${JSON.stringify(body.input || {}).slice(0, 24000)}`;

    if (task === "research" && query.trim()) {
      const searchResults = await searchWeb(query);
      promptContent = `${instruction}

Here are real-time, actual live web search results for the query "${query}":
${JSON.stringify(searchResults)}

Input:
${JSON.stringify(body.input || {}).slice(0, 24000)}

Please synthesize the above web search results to write an exhaustive, deep, and complete A-to-Z Markdown report without any truncation or summarization. Ensure that:
1. The report is written as an in-depth, professional guide containing all facts, background details, statistics, and sub-analyses from the search results.
2. Every fact, statistic, metric, and value mentioned in the report is real and factually correct based on the search results.
3. The "sources" array contains the exact URL, title, and domain from the real search results above. Do not invent any URLs.
4. If no search results are found or are relevant, still produce a detailed report but mark the sources array empty.`;
    }

    const requestedModel = getModelForTask(task);
    const maxTokens = getMaxTokensForTask(task);

    const { content, provider, model } = await generateAIText([
      {
        role: "system",
        content: "You are the generation engine for NeuroFlow AI. CRITICAL: Return ONLY strict, valid JSON. No prose, no markdown fences, no backticks, no explanatory text before or after the JSON. The response must start with { and end with }. Keep outputs practical, specific, and production-quality.",
      },
      {
        role: "user",
        content: promptContent,
      },
    ], requestedModel, maxTokens);

    rawContent = content;

    try {
      const result = extractJson(content, task);
      return NextResponse.json({ result, provider, model });
    } catch (parseError) {
      console.error("--- JSON EXTRACTION FAILED ---");
      console.error("Task:", task);
      console.error("Raw content:", content);
      console.error("------------------------------");
      throw parseError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed";

    // Categorize errors for the frontend
    let status = 502;
    let code = "GENERATION_FAILED";
    if (message.includes("No AI provider key")) {
      status = 503;
      code = "NO_PROVIDER";
    } else if (message.includes("401") || message.includes("403") || message.includes("AUTH")) {
      status = 401;
      code = "AUTH_FAILED";
    } else if (message.includes("429") || message.includes("rate")) {
      status = 429;
      code = "RATE_LIMIT";
    } else if (message.includes("abort") || message.includes("timed out") || message.includes("timeout")) {
      status = 504;
      code = "TIMEOUT";
    }

    return NextResponse.json({ error: message, code, rawContent }, { status });
  }
}
