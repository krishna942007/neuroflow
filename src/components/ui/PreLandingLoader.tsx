"use client";

import { useEffect, useState } from "react";

const CINEMATIC_READY_EVENT = "neuroflow:cinematic-ready";

export default function PreLandingLoader() {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    let pageReady = document.readyState === "complete";
    let cinematicReady = false;
    let animationFrame = 0;
    let displayedProgress = 0;
    const startedAt = performance.now();
    const minVisibleMs = 900;
    const maxWaitMs = 4200;

    const markPageReady = () => {
      pageReady = true;
    };

    const markCinematicReady = () => {
      cinematicReady = true;
    };

    window.addEventListener("load", markPageReady, { once: true });
    window.addEventListener(CINEMATIC_READY_EVENT, markCinematicReady);

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const ready = (pageReady && cinematicReady && elapsed >= minVisibleMs) || elapsed >= maxWaitMs;
      const waitingTarget = Math.min(94, 12 + (elapsed / maxWaitMs) * 82);
      const targetProgress = ready ? 100 : waitingTarget;

      displayedProgress += (targetProgress - displayedProgress) * 0.09;

      if (ready && displayedProgress > 99.35) {
        setProgress(100);
        setIsExiting(true);
        window.setTimeout(() => setIsHidden(true), 650);
        return;
      }

      setProgress(Math.min(ready ? 100 : 94, Math.floor(displayedProgress)));
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("load", markPageReady);
      window.removeEventListener(CINEMATIC_READY_EVENT, markCinematicReady);
    };
  }, []);

  if (isHidden) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#041E05] transition-opacity duration-700 ${
        isExiting ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-live="polite"
      aria-busy={!isExiting}
    >
      <div className="w-full max-w-xs px-8 text-center">
        <div className="mb-7 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#E0D6C6]/60">
          Preparing Zen Space
        </div>

        <div className="font-display text-7xl font-semibold tracking-[-0.08em] text-[#FBF5DD]">
          {progress}
          <span className="ml-1 text-2xl text-[#E0D6C6]/70">%</span>
        </div>

        <div className="mt-8 h-px overflow-hidden rounded-full bg-[#FBF5DD]/15">
          <div
            className="h-full rounded-full bg-[#E0D6C6] transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
