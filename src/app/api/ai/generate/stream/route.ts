import { generateAIText } from "@/lib/ai/server";
import { stitch } from "@google/stitch-sdk";
import { getSession, isSameOriginRequest, rateLimit } from "@/lib/security";

// Configure Stitch API key in environment for the SDK
const stitchApiKey = process.env.STITCH_API_KEY;
if (stitchApiKey) {
  process.env.STITCH_API_KEY = stitchApiKey;
}

export const runtime = "nodejs";

type StreamBody = {
  task?: string;
  input?: Record<string, unknown>;
};

// Task instructions — imported inline to keep streaming route self-contained
const taskInstructions: Record<string, string> = {
  website: 'Generate a complete React/Tailwind multi-file project as JSON: {"files":{"index.html":"...","App.jsx":"..."}}. RULES: index.html loads https://cdn.tailwindcss.com via <script> and Google Fonts (Inter etc), mounts <div id="root">. App.jsx is a default-export React component. Self-close ALL void JSX tags (<img />, <input />, <br />). NO third-party chart libs (recharts, chart.js) — use Tailwind divs + inline SVGs instead. Root layout: items-start justify-start with py-12, never vertically centered. Design: premium dark/gradient theme, smooth hover animations, active states, rich color accents, custom components. All script files must be syntactically valid React default exports. ANIMATIONS: For animations, scroll effects, and rich transitions, you can import and use \'framer-motion\' (e.g. import { motion } from \'framer-motion\') or \'gsap\' (e.g. import gsap from \'gsap\'). Make sure to use these if animations are requested.',
  website_edit: 'You receive the current files dictionary and an edit request. Return the COMPLETE updated {"files":{...}} with all changes applied. Preserve files not mentioned. Self-close all void JSX tags. Maintain premium design with vibrant gradients, hover animations, and interactive states. Root layout: items-start justify-start, never vertically centered. ANIMATIONS: For animations, scroll/fade transitions, or interactive effects, you can import and use \'framer-motion\' (e.g. import { motion } from \'framer-motion\') or \'gsap\' (e.g. import gsap from \'gsap\') if requested.',
  presentation: 'Return {"slides":[{"title":"slide title","layout":"hero"|"split"|"features"|"stats"|"quote"|"bullets","subtitle":"optional (hero)","splitLeft":"left column text (split)","splitRight":"right column text (split)","features":[{"title":"...","desc":"..."}],"stats":[{"value":"e.g. 99.9%","label":"metric label"}],"quote":"quote body","author":"attribution","bullets":["bullet text"],"imageKeyword":"a short stock photo keyword related to this slide\'s topic"}]}. RULES: Use a diverse MIX of layouts — first slide must be "hero" with subtitle. Include at least one "stats" or "features" slide. Content must be specific to the topic, not generic. Match the requested slide count. Always output a relevant "imageKeyword" value for each slide.',
};

function getMaxTokensForTask(task: string): number {
  if (task === "website" || task === "website_edit") return 16384;
  if (task === "presentation") return 8192;
  return 4096;
}

function getModelForTask(task: string): string {
  if (["website", "website_edit", "presentation"].includes(task)) return "openai";
  return "gemini";
}

// JSON extraction (duplicated from main route to keep streaming self-contained)
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
      const firstLine = code.split("\n")[0] || "";
      const filenameMatch = firstLine.match(/(?:\/\/|#|\/\*)\s*([a-zA-Z0-9_\-\.\/]+)/);
      if (filenameMatch) {
        files[filenameMatch[1].trim()] = code;
      } else {
        let name = `file_${idx}`;
        const lowerCode = code.toLowerCase();
        if (lang === "html" || lowerCode.includes("<!doctype html>")) name = "index.html";
        else if (lang === "css" || lowerCode.includes("margin:") && lowerCode.includes("{")) name = "styles.css";
        else if (lang === "jsx" || lang === "tsx" || lowerCode.includes("import react") || lowerCode.includes("export default")) name = "App.jsx";
        else if (lang === "js" || lang === "ts") name = "app.js";
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

function sseEvent(type: string, data: Record<string, unknown> = {}): string {
  return `data: ${JSON.stringify({ type, ...data })}\n\n`;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new Response("Forbidden", { status: 403 });
  const session = getSession(request);
  if (!session) return new Response("Authentication required", { status: 401 });
  const retryAfter = rateLimit(request, `ai-stream-${session.userId}`, 12, 60_000);
  if (retryAfter) return new Response("Rate limit exceeded", { status: 429 });
  const body = (await request.json()) as StreamBody;
  const task = body.task || "";
  const instruction = taskInstructions[task];

  if (!instruction) {
    return new Response(
      sseEvent("error", { error: "Unsupported task for streaming" }),
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: Record<string, unknown> = {}) => {
        controller.enqueue(encoder.encode(sseEvent(type, data)));
      };

      try {
        if (["website", "website_edit"].includes(task)) {
          try {
            send("progress", { step: "Initializing Google Stitch engine..." });
            const apiKey = process.env.STITCH_API_KEY;
            if (!apiKey) {
              throw new Error("No Stitch API key configured. Please add STITCH_API_KEY to your environment.");
            }
            
            if (task === "website") {
              const prompt = (body.input?.prompt as string) || "Premium landing page";
              send("progress", { step: "Creating new Stitch design project..." });
              const project = await stitch.createProject(`NeuroFlow_${Date.now()}`);
              
              send("progress", { step: "Stitch is generating UI components..." });
              const screen = await project.generate(prompt);
              
              send("progress", { step: "Retrieving layout code from Stitch..." });
              const htmlUrl = await screen.getHtml();
              const htmlResponse = await fetch(htmlUrl);
              if (!htmlResponse.ok) {
                throw new Error(`Failed to fetch generated HTML: ${htmlResponse.statusText}`);
              }
              let htmlCode = await htmlResponse.text();
              
              htmlCode = `${htmlCode}\n<!-- STITCH_PROJECT_ID: ${project.id} -->\n<!-- STITCH_SCREEN_ID: ${screen.id} -->`;
              
              send("progress", { step: "Compiling HTML and mounting sandbox..." });
              send("result", {
                data: {
                  files: {
                    "index.html": htmlCode
                  }
                },
                provider: "stitch",
                model: "stitch-generation"
              });
            } else {
              const prompt = (body.input?.prompt as string) || "Modify design";
              const currentFiles = (body.input?.currentFiles as Record<string, string>) || {};
              const htmlContent = currentFiles["index.html"] || "";
              
              const projectIdMatch = htmlContent.match(/<!-- STITCH_PROJECT_ID:\s*([^\s-]+)\s*-->/);
              const screenIdMatch = htmlContent.match(/<!-- STITCH_SCREEN_ID:\s*([^\s-]+)\s*-->/);
              
              let projectId = projectIdMatch?.[1];
              let screenId = screenIdMatch?.[1];
              
              let updatedScreen;
              if (!projectId || !screenId) {
                send("progress", { step: "Creating new Stitch design project for editing..." });
                const project = await stitch.createProject(`NeuroFlow_Edit_${Date.now()}`);
                const screen = await project.generate(prompt);
                projectId = project.id;
                updatedScreen = screen;
              } else {
                send("progress", { step: "Connecting to existing Stitch project..." });
                const project = stitch.project(projectId);
                
                send("progress", { step: "Retrieving original screen layout..." });
                const screen = await project.getScreen(screenId);
                
                send("progress", { step: "Applying modifications with Stitch..." });
                updatedScreen = await screen.edit(prompt);
              }
              
              send("progress", { step: "Retrieving updated layout code..." });
              const updatedHtmlUrl = await updatedScreen.getHtml();
              const htmlResponse = await fetch(updatedHtmlUrl);
              if (!htmlResponse.ok) {
                throw new Error(`Failed to fetch updated HTML: ${htmlResponse.statusText}`);
              }
              let htmlCode = await htmlResponse.text();
              
              htmlCode = `${htmlCode}\n<!-- STITCH_PROJECT_ID: ${projectId} -->\n<!-- STITCH_SCREEN_ID: ${updatedScreen.id} -->`;
              
              send("progress", { step: "Refreshing sandbox preview..." });
              send("result", {
                data: {
                  files: {
                    ...currentFiles,
                    "index.html": htmlCode
                  }
                },
                provider: "stitch",
                model: "stitch-edit"
              });
            }
            return;
          } catch (stitchError) {
            console.warn("Stitch stream generation failed, falling back to local GPT-4o:", stitchError);
            send("progress", { step: "Stitch API failed. Falling back to local GPT-4o generator..." });
          }
        }

        // Phase 1: Preparation
        send("progress", { step: "Analyzing prompt and selecting AI model..." });

        const requestedModel = getModelForTask(task);
        const maxTokens = getMaxTokensForTask(task);
        const promptContent = `${instruction}\n\nInput:\n${JSON.stringify(body.input || {}).slice(0, 24000)}`;

        // Phase 2: Generation
        send("progress", { step: `Generating with ${requestedModel === "openai" ? "GPT-4o" : requestedModel}...` });
        send("progress", { step: "Building component architecture..." });

        const { content, provider, model } = await generateAIText([
          {
            role: "system",
            content: "You are the generation engine for NeuroFlow AI. Return only strict JSON with no prose or markdown fences. Keep outputs practical and concise.",
          },
          {
            role: "user",
            content: promptContent,
          },
        ], requestedModel, maxTokens);

        // Phase 3: Parsing
        send("progress", { step: "Parsing and validating output structure..." });

        const result = extractJson(content, task);

        // Phase 4: Complete
        send("progress", { step: "Finalizing project files..." });
        send("result", { data: result, provider, model });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Generation failed";
        send("error", { error: message });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
