/**
 * "Woven in light" — a full-screen silk cloth rendered with a custom GLSL shader.
 * Vertex shader: layered travelling waves + a cursor/finger ripple + scroll-driven folds; normals are
 * recomputed by finite differences so lighting follows every ripple.
 * Fragment shader: anisotropic silk sheen along the warp, a woven micro-texture, a pure-zari border band
 * with a hot gold specular, soft moving caustics and a fresnel rim.
 * This file is lazy-loaded only on pages that use it (Three.js never ships elsewhere).
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const vertex = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uHover;
  uniform float uScroll;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vFold;

  float wave(vec2 p) {
    float t = uTime;
    float h = 0.0;
    h += sin(p.x * 1.35 + t * 0.55) * 0.20;
    h += sin(p.y * 2.10 - t * 0.42 + p.x * 0.7) * 0.12;
    h += sin((p.x + p.y) * 3.3 + t * 0.9) * 0.035;
    h += sin(p.x * 5.0 - t * 1.3 + sin(p.y * 2.0 + t * 0.3)) * 0.018;
    // scroll gathers the cloth into deeper folds, as if being lifted from the loom
    h += sin(p.x * 2.6 + uScroll * 4.0) * 0.16 * uScroll;
    // cursor / finger ripple
    vec2 d = p - uMouse * vec2(2.2, 1.3);
    float r = length(d);
    h += exp(-r * r * 1.6) * sin(r * 7.0 - t * 3.2) * 0.12 * uHover;
    h += exp(-r * r * 2.5) * 0.10 * uHover;
    return h;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    float e = 0.02;
    float h = wave(pos.xy);
    float hx = wave(pos.xy + vec2(e, 0.0));
    float hy = wave(pos.xy + vec2(0.0, e));
    pos.z += h;
    vec3 n = normalize(vec3(-(hx - h) / e, -(hy - h) / e, 1.0));
    vNormal = normalize(normalMatrix * n);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vView = normalize(-mv.xyz);
    vFold = h;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uBase;
  uniform vec3 uDeep;
  uniform vec3 uGold;
  uniform float uDark;
  uniform float uAspect;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vFold;

  // Kajiya–Kay style anisotropic highlight along the warp threads
  float aniso(vec3 T, vec3 H, float power) {
    float th = dot(T, H);
    return pow(sqrt(max(0.0, 1.0 - th * th)), power);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vView);
    vec3 L1 = normalize(vec3(-0.45, 0.65, 0.75));
    vec3 L2 = normalize(vec3(0.7, -0.2, 0.5));
    vec3 T = normalize(cross(N, vec3(0.0, 1.0, 0.0)));

    // woven micro texture (warp × weft)
    float weave = 0.5 + 0.5 * sin(vUv.x * 900.0) * sin(vUv.y * 700.0);

    // body colour: deep in the troughs, brighter on the crests
    vec3 col = mix(uDeep, uBase, smoothstep(-0.25, 0.25, vFold));
    float diff = max(dot(N, L1), 0.0) * 0.75 + max(dot(N, L2), 0.0) * 0.25;
    col *= 0.45 + diff * 0.85;
    col *= 0.94 + weave * 0.06;

    // zari border: a band near the bottom with temple-like teeth
    float teeth = step(0.5, fract(vUv.x * 46.0)) * 0.012;
    float band = smoothstep(0.155 + teeth, 0.15 + teeth, vUv.y) * smoothstep(0.03, 0.035, vUv.y);
    float rule = smoothstep(0.004, 0.0, abs(vUv.y - 0.175)) + smoothstep(0.003, 0.0, abs(vUv.y - 0.022));
    float zari = clamp(band + rule, 0.0, 1.0);
    // scattered gold buttis on the body
    // small mango buttis on an aspect-correct, offset (brick) grid so they never stretch into lines
    vec2 bu = vec2(vUv.x * uAspect, vUv.y) * 11.0;
    bu.x += step(1.0, mod(floor(bu.y), 2.0)) * 0.5;
    vec2 g = fract(bu) - 0.5;
    float tear = length(vec2(g.x * 1.6, (g.y + 0.04) * 1.0 + g.x * g.x * 1.2));
    float butti = smoothstep(0.052, 0.034, tear) * step(0.22, vUv.y);
    zari = max(zari, butti * 0.5);
    col = mix(col, uGold * (0.55 + diff * 0.8), zari);

    // silk sheen + hot zari specular
    vec3 H1 = normalize(L1 + V);
    float sheen = aniso(T, H1, 60.0) * 0.55 + pow(max(dot(N, H1), 0.0), 40.0) * 0.25;
    col += mix(vec3(1.0, 0.86, 0.78), vec3(1.0, 0.85, 0.55), zari) * sheen * (0.6 + zari * 1.4);

    // soft caustics drifting across the cloth
    vec2 c = vUv * 6.0 + vec2(uTime * 0.05, -uTime * 0.04);
    float ca = sin(c.x + sin(c.y * 1.7 + uTime * 0.3)) * sin(c.y * 1.3 + sin(c.x * 1.1 - uTime * 0.25));
    col += uGold * pow(max(ca, 0.0), 6.0) * 0.18;

    // fresnel rim
    float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += uGold * fr * 0.25;

    // vignette so type stays readable
    float vig = smoothstep(1.25, 0.25, length((vUv - vec2(0.5, 0.55)) * vec2(1.1, 1.4)));
    col *= mix(0.55, 1.0, vig);
    col = mix(col, col * 0.82, uDark);

    gl_FragColor = vec4(col, 1.0);
  }
`;

type Props = { scrollRef: React.MutableRefObject<number>; palette?: { base: string; deep: string; gold: string }; dark?: boolean };

function Cloth({ scrollRef, palette, dark }: Props) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { viewport, size } = useThree();
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0, hover: 0, th: 0 });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2() },
      uHover: { value: 0 },
      uScroll: { value: 0 },
      uBase: { value: new THREE.Color(palette?.base ?? '#7A2331') },
      uDeep: { value: new THREE.Color(palette?.deep ?? '#2A0B12') },
      uGold: { value: new THREE.Color(palette?.gold ?? '#C99A45') },
      uDark: { value: dark ? 1 : 0 },
      uAspect: { value: 1 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    uniforms.uDark.value = dark ? 1 : 0;
  }, [dark, uniforms]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.ty = -((e.clientY / window.innerHeight) * 2 - 1);
      pointer.current.th = 1;
    };
    const leave = () => {
      pointer.current.th = 0;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', move);
      document.removeEventListener('pointerleave', leave);
    };
  }, []);

  useFrame((_, dt) => {
    uniforms.uAspect.value = (viewport.width * 1.25) / (viewport.height * 1.45);
    const p = pointer.current;
    const k = Math.min(1, dt * 3);
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
    p.hover += (p.th - p.hover) * Math.min(1, dt * 1.5);
    p.th *= 0.995; // ripple calms when the finger rests
    uniforms.uTime.value += Math.min(dt, 0.05);
    uniforms.uMouse.value.set(p.x, p.y);
    uniforms.uHover.value = p.hover;
    uniforms.uScroll.value += (scrollRef.current - uniforms.uScroll.value) * Math.min(1, dt * 4);
  });

  // Cover the viewport with a little overscan so edges never show while it ripples.
  const segs = size.width < 700 ? 110 : 180;
  return (
    <mesh rotation={[-0.38, 0, 0.04]} position={[0, 0.18, 0]} scale={[viewport.width * 1.25, viewport.height * 1.45, 1]}>
      <planeGeometry args={[1, 1, segs, Math.round(segs * 0.8)]} />
      <shaderMaterial ref={mat} vertexShader={vertex.replace(/pos\.xy/g, 'pos.xy')} fragmentShader={fragment} uniforms={uniforms} />
    </mesh>
  );
}

/**
 * The canvas pauses whenever it is off-screen or the tab is hidden (frameloop "never"),
 * caps devicePixelRatio at 2, and reports a failure so the parent can swap to the video/poster.
 */
export default function SilkHero({
  scrollRef,
  active,
  onFail,
  dark,
}: {
  scrollRef: React.MutableRefObject<number>;
  active: boolean;
  onFail: () => void;
  dark?: boolean;
}) {
  const fps = useRef<number[]>([]);
  return (
    <Canvas
      className="!absolute left-0 top-0 h-full w-full"
      dpr={[1, Math.min(2, window.devicePixelRatio || 1)]}
      frameloop={active ? 'always' : 'never'}
      camera={{ position: [0, 0, 2.2], fov: 45 }}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true }}
      onCreated={({ gl }) => {
        gl.setClearColor('#1B0A0E');
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onFail();
        });
      }}
      onError={onFail}
    >
      <FpsGuard samples={fps} onSlow={onFail} />
      <Cloth scrollRef={scrollRef} dark={dark} />
    </Canvas>
  );
}

/** If the scene runs under ~24 fps for 3 seconds, fall back to the poster/video. */
function FpsGuard({ samples, onSlow }: { samples: React.MutableRefObject<number[]>; onSlow: () => void }) {
  const done = useRef(false);
  useFrame((_, dt) => {
    if (done.current) return;
    samples.current.push(dt);
    if (samples.current.length > 180) {
      const avg = samples.current.slice(30).reduce((a, b) => a + b, 0) / (samples.current.length - 30);
      done.current = true;
      if (1 / avg < 24) onSlow();
    }
  });
  return null;
}
