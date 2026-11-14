import { useEffect, useRef } from 'react';
import { usePrefs } from './_baseline';

export function Starfield({ density = 1, className = '' }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { reducedMotion } = usePrefs();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    type Star = { x: number; y: number; z: number; t: number; c: string };
    let stars: Star[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.floor(((w * h) / 4200) * density);
      stars = Array.from({ length: n }, () => {
        const r = Math.random();
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          z: Math.random() * 0.9 + 0.1,
          t: Math.random() * Math.PI * 2,
          c: r > 0.94 ? '255,170,120' : r > 0.8 ? '150,230,255' : '225,235,255',
        };
      });
    };
    resize();
    window.addEventListener('resize', resize);
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(64, now - last) / 16;
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        if (!reducedMotion) {
          s.x -= s.z * 0.08 * dt;
          s.t += 0.02 * dt;
          if (s.x < 0) s.x = w;
        }
        const a = (0.35 + 0.65 * s.z) * (0.65 + 0.35 * Math.sin(s.t));
        ctx.fillStyle = `rgba(${s.c},${a})`;
        const size = s.z * 1.5;
        ctx.fillRect(s.x, s.y, size, size);
      }
      if (!reducedMotion) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [density, reducedMotion]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
