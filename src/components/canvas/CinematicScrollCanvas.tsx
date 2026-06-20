"use client";

import React, { useEffect, useRef, useState } from "react";
import Lenis from "lenis";

// Use the high-quality compressed video source
const SCENE_VIDEO = "/scenes/Bgnew_smooth_intra.mp4";
const SCENE_POSTER = "/scenes/frames/frame_0000.webp";
const SCENE_END = 0.65;
const SCROLL_LERP = 0.06;
const READY_EVENT = "neuroflow:cinematic-ready";

export default function CinematicScrollCanvas() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // Non-blocking seek queue to prevent decoder lockups during scrub
  const lastTargetTimeRef = useRef<number>(-1);
  const isSeekingRef = useRef<boolean>(false);
  const pendingSeekTimeRef = useRef<number>(-1);

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const shade = shadeRef.current;
    if (!video || !shade) return;

    let rawProg = 0;
    let smoothProg = 0;

    // ── Ready handler ───────────────────────────────────────────────────────
    const handleCanPlay = () => {
      setIsLoaded(true);
      window.dispatchEvent(new Event(READY_EVENT));
    };
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) handleCanPlay();
    video.addEventListener("canplay", handleCanPlay);

    // ── Non-blocking seek scheduler ─────────────────────────────────────────
    const triggerSeek = (time: number) => {
      if (isSeekingRef.current) {
        pendingSeekTimeRef.current = time;
      } else {
        isSeekingRef.current = true;
        video.currentTime = time;
        lastTargetTimeRef.current = time;
      }
    };

    const onSeeked = () => {
      isSeekingRef.current = false;
      if (pendingSeekTimeRef.current !== -1) {
        const next = pendingSeekTimeRef.current;
        pendingSeekTimeRef.current = -1;
        triggerSeek(next);
      }
    };
    video.addEventListener("seeked", onSeeked);

    // ── Lenis smooth scroll integration ──────────────────────────────────────
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = prefersReducedMotion
      ? null
      : new Lenis({
          lerp: 0.10,
          smoothWheel: true,
          syncTouch: false,
          wheelMultiplier: 0.85,
          touchMultiplier: 1.4,
        });

    if (lenis) {
      lenis.on("scroll", ({ progress }: { progress: number }) => {
        rawProg = progress;
      });
    }

    // ── Animation RAF Loop ───────────────────────────────────────────────────
    const render = (ts: number) => {
      if (lenis) {
        lenis.raf(ts);
      } else {
        const range = document.documentElement.scrollHeight - window.innerHeight;
        rawProg = range > 0 ? window.scrollY / range : 0;
      }

      // Smooth progress with LERP
      smoothProg += (rawProg - smoothProg) * SCROLL_LERP;
      const sp = Math.max(0, Math.min(1, smoothProg));

      // Map scroll progress to video time (capped slightly before actual duration)
      if (
        video.readyState >= HTMLMediaElement.HAVE_METADATA &&
        Number.isFinite(video.duration) &&
        video.duration > 0
      ) {
        const sceneProgress = Math.min(1, sp / SCENE_END);
        // Map to exact target time
        const targetTime = sceneProgress * (video.duration - 0.016);
        if (Math.abs(targetTime - lastTargetTimeRef.current) > 0.001) {
          triggerSeek(targetTime);
        }
      }

      // Ambient shade overlay (fade in after 60% scroll)
      const targetOpacity = Math.max(0, Math.min(0.90, (sp - 0.60) * 2.6));
      shade.style.opacity = targetOpacity.toFixed(4);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (lenis) lenis.destroy();
      cancelAnimationFrame(rafRef.current);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("seeked", onSeeked);
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        className="fixed inset-0 z-0 h-full w-full object-cover pointer-events-none"
        src={SCENE_VIDEO}
        poster={SCENE_POSTER}
        preload="auto"
        muted
        playsInline
        disablePictureInPicture
        style={{
          backfaceVisibility: "hidden",
        }}
        aria-hidden="true"
      />

      {/* Center-aligned logo overlay over the background video's sparkle */}
      {isLoaded && (
        <div
          className="fixed z-10 pointer-events-none"
          style={{
            top: "90%",
            left: "92.3%",
            transform: "translate(-50%, -50%)",
            width: "65px",
            height: "65px",
            opacity: "1.0",
          }}
        >
          <img
            src="/logo.png"
            alt="Brand Logo Overlay"
            className="h-full w-full object-contain"
          />
        </div>
      )}

      {/* Ambient dark gradient overlay */}
      <div
        ref={shadeRef}
        className="fixed inset-0 z-[1] pointer-events-none bg-[#041E05] opacity-0"
        style={{ willChange: "opacity" }}
        aria-hidden="true"
      />

      {/* Loading cover to prevent unstyled flash */}
      {!isLoaded && (
        <div
          className="fixed inset-0 z-[2] pointer-events-none"
          style={{
            background: `url(${SCENE_POSTER}) center center / cover no-repeat`,
            filter: "brightness(0.92) saturate(1.15)",
          }}
        />
      )}
    </>
  );
}
