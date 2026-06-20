"use client";
 
import React, { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
 
// Custom shader material for the organic scroll-linked sky
const ScrollSkyShader = {
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;
 
    // 2D Simplex Noise for wave heights
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx) ;
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
        dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 a0 = x - floor(x + 0.5);
      vec3 g = sin(h) - 0.5;
      vec3 o = vec3(0.1) + vec3(0.9)*g;
      vec3 r = a0 * vec3(0.85);
      vec3 l = 1.79284291400159 - 0.85373472095314 * ( r*r + h*h );
      vec3 v_noise = vec3(0.0);
      v_noise.x = dot(x0, r.xy);
      v_noise.y = dot(x12.xy, r.xy);
      v_noise.z = dot(x12.zw, r.xy);
      return 130.0 * dot(m, v_noise * l);
    }
 
    void main() {
      vUv = uv;
      
      // Calculate slow wave displacements
      vec2 noiseInput = vec2(position.x * 0.15 + uTime * 0.1, position.y * 0.15);
      float elevation = snoise(noiseInput) * 1.2;
      vElevation = elevation;
      
      vec3 newPosition = position;
      newPosition.z += elevation;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColorDay;
    uniform vec3 uColorSunset;
    uniform vec3 uColorTwilight;
    uniform vec3 uColorNight;
    uniform float uScroll; // 0.0 to 1.0
    uniform float uTime;
    
    varying vec2 vUv;
    varying float vElevation;
 
    // Linear interpolate sky color based on scroll milestones
    vec3 getSkyColor(float scrollVal) {
      if (scrollVal < 0.33) {
        return mix(uColorDay, uColorSunset, scrollVal * 3.0);
      } else if (scrollVal < 0.66) {
        return mix(uColorSunset, uColorTwilight, (scrollVal - 0.33) * 3.0);
      } else {
        return mix(uColorTwilight, uColorNight, (scrollVal - 0.66) * 3.0);
      }
    }
 
    void main() {
      vec3 skyColor = getSkyColor(uScroll);
      
      // Volumetric light scattering mist overlay (adds luxury depth)
      float mistGlow = sin(vUv.x * 8.0 + uTime * 0.08) * cos(vUv.y * 6.0 - uTime * 0.04) * 0.5 + 0.5;
      vec3 mistColor = mix(skyColor, vec3(0.06, 0.28, 0.12), mistGlow * 0.22 * (uScroll + 0.15));
      
      // Aurora waves fade in as user scrolls to pricing (uScroll > 0.7)
      float auroraIntensity = smoothstep(0.68, 1.0, uScroll);
      float auroraGlow = smoothstep(-1.2, 1.2, vElevation);
      
      // Organic forest-green/emerald/cream aurora colors
      vec3 auroraColor1 = vec3(0.05, 0.33, 0.1);  // Forest Green
      vec3 auroraColor2 = vec3(0.18, 0.43, 0.16); // Emerald Green
      vec3 auroraColor3 = vec3(0.91, 0.88, 0.69); // Soft Cream Highlights
      
      float colorMixFactor = sin(vUv.x * 2.5 + uTime * 0.15) * 0.5 + 0.5;
      vec3 mixedAurora = mix(auroraColor1, auroraColor2, colorMixFactor);
      mixedAurora = mix(mixedAurora, auroraColor3, sin(uTime * 0.08) * 0.25 + 0.25);
      
      // Mix aurora light waves overlay
      vec3 finalColor = mix(mistColor, mistColor + mixedAurora * (auroraGlow * 0.7), auroraIntensity);
      
      // Atmospheric edge opacity fade
      float alpha = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
      alpha *= smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
};
 
// GPU shader custom points for volumetric mist drift
const VolumetricMistParticlesShader = {
  vertexShader: `
    uniform float uTime;
    uniform float uScroll;
    varying float vOpacity;
    
    void main() {
      vec3 pos = position;
      
      // Slow organic float/drift using sin/cos of coordinates + uTime
      pos.x += sin(uTime * 0.06 + position.z * 2.0) * 1.5;
      pos.y += cos(uTime * 0.04 + position.x * 2.0) * 1.2;
      pos.z += sin(uTime * 0.03 + position.y * 1.5) * 1.0;
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Volumetric size attenuation
      gl_PointSize = (140.0 / -mvPosition.z) * (sin(uTime * 0.18 + position.y) * 0.35 + 0.65);
      
      // Opacity fades out if too close or too far
      vOpacity = smoothstep(-22.0, -14.0, mvPosition.z) * smoothstep(-1.5, -5.0, mvPosition.z);
      
      // Scale activity based on scroll (richer near bottom pricing aurora glow)
      vOpacity *= (0.4 + uScroll * 0.6);
    }
  `,
  fragmentShader: `
    varying float vOpacity;
    
    void main() {
      // Round particle with radial volumetric glow falloff
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      
      float strength = smoothstep(0.5, 0.0, dist);
      float alpha = strength * 0.09 * vOpacity; // subtle 9% max transparency
      
      // Cream-tinted forest green glow
      vec3 particleColor = mix(vec3(0.91, 0.88, 0.69), vec3(0.08, 0.35, 0.12), dist * 0.45);
      
      gl_FragColor = vec4(particleColor, alpha);
    }
  `
};
 
// Component: Updates shader uniforms and particle layers inside frame loop
function ScrollController({ scrollPercent }: { scrollPercent: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const starsRef = useRef<THREE.PointsMaterial>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const mistParticlesMatRef = useRef<THREE.ShaderMaterial>(null);
 
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms = {
        uTime: { value: 0.0 },
        uScroll: { value: 0.0 },
        uColorDay: { value: new THREE.Color("#FBF5DD") },       // Soft Daylight Cream
        uColorSunset: { value: new THREE.Color("#4a1805") },    // Warm Sunset Red-Brown
        uColorTwilight: { value: new THREE.Color("#0d530e") },  // Deep Emerald Twilight
        uColorNight: { value: new THREE.Color("#041E05") }      // Luxury Space Obsidian Green
      };
    }
    if (mistParticlesMatRef.current) {
      mistParticlesMatRef.current.uniforms = {
        uTime: { value: 0.0 },
        uScroll: { value: 0.0 }
      };
    }
  }, []);
 
  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    if (materialRef.current && materialRef.current.uniforms.uTime) {
      materialRef.current.uniforms.uTime.value = time;
      materialRef.current.uniforms.uScroll.value = scrollPercent;
    }
    if (mistParticlesMatRef.current && mistParticlesMatRef.current.uniforms.uTime) {
      mistParticlesMatRef.current.uniforms.uTime.value = time;
      mistParticlesMatRef.current.uniforms.uScroll.value = scrollPercent;
    }
 
    // Fade in stars as scroll approaches night (scroll > 0.5)
    if (starsRef.current) {
      starsRef.current.opacity = Math.max(0, (scrollPercent - 0.5) * 2.0) * 0.6;
    }
  });
 
  const starCount = 250;
  const [starPositions, setStarPositions] = useState<Float32Array | null>(null);
 
  useEffect(() => {
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20 + 4; // offset upward
      pos[i * 3 + 2] = -10 - Math.random() * 5;
    }
    setTimeout(() => setStarPositions(pos), 0);
  }, []);
 
  // Volumetric Mist Particles
  const mistCount = 90;
  const [mistPositions, setMistPositions] = useState<Float32Array | null>(null);
 
  useEffect(() => {
    const pos = new Float32Array(mistCount * 3);
    for (let i = 0; i < mistCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 32;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 16 + 2;
      pos[i * 3 + 2] = -4 - Math.random() * 8; // closer volumetric plane
    }
    setTimeout(() => setMistPositions(pos), 0);
  }, []);
 
  return (
    <>
      {/* Scroll-Linked Sky Mesh */}
      <mesh ref={meshRef} rotation={[-Math.PI / 3, 0, 0]} position={[0, -2, -6]}>
        <planeGeometry args={[50, 30, 64, 64]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={ScrollSkyShader.vertexShader}
          fragmentShader={ScrollSkyShader.fragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
 
      {/* Night Sky Stars - opacity driven by ScrollController frame */}
      {starPositions && (
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[starPositions, 3]}
            />
          </bufferGeometry>
          <pointsMaterial
            ref={starsRef}
            size={0.06}
            color="#FBF5DD"
            transparent
            opacity={0.0}
            depthWrite={false}
          />
        </points>
      )}
 
      {/* Drifting Volumetric Mist Particles */}
      {mistPositions && (
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[mistPositions, 3]}
            />
          </bufferGeometry>
          <shaderMaterial
            ref={mistParticlesMatRef}
            vertexShader={VolumetricMistParticlesShader.vertexShader}
            fragmentShader={VolumetricMistParticlesShader.fragmentShader}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
    </>
  );
}
 
export default function ThreeHeroBg() {
  const [scrollPercent, setScrollPercent] = useState(0);
  const [hasWebGL, setHasWebGL] = useState(true);
 
  useEffect(() => {
    // Check WebGL availability with deferred execution
    const checkWebGL = () => {
      try {
        const canvas = document.createElement("canvas");
        const isSupported = !!(window.WebGLRenderingContext && 
          (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
        setHasWebGL(isSupported);
      } catch {
        setHasWebGL(false);
      }
    };
    
    setTimeout(checkWebGL, 0);
 
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) return;
      const pct = Math.min(1, Math.max(0, window.scrollY / totalHeight));
      setScrollPercent(pct);
    };
 
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Trigger initial check
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
 
  if (!hasWebGL) {
    // Plain background fallback
    return (
      <div className="absolute inset-0 z-0 bg-[#041E05] overflow-hidden">
        <div className="absolute inset-0 bg-radial-glow opacity-50" />
      </div>
    );
  }
 
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Absolute Bottom fade out to block color overlap */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#041E05] via-transparent to-transparent z-[1]" />
      
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%", position: "fixed", top: 0, left: 0 }}
      >
        <ambientLight intensity={0.4} />
        
        {/* Scroll tracker uniform compiler */}
        <ScrollController scrollPercent={scrollPercent} />
      </Canvas>
    </div>
  );
}
