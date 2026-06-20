# Stitch API Website Generation Design

This document details the implementation plan for replacing the generic LLM-based website generation and editing features with the Google Stitch API.

## Goal

Use the Google Stitch API (`@google/stitch-sdk`) to generate premium web page designs and perform design edits inside the NeuroFlow AI Website IDE Sandbox.

## Design Details

### 1. Environment Variable Setup
Add `STITCH_API_KEY` to the `.env` file to authenticate calls to `stitch.googleapis.com`.

### 2. Next.js API Routes Integration
- Bypass the Python FastAPI backend proxy for `website` and `website_edit` tasks.
- Install `@google/stitch-sdk` npm package.
- Initialize the Stitch client using `process.env.STITCH_API_KEY`.
- Generate code by calling `stitch.createProject("NeuroFlow Web Designs")` and `project.generate(prompt)`.
- Fetch the compiled HTML via the download URL returned by `screen.getHtml()`.
- Append metadata comments (`<!-- STITCH_PROJECT_ID: ... -->` and `<!-- STITCH_SCREEN_ID: ... -->`) to `index.html` to allow state preservation for edits.
- Implement editing by extracting metadata comments and calling `screen.edit(prompt)`.

### 3. Streaming Response Support
- Implement the same flow in the Server-Sent Events (SSE) route `/api/ai/generate/stream`.
- Send clear progress updates (SSE events) to show the user each stage of the design pipeline.
