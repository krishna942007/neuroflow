# Workspace Enhancements Design Spec

This document details the enhancements and bug fixes for the AI SaaS Workspace platform, covering React Sandbox compilation errors, Presentation theme styles, slide change animations, Dock alignment, mobile layout improvements, and Google/personal auth database sync.

## 1. Sandbox Compilation & React Hook Fixes
*   **Problem**: Iframe sandboxes in the Website module load `react-dom` and other libraries from `esm.sh` independently, which causes React to initialize multiple times and throws `Warning: Invalid hook call`.
*   **Solution**: Update the `importMap` inside [WebsiteModule.tsx](file:///c:/Users/Krishna%20Singh/Desktop/Cdac/ai%20saas/src/components/workspace/WebsiteModule.tsx) (`bundleWebProject` helper) to query dependencies with `?external=react`. E.g., `https://esm.sh/react-dom@18.3.1?dev&external=react` and `https://esm.sh/lucide-react@0.344.0?external=react`. This forces the browser to resolve React dependencies from the single React entry in the import map.

## 2. Dynamic Slide Themes & Animations
*   **Themes Refactoring**: Revamp the theme list in [PresentationModule.tsx](file:///c:/Users/Krishna%20Singh/Desktop/Cdac/ai%20saas/src/components/workspace/PresentationModule.tsx) to support dynamic styles:
    *   `titleClass`: Headings gradients/accents.
    *   `subtitleClass`: Subtitle text colors.
    *   `cardClass`: Styling of features/split grid panels (glassmorphism details).
    *   `statsValueClass`: Numbers gradient styling.
    *   `bulletDot` and `accentLine`: Accent element styles.
    *   `textNormal` and `textMuted`: Muted or regular paragraph text colors.
    *   `blobs`: Floating color liquid blobs (absolute divs) positioned in the background.
*   **CSS Animations**: Add keyframes for `liquid-slow` and `liquid-medium` in [globals.css](file:///c:/Users/Krishna%20Singh/Desktop/Cdac/ai%20saas/src/app/globals.css) to animate floating blobs.
*   **Slide Transitions**: Wrap the active slide card content in `<AnimatePresence mode="wait">` and `<motion.div>` to animate slide changes with a defocus blur, horizontal translation, and opacity fade.

## 3. Stuck Code Editor Fix
*   **Problem**: The markdown editor inside [PresentationModule.tsx](file:///c:/Users/Krishna%20Singh/Desktop/Cdac/ai%20saas/src/components/workspace/PresentationModule.tsx) has desynced character positioning, lacks scroll-sync for line numbers, and overlay highlights.
*   **Solution**: 
    *   Enforce identical monospace fonts (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`), font-size (`text-xs`), and exact `20px` line-heights in both the `<textarea>`, `<pre>`, and line numbers.
    *   Add scroll-sync handler (`handleEditorScroll`) on the `<textarea>` to update `preRef.current.scrollTop/scrollLeft` and `lineNumbersRef.current.scrollTop`.
    *   Set `wrap="off"` on textarea and pre tag styles.

## 4. Centering the Dock
*   **Problem**: The bottom Dock is absolute positioned at `left-1/2 -translate-x-1/2` relative to the screen, which makes it off-center when the 256px wide left sidebar is open.
*   **Solution**: Shift the Dock's absolute container based on the sidebar's open state:
    *   `isSidebarOpen ? "left-1/2 lg:left-[calc(50%+136px)] -translate-x-1/2" : "left-1/2 -translate-x-1/2"`
    *   This centers it relative to the remaining main workspace width.

## 5. Mobile Responsiveness
*   **Sidebar**: Float the sidebar as an absolute overlay on mobile screens: `lg:relative absolute top-4 left-4 h-[calc(100vh-2rem)] z-50 shadow-2xl transition-all`.
*   **Dock**: Reduce item padding (`p-2.5 md:p-3`) and icon sizes (`h-4 w-4 md:h-4.5 md:w-4.5`) on small screens.
*   **Main Container**: Adjust spacing on mobile so it takes the full width and isn't squished when the sidebar toggles.

## 6. Secure Server-Side Keys & Database Sync
*   **Security**: Verify all sensitive API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, etc.) reside in `.env` and are strictly fetched server-side in API routes.
*   **Google Sign-In Account Chooser**: Update `AuthScreen.tsx`'s Google Sign-In popup with an interactive Google account selector containing multiple profiles and a "+ Use another account" input form.
*   **Database Profile Hydration**: On login, parse and preserve user details (avatar, role, plan) in `authStore.ts` and populate `workspaceStore` with their synced workspace state retrieved from the database.
