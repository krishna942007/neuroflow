"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";

/**
 * AuroraOverlay — scroll-driven night sky + aurora + stars overlay.
 * Fades in as user scrolls past 65% toward the pricing section.
 * Uses pure CSS animations — no canvas, no WebGL.
 */
export default function AuroraOverlay() {
  const [opacity, setOpacity] = useState(0);
  const scrollRef = useRef(0);
  const rafRef = useRef<number>(0);

  // Generate deterministic star positions (SSR-safe)
  const stars = useMemo(() => {
    const result: Array<{ x: number; y: number; size: number; delay: number; duration: number }> = [];
    // Simple seedable pseudo-random to avoid hydration mismatches
    let seed = 42;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 60; i++) {
      result.push({
        x: random() * 100,
        y: random() * 70, // Stars in upper 70% of viewport
        size: random() * 1.5 + 0.5,
        delay: random() * 5,
        duration: random() * 3 + 2,
      });
    }
    return result;
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) return;
      scrollRef.current = Math.max(0, Math.min(1, window.scrollY / totalHeight));
    };

    const renderLoop = () => {
      // Aurora fades in from scroll 65% to 85%
      const scroll = scrollRef.current;
      const newOpacity = Math.max(0, Math.min(1, (scroll - 0.65) / 0.2));
      setOpacity(newOpacity);
      rafRef.current = requestAnimationFrame(renderLoop);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    rafRef.current = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (opacity <= 0.001) return null;

  return (
    <div
      className="fixed inset-0 z-[1] pointer-events-none overflow-hidden"
      style={{ opacity, willChange: "opacity" }}
      aria-hidden="true"
    >
      {/* Aurora radial gradients — forest green + cream */}
      <div className="absolute -inset-24 aurora-gradient-1" />
      <div className="absolute -inset-24 aurora-gradient-2" />
      <div className="absolute -inset-24 aurora-gradient-3" />

      {/* Star field */}
      <div className="absolute inset-0 overflow-hidden">
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[#FBF5DD] star-twinkle"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Subtle vignette to ground the aurora */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#041E05] via-transparent to-transparent opacity-60" />
    </div>
  );
}
