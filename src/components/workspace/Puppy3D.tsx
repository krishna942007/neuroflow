"use client";

import React, { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useUIStore, CompanionState } from "@/lib/store/uiStore";

// ── 3D PROCEDURAL PUPPY MODEL (SHARED) ────────────────────────────────────────
interface PuppyModelProps {
  companionState: CompanionState;
  isSitting: boolean;
  furColor: string;
  collarColor: string;
  earType: "floppy" | "perked";
  dogScale: number;
  globalPointerRef: React.RefObject<{ x: number; y: number }>;
  headOnly?: boolean;
  puppyGroupRef: React.RefObject<THREE.Group | null>;
}

function PuppyModel({ 
  companionState, 
  isSitting, 
  furColor, 
  collarColor, 
  earType, 
  dogScale, 
  globalPointerRef,
  headOnly = false,
  puppyGroupRef 
}: PuppyModelProps) {
  const headRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);
  const earLRef = useRef<THREE.Group>(null);
  const earRRef = useRef<THREE.Group>(null);
  const legFLRef = useRef<THREE.Group>(null);
  const legFRRef = useRef<THREE.Group>(null);
  const legBLRef = useRef<THREE.Group>(null);
  const legBRRef = useRef<THREE.Group>(null);

  // Animate elements procedurally in R3F render loop
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const isFloppy = earType === "floppy";

    // 1. Position/Bounce adjustments
    if (puppyGroupRef.current) {
      if (headOnly) {
        puppyGroupRef.current.position.set(0, 0, 0);
      } else {
        if (companionState === "excited") {
          // Joyful dog bounce jumping
          puppyGroupRef.current.position.y = -0.2 + Math.abs(Math.sin(time * 8.5)) * 0.24;
        } else if (companionState === "sad") {
          // Droop down slightly
          puppyGroupRef.current.position.y = -0.28;
        } else {
          puppyGroupRef.current.position.y = -0.2;
        }
      }
    }

    // 2. Body animations (ignore if headOnly)
    if (bodyRef.current && !headOnly) {
      if (companionState === "sleeping") {
        bodyRef.current.position.y = -0.45;
        bodyRef.current.rotation.x = Math.PI / 2.3;
        bodyRef.current.scale.y = 1.0 + Math.sin(time * 1.5) * 0.015;
      } else if (isSitting) {
        bodyRef.current.position.y = -0.3;
        bodyRef.current.rotation.x = Math.PI / 8;
        bodyRef.current.scale.y = 1.0 + Math.sin(time * 2.2) * 0.02;
      } else {
        bodyRef.current.position.y = -0.1 + Math.sin(time * 2.2) * 0.015;
        bodyRef.current.rotation.x = 0;
        bodyRef.current.scale.y = 1.0 + Math.sin(time * 2.2) * 0.02;
      }
    }

    // 3. Head group cursor-tracking & breathing rotation
    if (headRef.current) {
      if (companionState === "sleeping") {
        if (headOnly) {
          headRef.current.position.set(0, 0, 0);
          headRef.current.rotation.set(0.1, 0, -0.05);
        } else {
          headRef.current.position.y = -0.15;
          headRef.current.position.z = 0.45;
          headRef.current.rotation.x = 0.2;
          headRef.current.rotation.y = 0;
          headRef.current.rotation.z = -0.15;
        }
      } else {
        // Track the global coordinates ref [-1 to 1]
        const pointerX = globalPointerRef.current?.x ?? 0;
        const pointerY = globalPointerRef.current?.y ?? 0;
        let targetRx = pointerY * 0.35; // pitch
        let targetRy = pointerX * 0.48; // yaw

        // Sad head tilt down
        if (companionState === "sad") {
          targetRx = 0.3;
          targetRy *= 0.4;
        }

        headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, targetRx, 0.08);
        headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, targetRy, 0.08);
        
        if (headOnly) {
          headRef.current.position.set(0, 0, 0);
        } else if (isSitting) {
          headRef.current.position.y = 0.45 + Math.sin(time * 2.2) * 0.01;
          headRef.current.position.z = 0.1;
        } else {
          headRef.current.position.y = 0.65 + Math.sin(time * 2.2) * 0.01;
          headRef.current.position.z = 0.2;
        }
        
        // Head rotation Z sways / emotions
        if (companionState === "excited") {
          headRef.current.rotation.z = Math.sin(time * 12) * 0.12;
        } else if (companionState === "naughty") {
          headRef.current.rotation.z = Math.sin(time * 6.5) * 0.18; // cute wiggle
        } else if (companionState === "confused") {
          headRef.current.rotation.z = 0.28; // Cute tilt
        } else if (companionState === "thinking") {
          headRef.current.rotation.z = Math.sin(time * 2.5) * 0.06; // Slow thoughtful sway
        } else {
          headRef.current.rotation.z = 0;
        }
      }
    }

    // 4. Tail wagging oscillation (ignore if headOnly)
    if (tailRef.current && !headOnly) {
      if (companionState === "sleeping") {
        tailRef.current.rotation.z = 0;
        tailRef.current.rotation.y = -0.3;
      } else if (companionState === "sad") {
        tailRef.current.rotation.x = 1.1; // tucked low
        tailRef.current.rotation.y = Math.sin(time * 1.5) * 0.05; // tiny sad twitch
      } else if (companionState === "naughty") {
        tailRef.current.rotation.x = time * 20; // rapid helicopter spin
        tailRef.current.rotation.y = Math.sin(time * 30) * 0.4;
      } else {
        const wagSpeed = (companionState === "happy" || companionState === "excited") ? 22.0 : 
                         (companionState === "thinking") ? 1.5 : 3.0;
        const wagAmp = (companionState === "happy" || companionState === "excited") ? 0.65 : 
                       (companionState === "confused" || companionState === "thinking") ? 0.02 : 0.08;
        tailRef.current.rotation.y = Math.sin(time * wagSpeed) * wagAmp;
        
        // Spin tail if spinning trick is active
        if (companionState === "spinning") {
          tailRef.current.rotation.x = time * 24;
        } else {
          tailRef.current.rotation.x = 0.4;
        }
      }
    }

    // 5. Ear movement twitching / expressions
    if (earLRef.current && earRRef.current) {
      if (companionState === "sleeping") {
        earLRef.current.rotation.z = isFloppy ? 0.3 : -0.2;
        earRRef.current.rotation.z = isFloppy ? -0.3 : 0.2;
      } else if (companionState === "sad") {
        earLRef.current.rotation.z = isFloppy ? 0.55 : -0.1;
        earRRef.current.rotation.z = isFloppy ? -0.55 : 0.1;
        earLRef.current.rotation.x = 0.25;
        earRRef.current.rotation.x = 0.25;
      } else if (companionState === "naughty") {
        // One ear up, one ear down
        earLRef.current.rotation.z = isFloppy ? -0.1 : -0.65;
        earRRef.current.rotation.z = isFloppy ? -0.55 : 0.15;
      } else if (companionState === "excited") {
        earLRef.current.rotation.z = (isFloppy ? 0.1 : -0.4) + Math.sin(time * 18) * 0.15;
        earRRef.current.rotation.z = (isFloppy ? -0.1 : 0.4) - Math.sin(time * 18) * 0.15;
      } else if (companionState === "confused") {
        earLRef.current.rotation.z = isFloppy ? -0.15 : -0.5;
        earRRef.current.rotation.z = isFloppy ? -0.55 : 0.1;
      } else if (companionState === "thinking") {
        earLRef.current.rotation.z = (isFloppy ? 0 : -0.3) + Math.sin(time * 3.5) * 0.04 - 0.1;
        earRRef.current.rotation.z = (isFloppy ? 0 : 0.3) - Math.sin(time * 3.5) * 0.04 + 0.1;
      } else {
        const earTwitch = Math.sin(time * 1.5) > 0.95 ? Math.sin(time * 35) * 0.06 : 0;
        earLRef.current.rotation.z = (isFloppy ? 0.2 : -0.35) + earTwitch;
        earRRef.current.rotation.z = (isFloppy ? -0.2 : 0.35) - earTwitch;
        earLRef.current.rotation.x = 0;
        earRRef.current.rotation.x = 0;
      }
    }

    // 6. Leg swing Running animations (ignore if headOnly)
    if (legFLRef.current && legFRRef.current && legBLRef.current && legBRRef.current && !headOnly) {
      if (companionState === "sleeping") {
        legFLRef.current.rotation.x = -Math.PI / 2.5;
        legFRRef.current.rotation.x = -Math.PI / 2.5;
        legBLRef.current.rotation.x = Math.PI / 2.5;
        legBRRef.current.rotation.x = Math.PI / 2.5;
      } else if (isSitting) {
        legFLRef.current.rotation.x = -Math.PI / 2.8;
        legFRRef.current.rotation.x = -Math.PI / 2.8;
        legBLRef.current.rotation.x = 0;
        legBRRef.current.rotation.x = 0;
      } else if (companionState === "fetching" || companionState === "eating" || companionState === "spinning") {
        const speedMultiplier = 14.0;
        legFLRef.current.rotation.x = Math.sin(time * speedMultiplier) * 0.5;
        legFRRef.current.rotation.x = -Math.sin(time * speedMultiplier) * 0.5;
        legBLRef.current.rotation.x = -Math.sin(time * speedMultiplier) * 0.5;
        legBRRef.current.rotation.x = Math.sin(time * speedMultiplier) * 0.5;
      } else {
        legFLRef.current.rotation.x = 0;
        legFRRef.current.rotation.x = 0;
        legBLRef.current.rotation.x = 0;
        legBRRef.current.rotation.x = 0;
      }
    }
  });

  const isFloppy = earType === "floppy";

  return (
    <group ref={puppyGroupRef} scale={[dogScale, dogScale, dogScale]} position={headOnly ? [0, 0, 0] : [0, 0.1, 0]}>
      {/* Ambient environment setup inside group */}
      <ambientLight intensity={1.2} />
      <directionalLight 
        position={[4, 5, 3]} 
        intensity={1.5} 
        castShadow={!headOnly}
        shadow-mapSize={[1024, 1024]} 
      />
      <pointLight position={[-3, 2, 2]} intensity={0.4} color="#ffcbd1" />

      {/* ── 1. BODY (Hidden if headOnly) ── */}
      {!headOnly && (
        <group ref={bodyRef}>
          {/* Main Body cylinder */}
          <mesh castShadow receiveShadow>
            <capsuleGeometry args={[0.36, 0.65, 8, 16]} />
            <meshStandardMaterial color={furColor} roughness={0.5} />
          </mesh>
          
          {/* Fluffy white bib overlay */}
          <mesh position={[0, 0.15, 0.22]} scale={[0.8, 0.6, 0.6]} castShadow receiveShadow>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#fcf8f2" roughness={0.6} />
          </mesh>

          {/* Collar ring */}
          <mesh position={[0, 0.38, 0.1]} rotation={[0.4, 0, 0]} castShadow>
            <torusGeometry args={[0.35, 0.05, 8, 24]} />
            <meshStandardMaterial color={collarColor} roughness={0.4} />
          </mesh>
          
          {/* Golden tag */}
          <mesh position={[0, 0.26, 0.36]} castShadow>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      )}

      {/* ── 2. HEAD GROUP ── */}
      <group ref={headRef}>
        {/* Main Head ball */}
        <mesh castShadow={!headOnly}>
          <sphereGeometry args={[0.48, 24, 24]} />
          <meshStandardMaterial color={furColor} roughness={0.5} />
        </mesh>

        {/* White Forehead Stripe/Blaze */}
        <mesh position={[0, 0.18, 0.32]} scale={[0.25, 0.6, 0.4]} castShadow={!headOnly}>
          <sphereGeometry args={[0.3, 12, 12]} />
          <meshStandardMaterial color="#fcf8f2" roughness={0.6} />
        </mesh>

        {/* Left ear */}
        <group 
          ref={earLRef} 
          position={[-0.32, 0.38, 0]} 
          rotation={isFloppy ? [0, 0, 0.25] : [0, 0, -0.35]}
        >
          <mesh castShadow={!headOnly}>
            <coneGeometry args={[0.16, 0.35, 4]} />
            <meshStandardMaterial color={furColor} roughness={0.5} />
          </mesh>
          {/* Inner ear pink detail */}
          <mesh position={isFloppy ? [0.02, -0.05, 0.08] : [0, 0, 0.08]} scale={[0.7, 0.7, 0.2]} castShadow={!headOnly}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#ffcbd1" roughness={0.6} />
          </mesh>
        </group>

        {/* Right ear */}
        <group 
          ref={earRRef} 
          position={[0.32, 0.38, 0]} 
          rotation={isFloppy ? [0, 0, -0.25] : [0, 0, 0.35]}
        >
          <mesh castShadow={!headOnly}>
            <coneGeometry args={[0.16, 0.35, 4]} />
            <meshStandardMaterial color={furColor} roughness={0.5} />
          </mesh>
          {/* Inner ear pink detail */}
          <mesh position={isFloppy ? [-0.02, -0.05, 0.08] : [0, 0, 0.08]} scale={[0.7, 0.7, 0.2]} castShadow={!headOnly}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#ffcbd1" roughness={0.6} />
          </mesh>
        </group>

        {/* Muzzle / Snout */}
        <mesh position={[0, -0.08, 0.34]} scale={[1, 0.8, 1.2]} castShadow={!headOnly}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color="#fcf8f2" roughness={0.5} />
        </mesh>

        {/* Nose */}
        <mesh position={[0, -0.04, 0.52]} castShadow={!headOnly}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#162c18" roughness={0.1} metalness={0.3} />
        </mesh>

        {/* Pink tongue */}
        {(companionState === "happy" || companionState === "excited" || companionState === "naughty") && (
          <mesh position={[0, -0.18, 0.44]} rotation={[0.2, 0, 0]} castShadow={!headOnly}>
            <capsuleGeometry args={[0.045, 0.09, 4, 8]} />
            <meshStandardMaterial color="#ff6b8b" roughness={0.4} />
          </mesh>
        )}

        {/* Eyes (Left & Right) - Closed when sleeping */}
        <group scale-y={companionState === "sleeping" ? 0.1 : 1.0}>
          {/* Left Eye */}
          <mesh position={[-0.18, 0.08, 0.38]} castShadow={!headOnly}>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshStandardMaterial color="#162c18" roughness={0.05} />
          </mesh>
          {companionState !== "sleeping" && (
            <mesh position={[-0.16, 0.12, 0.42]}>
              <sphereGeometry args={[0.02, 6, 6]} />
              <meshStandardMaterial color="#F0E8DC" roughness={0.1} />
            </mesh>
          )}

          {/* Right Eye */}
          <mesh position={[0.18, 0.08, 0.38]} castShadow={!headOnly}>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshStandardMaterial color="#162c18" roughness={0.05} />
          </mesh>
          {companionState !== "sleeping" && (
            <mesh position={[0.16, 0.12, 0.42]}>
              <sphereGeometry args={[0.02, 6, 6]} />
              <meshStandardMaterial color="#F0E8DC" roughness={0.1} />
            </mesh>
          )}
        </group>

        {/* Cute blush cheeks */}
        {companionState !== "sad" && (
          <>
            <mesh position={[-0.26, -0.08, 0.38]} scale={[1.2, 0.6, 0.2]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color="#ff6b8b" roughness={0.9} transparent opacity={0.45} />
            </mesh>
            <mesh position={[0.26, -0.08, 0.38]} scale={[1.2, 0.6, 0.2]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color="#ff6b8b" roughness={0.9} transparent opacity={0.45} />
            </mesh>
          </>
        )}
      </group>

      {/* ── 3. FOUR FEET (Hidden if headOnly) ── */}
      {!headOnly && (
        <>
          {/* Front Left Foot */}
          <group ref={legFLRef} position={[-0.18, -0.5, 0.2]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.06, 0.07, 0.32, 8]} />
              <meshStandardMaterial color={furColor} roughness={0.5} />
            </mesh>
            <mesh position={[0, -0.16, 0.04]} castShadow>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshStandardMaterial color="#fcf8f2" roughness={0.6} />
            </mesh>
          </group>
          
          {/* Front Right Foot */}
          <group ref={legFRRef} position={[0.18, -0.5, 0.2]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.06, 0.07, 0.32, 8]} />
              <meshStandardMaterial color={furColor} roughness={0.5} />
            </mesh>
            <mesh position={[0, -0.16, 0.04]} castShadow>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshStandardMaterial color="#fcf8f2" roughness={0.6} />
            </mesh>
          </group>

          {/* Back Left Foot */}
          <group ref={legBLRef} position={[-0.18, -0.5, -0.2]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.06, 0.07, 0.32, 8]} />
              <meshStandardMaterial color={furColor} roughness={0.5} />
            </mesh>
            <mesh position={[0, -0.16, 0.04]} castShadow>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshStandardMaterial color="#fcf8f2" roughness={0.6} />
            </mesh>
          </group>

          {/* Back Right Foot */}
          <group ref={legBRRef} position={[0.18, -0.5, -0.2]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.06, 0.07, 0.32, 8]} />
              <meshStandardMaterial color={furColor} roughness={0.5} />
            </mesh>
            <mesh position={[0, -0.16, 0.04]} castShadow>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshStandardMaterial color="#fcf8f2" roughness={0.6} />
            </mesh>
          </group>
        </>
      )}

      {/* ── 4. TAIL (Hidden if headOnly) ── */}
      {!headOnly && (
        <group ref={tailRef} position={[0, -0.15, -0.36]} rotation={[0.4, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.035, 0.05, 0.36, 8]} />
            <meshStandardMaterial color={furColor} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.18, 0]} scale={[1, 0.8, 1]} castShadow>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color="#F0E8DC" roughness={0.6} />
          </mesh>
        </group>
      )}

      {/* ── 5. SHADOW RECEIVER PLANE (Hidden if headOnly) ── */}
      {!headOnly && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.66, 0]} receiveShadow>
          <planeGeometry args={[3, 3]} />
          <shadowMaterial opacity={0.4} />
        </mesh>
      )}
    </group>
  );
}

// ── REUSABLE CANVAS CONTAINER WITH MOUSE TRACKING ──────────────────────────────
interface Puppy3DProps {
  headOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
  cameraPosition?: [number, number, number];
  fov?: number;
}

export default function Puppy3D({ 
  headOnly = false,
  className = "",
  style = {},
  cameraPosition = [0, 0, 4.4],
  fov = 40
}: Puppy3DProps) {
  const companionState = useUIStore((s) => s.companionState);
  const isSitting = useUIStore((s) => s.isSitting);
  const furColor = useUIStore((s) => s.furColor);
  const collarColor = useUIStore((s) => s.collarColor);
  const earType = useUIStore((s) => s.earType);
  const dogScale = useUIStore((s) => s.dogScale);
  const containerRef = useRef<HTMLDivElement>(null);
  const globalPointerRef = useRef({ x: 0, y: 0 });
  const puppyGroupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dogCenterX = rect.left + rect.width / 2;
      const dogCenterY = rect.top + rect.height / 2;
      
      const dx = e.clientX - dogCenterX;
      const dy = e.clientY - dogCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 5) {
        const clampDist = Math.min(dist, 900);
        const factor = clampDist / 900;
        globalPointerRef.current.x = (dx / dist) * factor;
        globalPointerRef.current.y = (dy / dist) * factor;
      } else {
        globalPointerRef.current.x = 0;
        globalPointerRef.current.y = 0;
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`relative select-none ${className}`}
      style={{ width: "100%", height: "100%", ...style }}
    >
      <Canvas
        shadows={!headOnly ? { type: THREE.PCFShadowMap } : false}
        style={{ background: "transparent", width: "100%", height: "100%" }}
        camera={{ position: headOnly ? [0, 0, 1.8] : cameraPosition, fov }}
        gl={{ antialias: true, alpha: true }}
      >
        <PuppyModel
          companionState={companionState}
          isSitting={isSitting}
          furColor={furColor}
          collarColor={collarColor}
          earType={earType}
          dogScale={dogScale}
          globalPointerRef={globalPointerRef}
          headOnly={headOnly}
          puppyGroupRef={puppyGroupRef}
        />
      </Canvas>
    </div>
  );
}
