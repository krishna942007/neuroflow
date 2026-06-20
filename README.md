# NeuroFlow AI — The Ultimate AI Workspace SaaS

NeuroFlow AI is a premium, full-stack inspired, production-ready AI Workspace SaaS platform. It combines conversational AI engines, web search scrapers, resume intelligence toolkits, study widgets, landing page sandboxes, and slideshow generators in a unified, glassmorphic layout.

---

## 🚀 Key Features

1. **AI Chat Assistant:** Multi-model streaming chats (Gemini, Claude, GPT, DeepSeek, local Ollama) with custom token memory sliders, file attachments, and speech recognition simulation.
2. **AI Research Agent (Perplexity Style):** Fact-crawling indexer detailing verified source citations, progress step indicators, and markdown analysis report compilers.
3. **AI Resume Intelligence Suite:** ATS score analyzer, job description compatibility gauges, action-oriented bullet rewriters, cover letter forms, and LinkedIn profile optimizers.
4. **AI Study Assistant:** Upload document PDF files to generate interactive flashcards, multiple-choice quizzes, term glossary lists, and revision outline checklists.
5. **AI Website Designer:** A split-screen prompt sandbox detailing source codes and a live sandbox iframe preview injecting Tailwind CSS CDN dynamically.
6. **AI Presentation Generator:** Custom visual slide deck outlines, bullet points editor cards, and pptx download triggers.
7. **Apple-style Floating Dock Navigation:** Smooth scale transitions to switch views between modules instantly.
8. **Ctrl+K Command Palette:** Keyboard-driven search panel scanning active workspace files, folder structures, chats, and commands.
9. **Interactive 3D Aurora Background:** Dynamic WebGL canvas using Three.js & React Three Fiber shaders that cycle sky colors based on sunset cycles.
10. **Analytics & Admin Console:** Mock MRT billing logs, active subscriber charts, API query indicators, and custom HSL progress meters.

---

## 🛠️ Tech Stack

* **Core Framework:** Next.js 15 (App Router), React 19, TypeScript
* **Styling & UI:** Tailwind CSS v4, Framer Motion (animations), Lucide Icons
* **State Management:** Zustand, LocalStorage persistence
* **Graphics Rendering:** Three.js, React Three Fiber (R3F)

---

## 📁 Project Directory Layout

```text
/ (Workspace Root)
├── public/                 # Static assets, next.svg, vercel.svg
├── src/
│   ├── app/                # Next.js Pages & Layouts
│   │   ├── workspace/      # Dashboard and Module routes
│   │   ├── globals.css     # CSS tokens, glassmorphism templates, animations
│   │   ├── layout.tsx      # Root HTML wrapper
│   │   └── page.tsx        # High-fidelity 3D Aurora landing page
│   ├── components/         # Modular React components
│   │   ├── canvas/         # Three.js 3D Aurora sky shader background
│   │   ├── dashboard/      # Team sharing and analytics panels
│   │   └── workspace/      # Chat panels, Perplexity search cards, Resume suites, study notes, templates builders
│   ├── lib/
│   │   └── store/          # Zustand State containers (auth, chats, workspaces, ui)
│   └── types/              # Type definitions
├── package.json
└── README.md
```

---

## 💻 Local Setup & Development

### Prerequisites
* **Node.js** v24+
* **NPM** v11+

### Installation
1. Clone this repository to your local computer path.
2. In the root workspace, install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Run the hot-reloading development server:
   ```bash
   npm run dev
   ```
4. Navigate your browser to [http://localhost:3000](http://localhost:3000) to view the landing page. Click **"Launch Workspace"** or **"Start Free"** to enter the workspace panels.
