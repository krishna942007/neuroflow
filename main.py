import os
import re
import json
import asyncio
import urllib.parse
import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="NeuroFlow AI Python Backend")

# Enable CORS for Next.js proxy/fetches
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TASK_INSTRUCTIONS = {
    'research': 'Return {"report":"exhaustive, in-depth A-to-Z markdown research report. Do NOT summarize or truncate. Include background context, comprehensive analysis, detailed findings, sub-sections for every key point, data tables, and a complete breakdown of all available details.","sources":[{"title":"source title","url":"https://...","domain":"domain","snippet":"short note"}]}. Only include sources you are confident exist. It is valid to return an empty sources array.',
    'study_document': 'Return {"summary":["bullet"],"insights":["bullet"]}.',
    'study_flashcards': 'Return {"flashcards":[{"q":"question","a":"answer"}]}.',
    'study_mcq': 'Return {"mcqs":[{"q":"question","options":["a","b","c","d"],"answerIdx":0}]}. answerIdx must be a zero-based integer.',
    'study_notes': 'Return {"notes":"exhaustive, comprehensive A-to-Z markdown revision notes for students. Do NOT summarize, truncate, or minimize. Include detailed explanations of every topic, definitions, key formulas, bullet lists, step-by-step examples, case studies, and structured tables. Provide complete, in-depth content from A to Z."}.',
    'study_concepts': 'Return {"concepts":[{"term":"term","explanation":"simple explanation"}]}.',
    'resume_ats': 'Return {"atsScore":0,"missingKeywords":["keyword"],"formattingAudits":[{"item":"audit item","pass":true}]}. atsScore must be 0-100.',
    'resume_match': 'Return {"matchScore":0,"missingSkills":["skill"]}. matchScore must be 0-100.',
    'resume_rewrite': 'Return {"rewrittenBullet":"one concise ATS-friendly bullet with measurable impact where justified"}.',
    'resume_cover': 'Return {"coverLetter":"professional cover letter"}.',
    'resume_linkedin': 'Return {"headline":"LinkedIn headline","about":"LinkedIn About section"}.',
    'resume_interview': 'Return {"questions":[{"cat":"tech","q":"question","a":"strong answer guidance"}]}. cat must be tech, hr, or behavioral.',
    'website': 'You are a world-class web designer. Generate a clean, premium, high-performance React/Tailwind single-component application as JSON containing exactly two files: "index.html" and "App.jsx". CRITICAL RULES: 1. Do NOT create other jsx files or folders (like components/Footer.jsx); keep the entire page layout, header, footer, sections, navigation, and sub-components inline inside "App.jsx" as a single cohesive default-export component to ensure fast generation and syntax correctness. 2. Output PURE HTML/JSX ONLY - no markdown, no code fences, no backticks in file content. 3. index.html loads https://cdn.tailwindcss.com via <script> and Google Fonts (Inter, Outfit, etc) via <link>, mounts <div id="root">. 4. App.jsx is a default-export React component with self-closing void tags (<img />, <input />, <br />). Do NOT append extra trailing braces "}}" at the end of the file. 5. Mobile-first responsive design using Tailwind breakpoints (sm:, md:, lg:, xl:). 6. Semantic HTML5 structure with proper heading hierarchy. 7. Include ARIA labels for interactive elements. 8. NO third-party chart libs (recharts, chart.js) - use Tailwind divs + inline SVGs instead. 9. Root layout: items-start justify-start with py-12, never vertically centered. 10. Design: premium dark/gradient theme, smooth hover animations (transition-all duration-300), active states, rich color accents. 11. Use modern typography, vibrant gradients, glassmorphism effects, micro-animations. 12. Include proper meta tags for SEO (title, description, viewport). 13. For animations and rich visual transitions, you can import and use \'framer-motion\' (e.g. import { motion } from \'framer-motion\') or \'gsap\' (e.g. import gsap from \'gsap\') directly inside App.jsx.',
    'website_edit': 'You receive the current files dictionary and an edit request. Return the COMPLETE updated {"files":{"index.html":"...","App.jsx":"..."}} with all changes applied. Keep the entire UI code self-contained inside "App.jsx". Do NOT create additional files or sub-component folders. Preserve files not mentioned. Self-close all void JSX tags. Maintain premium design with vibrant gradients, hover animations, and interactive states. Root layout: items-start justify-start, never vertically centered. ANIMATIONS: For animations, scroll/fade transitions, or interactive effects, you can import and use \'framer-motion\' (e.g. import { motion } from \'framer-motion\') or \'gsap\' (e.g. import gsap from \'gsap\') if requested.',
    'presentation': 'Return ONLY valid JSON, no markdown, no code fences. Schema: {"slides":[{"title":"slide title","layout":"hero"|"split"|"features"|"stats"|"quote"|"bullets","subtitle":"optional (hero only)","splitLeft":"left column (split only)","splitRight":"right column (split only)","features":[{"title":"...","desc":"..."}],"stats":[{"value":"e.g. 99.9%","label":"metric label"}],"quote":"quote body","author":"attribution","bullets":["bullet text"],"imageKeyword":"a short stock photo keyword related to this slide\'s topic"}]}. CRITICAL RULES: 1. First slide MUST be "hero" with a compelling subtitle. 2. Use a diverse MIX of layouts - never use the same layout twice in a row. 3. Include at least one "stats" slide with real, impressive metrics. 4. Include at least one "features" slide with 3-4 items. 5. Content must be SPECIFIC to the topic, not generic placeholder text. 6. Match the requested slide count exactly. 7. Each slide title should be unique and engaging. 8. Use professional, compelling language throughout. 9. Always output a highly relevant and specific "imageKeyword" value for each slide.',
    'companion': 'Return {"reply":"direct chat response as a friendly and helpful AI companion assistant puppy named Newton. Be conversational, direct, and under 3 sentences. Optional recommendations: [\\"action label\\"]. Optional navigation: \\"dashboard\\" | \\"chat\\" | \\"research\\" | \\"resume\\" | \\"study\\" | \\"website\\" | \\"presentation\\" | null. Optional state: \\"happy\\" | \\"excited\\" | \\"sad\\" | \\"naughty\\" | \\"thinking\\" | \\"confused\\". Optional action: {\\"type\\": \\"write\\" | \\"generate\\", \\"target\\": \\"chat_input\\" | \\"website_prompt\\" | \\"presentation_prompt\\" | \\"study_query\\" | \\"resume_skills\\", \\"value\\": \\"text to write\\"}. Set action if the user asks you to write, create, generate, or search something in the website."}'
}

def clean_env_var(name: str) -> str:
    val = os.getenv(name, "")
    return val.strip() if val else ""

def preferred_provider(model: str = None) -> str:
    if not model:
        return None
    m = model.lower()
    if m.startswith("gemini"): return "gemini"
    if m.startswith("groq") or "llama" in m or "mixtral" in m: return "groq"
    if m.startswith("openai") or m.startswith("gpt-") or m.startswith("o1-") or m.startswith("o3-"): return "openai"
    if m.startswith("openrouter") or "/" in m: return "openrouter"
    return None

def provider_config(provider: str, requested_model: str = None):
    m = requested_model.lower() if requested_model else ""
    if provider == "gemini":
        key = clean_env_var("GEMINI_API_KEY")
        if not key: return None
        model = clean_env_var("GEMINI_MODEL") or "gemini-2.5-flash"
        if requested_model and requested_model != "gemini" and requested_model.startswith("gemini"):
            model = requested_model
        return {
            "provider": provider,
            "api_key": key,
            "model": model
        }
    elif provider == "groq":
        key = clean_env_var("GROQ_API_KEY")
        if not key: return None
        model = clean_env_var("GROQ_MODEL") or "llama-3.3-70b-versatile"
        if requested_model and requested_model != "groq" and (requested_model.startswith("groq") or "llama" in m or "mixtral" in m):
            model = requested_model
        return {
            "provider": provider,
            "api_key": key,
            "model": model
        }
    elif provider == "openrouter":
        key = clean_env_var("OPENROUTER_API_KEY")
        if not key: return None
        model = clean_env_var("OPENROUTER_MODEL") or "openrouter/free"
        if requested_model and requested_model != "openrouter" and ("/" in requested_model or "openrouter" in m):
            model = requested_model
        return {
            "provider": provider,
            "api_key": key,
            "model": model
        }
    elif provider == "openai":
        key = clean_env_var("OPENAI_API_KEY")
        if not key: return None
        model = clean_env_var("OPENAI_MODEL") or "gpt-4o-mini"
        if requested_model and requested_model != "openai" and (requested_model.startswith("openai") or requested_model.startswith("gpt-") or requested_model.startswith("o1-") or requested_model.startswith("o3-")):
            model = requested_model
        return {
            "provider": provider,
            "api_key": key,
            "model": model
        }
    return None

def get_model_for_task(task: str) -> str:
    # Assign the best model (provider fallback key) for each task type
    if task in ["website", "website_edit", "presentation"]:
        return "openai" # Best coding and markup schema validation
    elif task in ["resume_ats", "resume_match", "resume_rewrite", "resume_cover", "resume_linkedin", "resume_interview"]:
        return "openai" # Best for business tone, parsing, and copywriting
    elif task in ["research"]:
        return "groq" # Llama 3.3 70B is highly intelligent for reading and synthesizing reports
    elif task in ["companion"]:
        return "groq" # Fast response chat companion
    elif task and task.startswith("study_"):
        return "groq" # High speed response for flashcards and interactive study
    return "gemini"

def get_max_tokens_for_task(task: str) -> int:
    if task in ["website", "website_edit"]:
        return 16384
    if task == "presentation":
        return 8192
    return 4096

def get_timeout_for_task(task: str) -> int:
    """Returns timeout in seconds based on task complexity."""
    if task in ["website", "website_edit"]:
        return 180
    if task == "presentation":
        return 150
    return 60

def get_available_providers(requested_model: str = None):
    preferred = preferred_provider(requested_model)
    ordered = ["groq", "gemini", "openrouter", "openai"]
    if preferred and preferred in ordered:
        ordered.remove(preferred)
        ordered.insert(0, preferred)
    
    configs = []
    for p in ordered:
        cfg = provider_config(p, requested_model)
        if cfg:
            configs.append(cfg)
    return configs

def get_configured_providers_list():
    res = []
    for p in ["groq", "gemini", "openrouter", "openai"]:
        if provider_config(p):
            res.append(p)
    return res

def search_web(query: str):
    try:
        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        resp = requests.get(url, headers=headers, timeout=10)
        if not resp.ok:
            return []
        
        html = resp.text
        results = []
        
        pattern = re.compile(
            r'<a\s+[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a\s+[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>',
            re.IGNORECASE
        )
        
        for match in pattern.finditer(html):
            if len(results) >= 5:
                break
            
            href = match.group(1)
            if "uddg=" in href:
                try:
                    parts = href.split("uddg=")
                    if len(parts) > 1:
                        href = urllib.parse.unquote(parts[1].split("&")[0])
                except Exception:
                    pass
            
            title = re.sub(r'<[^>]*>', '', match.group(2))
            title = " ".join(title.split()).strip()
            
            snippet = re.sub(r'<[^>]*>', '', match.group(3))
            snippet = " ".join(snippet.split()).strip()
            
            if title and href:
                results.append({
                    "title": title,
                    "url": href,
                    "snippet": snippet
                })
        return results
    except Exception as e:
        print(f"search_web failed: {e}")
        return []
RETRYABLE_STATUSES = {429, 500, 502, 503, 504}
PROVIDER_RETRY_DELAY = 2  # seconds

def _call_provider(cfg, messages, max_tokens, timeout):
    """Make a single API call to one provider. Raises on failure."""
    import time as _time
    prov = cfg["provider"]
    model = cfg["model"]
    key = cfg["api_key"]
    
    if prov == "gemini":
        prompt = "\n\n".join([f"{m['role'].upper()}:\n{m['content']}" for m in messages])
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.65, "maxOutputTokens": max_tokens}
        }
        resp = requests.post(url, json=payload, timeout=timeout)
        if not resp.ok:
            raise Exception(f"Gemini request failed with status {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        content = "".join([p.get("text", "") for p in parts])
        if not content:
            raise Exception("Gemini returned an empty response")
        return {"content": content, "provider": prov, "model": model}
    else:
        if prov == "groq":
            endpoint = "https://api.groq.com/openai/v1/chat/completions"
        elif prov == "openrouter":
            endpoint = "https://openrouter.ai/api/v1/chat/completions"
        else:
            endpoint = "https://api.openai.com/v1/chat/completions"
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}"
        }
        if prov == "openrouter":
            headers["HTTP-Referer"] = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")
            headers["X-Title"] = "NeuroFlow AI"
        
        payload = {
            "model": model,
            "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
            "temperature": 0.65,
            "max_tokens": max_tokens
        }
        
        # Enforce JSON mode for OpenAI when system prompt requests JSON
        system_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
        if prov == "openai" and "json" in system_msg.lower():
            payload["response_format"] = {"type": "json_object"}
        
        resp = requests.post(endpoint, json=payload, headers=headers, timeout=timeout)
        if not resp.ok:
            raise Exception(f"{prov} request failed with status {resp.status_code}: {resp.text[:200]}")
        
        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content or not content.strip():
            raise Exception(f"{prov} returned an empty response")
        return {"content": content, "provider": prov, "model": model}


def generate_ai_text(messages, requested_model=None, max_tokens=4096, task=None):
    import time as _time
    providers = get_available_providers(requested_model)
    if not providers:
        raise Exception("No AI provider key configured. Add OPENAI_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY to your environment.")
    
    timeout = get_timeout_for_task(task) if task and task in ["website", "website_edit", "presentation"] else (90 if max_tokens > 8192 else 45)
    failures = []
    
    for cfg in providers:
        # Each provider gets 1 retry on transient errors
        last_error = None
        for attempt in range(2):  # 0 = first try, 1 = retry
            try:
                return _call_provider(cfg, messages, max_tokens, timeout)
            except Exception as e:
                last_error = e
                err_str = str(e)
                
                # Check if retryable
                is_retryable = any(f"status {s}" in err_str for s in RETRYABLE_STATUSES)
                if not is_retryable or attempt >= 1:
                    break
                
                # Backoff before retry
                _time.sleep(PROVIDER_RETRY_DELAY * (attempt + 1))
        
        failures.append(f"[{cfg['provider']}/{cfg['model']}] {str(last_error)}")
    
    raise Exception(f"All AI providers failed:\n" + "\n".join(failures))

def repair_json_string(json_str: str) -> str:
    repaired = []
    in_string = False
    escape = False
    for char in json_str:
        if char == '"' and not escape:
            in_string = not in_string
            repaired.append(char)
        elif char == '\\' and in_string:
            escape = not escape
            repaired.append(char)
        elif in_string and (char == '\n' or char == '\r'):
            repaired.append('\\n')
            escape = False
        else:
            repaired.append(char)
            escape = False
    return "".join(repaired)

def parse_markdown_files(content: str) -> dict:
    files = {}
    regex = re.compile(
        r'(?:#+|\*\*|File:)\s*([a-zA-Z0-9_\-\.\/]+)\s*(?:\*\*|:)?\s*\r?\n\s*```[a-z]*\r?\n([\s\S]*?)```',
        re.IGNORECASE
    )
    found = False
    for match in regex.finditer(content):
        filename = match.group(1).strip()
        file_content = match.group(2)
        files[filename] = file_content
        found = True

    if not found:
        code_block_regex = re.compile(r'```([a-z]*)\s*\r?\n([\s\S]*?)```', re.IGNORECASE)
        idx = 1
        for match in code_block_regex.finditer(content):
            lang = match.group(1).strip()
            code = match.group(2)
            first_line = code.split("\n")[0] if code else ""
            filename_match = re.match(r'(?://|#|\/\*)\s*([a-zA-Z0-9_\-\.\/]+)', first_line)
            if filename_match:
                files[filename_match.group(1).strip()] = code
            else:
                name = f"file_{idx}"
                if lang == "html" or "<!doctype html>" in code.lower():
                    name = "index.html"
                elif lang == "css" or ("{" in code and "margin:" in code):
                    name = "styles.css"
                elif lang in ["jsx", "tsx"] or "import react" in code.lower() or "export default" in code.lower():
                    name = "App.jsx"
                elif lang in ["js", "ts"]:
                    name = "app.js"
                files[name] = code
                idx += 1
    return files

def unescape_file_contents(data: dict) -> dict:
    if not isinstance(data, dict) or "files" not in data:
        return data
    fixed_files = {}
    for name, content in data["files"].items():
        if not isinstance(content, str):
            fixed_files[name] = content
            continue
        real_newlines_count = content.count('\n')
        literal_escapes_count = content.count('\\n')
        has_literal_quotes = '\\"' in content
        
        if (literal_escapes_count > 0 and (real_newlines_count < 3 or literal_escapes_count > real_newlines_count)) or has_literal_quotes:
            fixed_files[name] = (
                content
                .replace('\\n', '\n')
                .replace('\\t', '\t')
                .replace('\\"', '"')
                .replace("\\'", "'")
                .replace('\\\\', '\\')
            )
        else:
            fixed_files[name] = content
    return {"files": fixed_files}

def extract_json(content: str, task: str = ""):
    try:
        fenced_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content, re.IGNORECASE)
        source = fenced_match.group(1) if fenced_match else content
        
        start = source.find("{")
        end = source.rfind("}")
        if start != -1 and end != -1:
            json_part = source[start:end+1]
            repaired_json = repair_json_string(json_part)
            data = json.loads(repaired_json)
            if isinstance(data, dict):
                if task in ["website", "website_edit"]:
                    if "files" in data:
                        return unescape_file_contents(data)
                    return unescape_file_contents({"files": data})
                return data
            return data
    except Exception as e:
        print(f"JSON parsing failed, trying markdown extraction fallback: {e}")

    if task in ["website", "website_edit"]:
        files = parse_markdown_files(content)
        if files:
            return unescape_file_contents({"files": files})
        raise Exception("AI response did not contain valid JSON or Markdown code files")
        
    raise Exception("AI response did not contain valid JSON")

@app.get("/api/ai/generate")
async def get_providers():
    try:
        return {"providers": get_configured_providers_list()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/chat")
async def chat(request: Request):
    try:
        body = await request.json()
        model = body.get("model")
        messages = body.get("messages", [])
        files_context = body.get("filesContext", "")
        
        sys_prompts = [
            "You are NeuroFlow AI inside a workspace SaaS.",
            "Be concise, useful, and practical. Use Markdown where it helps."
        ]
        if files_context:
            sys_prompts.append(f"Attached workspace context:\n{files_context[:6000]}")
        sys_prompt = "\n\n".join(sys_prompts)
        
        full_messages = [{"role": "system", "content": sys_prompt}] + messages[-12:]
        
        # Run blocking API call in a thread to avoid deadlocking the event loop
        result = await asyncio.to_thread(generate_ai_text, full_messages, model)
        return result
    except Exception as e:
        err_msg = str(e)
        status_code = 503 if "No AI provider key" in err_msg else 502
        return JSONResponse(status_code=status_code, content={"error": err_msg})

@app.post("/api/ai/generate")
async def generate(request: Request):
    try:
        body = await request.json()
        task = body.get("task", "")
        input_data = body.get("input", {})
        
        instruction = TASK_INSTRUCTIONS.get(task)
        if not instruction:
            raise HTTPException(status_code=400, detail="Unsupported AI generation task")
        
        query = input_data.get("query", "") if isinstance(input_data, dict) else ""
        
        if task == "companion" and isinstance(input_data, dict):
            history_str = ""
            history = input_data.get("history", [])
            for msg in history:
                sender = "User" if msg.get("sender") == "user" else "Newton"
                history_str += f"{sender}: {msg.get('text')}\n"
            
            prompt_content = f"""{instruction}

Recent conversation history:
{history_str or "No previous history."}

New query from User:
{query}

Input:
{json.dumps(input_data or {})[:24000]}"""
        else:
            prompt_content = f"{instruction}\n\nInput:\n{json.dumps(input_data or {})[:24000]}"
        
        if task == "research" and query.strip():
            search_results = search_web(query)
            prompt_content = f"""{instruction}

Here are real-time, actual live web search results for the query "{query}":
{json.dumps(search_results)}

Input:
{json.dumps(input_data or {})[:24000]}

Please synthesize the above web search results to write an exhaustive, deep, and complete A-to-Z Markdown report without any truncation or summarization. Ensure that:
1. The report is written as an in-depth, professional guide containing all facts, background details, statistics, and sub-analyses from the search results.
2. Every fact, statistic, metric, and value mentioned in the report is real and factually correct based on the search results.
3. The "sources" array contains the exact URL, title, and domain from the real search results above. Do not invent any URLs.
4. If no search results are found or are relevant, still produce a detailed report but mark the sources array empty."""

        requested_model = get_model_for_task(task)
        max_tokens = get_max_tokens_for_task(task)

        system_instruction = "You are the generation engine for NeuroFlow AI. CRITICAL: Return ONLY strict, valid JSON. No prose, no markdown fences, no backticks, no explanatory text before or after the JSON. The response must start with { and end with }. Keep outputs practical, specific, and production-quality."
        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": prompt_content}
        ]
        
        # Run blocking API call in a thread to avoid deadlocking the event loop
        res = await asyncio.to_thread(generate_ai_text, messages, requested_model, max_tokens, task)
        try:
            content_json = extract_json(res["content"], task)
        except Exception as parse_err:
            print("--- JSON EXTRACTION FAILED IN PYTHON BACKEND ---")
            print("Raw content:", res["content"])
            print("-----------------------------------------------")
            raise parse_err
        
        return {
            "result": content_json,
            "provider": res["provider"],
            "model": res["model"]
        }
    except Exception as e:
        err_msg = str(e)
        status = 502
        if "No AI provider key" in err_msg:
            status = 503
        elif "401" in err_msg or "403" in err_msg:
            status = 401
        elif "429" in err_msg:
            status = 429
        elif "timed out" in err_msg or "timeout" in err_msg.lower():
            status = 504
        return JSONResponse(status_code=status, content={"error": err_msg})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
