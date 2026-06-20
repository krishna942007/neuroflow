"use client";
 
import React from "react";
import { motion, useMotionValue, useMotionTemplate, useTransform } from "framer-motion";
 
interface LiquidGlassCardProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  innerClassName?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  material?: "frosted" | "matte" | "liquid" | "crystal";
}
 
export default function LiquidGlassCard({ 
  children, 
  className = "p-5", 
  containerClassName = "",
  innerClassName = "",
  onClick,
  style = {},
  material = "liquid"
}: LiquidGlassCardProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
 
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };
 
  // Slow parallax reflection offsets
  const sheenX = useTransform(mouseX, [0, 500], [-25, 25]);
  const sheenY = useTransform(mouseY, [0, 500], [-25, 25]);
  const sheenTransform = useMotionTemplate`translate(${sheenX}px, ${sheenY}px)`;
 
  const materialContainerBorders = {
    frosted: "rgba(251, 245, 221, 0.06)",
    matte: "rgba(251, 245, 221, 0.04)",
    liquid: "rgba(251, 245, 221, 0.08)",
    crystal: "rgba(255, 255, 255, 0.18)"
  };
 
  const materialClasses = {
    frosted: "material-frosted",
    matte: "material-matte",
    liquid: "material-liquid",
    crystal: "material-crystal"
  };
 
  return (
    <div
      onMouseMove={handleMouseMove}
      onClick={onClick}
      className={`group relative rounded-2xl p-[1px] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] overflow-hidden liquid-glass-card ${
        onClick ? "cursor-pointer" : ""
      } ${containerClassName}`}
      style={{
        background: materialContainerBorders[material],
        ...style
      }}
    >
      {/* Spotlight Border Glow */}
      {material !== "matte" && (
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition duration-300 z-0"
          style={{
            background: useMotionTemplate`
              radial-gradient(
                120px circle at ${mouseX}px ${mouseY}px,
                rgba(var(--spotlight-color, 251, 245, 221), var(--spotlight-border-opacity, 0.25)),
                transparent 80%
              )
            `,
          }}
        />
      )}
 
      {/* Core Body Container */}
      <div className={`relative rounded-[15px] h-full w-full z-10 overflow-hidden text-[#E0D6C6] ${materialClasses[material]} ${className}`}>
        
        {/* Spotlight Content Glow */}
        {material !== "matte" && (
          <motion.div
            className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 z-0"
            style={{
              background: useMotionTemplate`
                radial-gradient(
                  200px circle at ${mouseX}px ${mouseY}px,
                  rgba(var(--spotlight-color, 231, 225, 177), var(--spotlight-content-opacity, 0.15)),
                  transparent 80%
                )
              `,
            }}
          />
        )}
 
        {/* Dynamic Sheen Streak - Liquid / Crystal Glass reflections */}
        {(material === "liquid" || material === "crystal") && (
          <motion.div
            className="pointer-events-none absolute -inset-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0 bg-gradient-to-tr from-transparent via-white/[0.035] to-transparent pointer-events-none"
            style={{
              transform: sheenTransform,
              mixBlendMode: "overlay"
            }}
          />
        )}
 
        {/* Children content wrapper */}
        <div className={`relative z-10 font-sans ${innerClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
