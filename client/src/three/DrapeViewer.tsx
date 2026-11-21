/**
 * "Drape view": the product photo mapped onto a gently waving cloth plane that the visitor can tilt
 * (drag) and zoom (wheel / pinch). Lazy-loaded from the product page only.
 */
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const vert = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  varying vec2 vUv;
  varying float vShade;
  void main() {
    vUv = uv;
    vec3 p = position;
    // hangs from the top edge: motion grows toward the hem
    float hang = 1.0 - uv.y;
    float w = sin(p.x * 4.0 + uTime * 1.1) * 0.035 + sin(p.y * 6.0 - uTime * 0.8) * 0.02;
    p.z += w * hang * uAmp;
    p.x += sin(p.y * 3.0 + uTime * 0.7) * 0.01 * hang * uAmp;
    vShade = w * 6.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const frag = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying float vShade;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    c.rgb *= 0.92 + vShade * 0.35;
    c.rgb += vec3(1.0, 0.92, 0.8) * max(vShade, 0.0) * 0.15;
    gl_FragColor = c;
  }
`;

function Cloth({ url, tilt }: { url: string; tilt: React.MutableRefObject<{ x: number; y: number; zoom: number }> }) {
  const tex = useLoader(THREE.TextureLoader, url);
  const mesh = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
  }, [tex]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAmp: { value: 1 }, uMap: { value: tex } }), [tex]);
  useFrame((state, dt) => {
    uniforms.uTime.value += dt;
    const m = mesh.current!;
    m.rotation.x += (tilt.current.y * 0.5 - m.rotation.x) * 0.08;
    m.rotation.y += (tilt.current.x * 0.7 - m.rotation.y) * 0.08;
    state.camera.position.z += (2.1 / tilt.current.zoom - state.camera.position.z) * 0.1;
  });
  const h = Math.min(viewport.height * 0.92, viewport.width * 1.15);
  return (
    <mesh ref={mesh} scale={[h * 0.8, h, 1]}>
      <planeGeometry args={[1, 1, 64, 80]} />
      <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function DrapeViewer({ url }: { url: string }) {
  const tilt = useRef({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<number | null>(null);
  return (
    <div
      className="absolute left-0 top-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        tilt.current.x = Math.max(-1, Math.min(1, tilt.current.x + (e.clientX - drag.current.x) / 200));
        tilt.current.y = Math.max(-0.8, Math.min(0.8, tilt.current.y + (e.clientY - drag.current.y) / 260));
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onWheel={(e) => {
        tilt.current.zoom = Math.max(1, Math.min(2.6, tilt.current.zoom - e.deltaY * 0.0015));
      }}
      onTouchMove={(e) => {
        if (e.touches.length !== 2) return;
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (pinch.current) tilt.current.zoom = Math.max(1, Math.min(2.6, tilt.current.zoom * (d / pinch.current)));
        pinch.current = d;
      }}
      onTouchEnd={() => {
        pinch.current = null;
      }}
    >
      <Canvas dpr={[1, Math.min(2, window.devicePixelRatio || 1)]} camera={{ position: [0, 0, 2.1], fov: 40 }} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <Cloth url={url} tilt={tilt} />
        </Suspense>
      </Canvas>
    </div>
  );
}
