import React, { useEffect, useRef } from 'react';
import { useThemeStore } from '../store/theme';

interface Dot {
  color: string;
  currentCircle: number;
  targetCircle: number;
  progress: number; // 0..1
  cx: number; // control point for quadratic Bézier curve
  cy: number;
}

const NUM_CIRCLES = 11;
// Generate 84 distinct bright colors evenly spaced around the hue wheel
const DOT_COLORS = Array.from({ length: 84 }, (_, i) => {
  const hue = (360 / 84) * i;
  return `hsl(${hue}, 90%, 55%)`;
});
const MOVE_DURATION = 4000; // ms

const FADE_ALPHA = 0.042; // ~16% faster fade (tails last ~1/6 less time)

const GraphBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  // no need to track cycle phase anymore
  const dotsRef = useRef<Dot[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Precompute circle centres
    const circles: { x: number; y: number; r: number }[] = [];
    const computeCircles = () => {
      circles.length = 0;
      const { width, height } = canvas;
      const R = Math.min(width, height) * 0.45; // wider spread radius
      const centerX = width / 2;
      const centerY = height / 2;
      const smallRadius = Math.min(width, height) * 0.05;
      for (let i = 0; i < NUM_CIRCLES; i++) {
        const angle = (Math.PI * 2 * i) / NUM_CIRCLES - Math.PI / 2;
        const x = centerX + R * Math.cos(angle);
        const y = centerY + R * Math.sin(angle);
        circles.push({ x, y, r: smallRadius });
      }
    };
    computeCircles();

    const randomControlPoint = (p0: { x: number; y: number }, p1: { x: number; y: number }) => {
      // Choose a control point somewhere near the midpoint, offset perpendicular
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      // perpendicular vector
      const dx = p1.y - p0.y;
      const dy = -(p1.x - p0.x);
      const len = Math.hypot(dx, dy) || 1;
      const normX = dx / len;
      const normY = dy / len;
      // random magnitude up to 30% of distance between circles
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const magnitude = (Math.random() * 0.3 + 0.1) * dist;
      return { cx: mx + normX * magnitude, cy: my + normY * magnitude };
    };

    const initDot = (idx: number): Dot => {
      const color = DOT_COLORS[idx];
      const currentCircle = idx % NUM_CIRCLES;
      const targetCircle = (currentCircle + 1) % NUM_CIRCLES;
      const { cx, cy } = randomControlPoint(circles[currentCircle], circles[targetCircle]);
      return { color, currentCircle, targetCircle, progress: 0, cx, cy };
    };

    dotsRef.current = Array.from({ length: DOT_COLORS.length }).map((_, idx) => initDot(idx));

    const pickNewTarget = (current: number) => {
      let next = Math.floor(Math.random() * NUM_CIRCLES);
      while (next === current) next = Math.floor(Math.random() * NUM_CIRCLES);
      return next;
    };

    const step = (ts: number) => {
      const dt = ts - lastTimeRef.current;
      lastTimeRef.current = ts;

      // Get current theme state directly in the animation loop to avoid re-renders
      const isDarkNow = useThemeStore.getState().isDark;

      const fadeRGB = isDarkNow ? '0,0,0' : '255,255,255';
      ctx.fillStyle = `rgba(${fadeRGB},${FADE_ALPHA})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw circle outlines adapting to theme
      ctx.strokeStyle = isDarkNow ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      circles.forEach(({ x, y, r }) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Update and draw dots
      dotsRef.current.forEach((dot) => {
        dot.progress += dt / MOVE_DURATION;
        if (dot.progress >= 1) {
          dot.currentCircle = dot.targetCircle;
          dot.targetCircle = pickNewTarget(dot.currentCircle);
          dot.progress = 0;
          // new control point
          const cp = randomControlPoint(circles[dot.currentCircle], circles[dot.targetCircle]);
          dot.cx = cp.cx;
          dot.cy = cp.cy;
        }

        const start = circles[dot.currentCircle];
        const end = circles[dot.targetCircle];
        const t = dot.progress;
        // quadratic Bézier interpolation
        const oneMinusT = 1 - t;
        const x = oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * dot.cx + t * t * end.x;
        const y = oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * dot.cy + t * t * end.y;

        ctx.fillStyle = dot.color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(step);
    };

    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(step);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none select-none z-0" />;
};

export default GraphBackground; 