import React, { useEffect, useRef } from 'react';

interface Dot {
  color: string;
  currentCircle: number;
  targetCircle: number;
  progress: number; // 0..1
  cx: number; // control point for quadratic Bézier curve
  cy: number;
  path: { x: number; y: number }[]; // Stores recent points for trail drawing
}

const NUM_CIRCLES = 11;
// Assign 11 distinct bright colors for the circles
const CIRCLE_COLORS = Array.from({ length: NUM_CIRCLES }, (_, i) => {
  const hue = (360 / NUM_CIRCLES) * i;
  return `hsl(${hue}, 90%, 55%)`;
});
// Generate 84 distinct bright colors evenly spaced around the hue wheel
const DOT_COLORS = Array.from({ length: 84 }, (_, i) => {
  const hue = (360 / 84) * i;
  return `hsl(${hue}, 90%, 55%)`;
});
const MOVE_DURATION = 4000; // ms
const MAX_TRAIL_LENGTH = 80; // Trails linger 20% less

const GraphBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
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

    const circles: { x: number; y: number; r: number }[] = [];
    const computeCircles = () => {
      circles.length = 0;
      const { width, height } = canvas;
      const R = Math.min(width, height) * 0.45;
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
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      const dx = p1.y - p0.y;
      const dy = -(p1.x - p0.x);
      const len = Math.hypot(dx, dy) || 1;
      const normX = dx / len;
      const normY = dy / len;
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const magnitude = (Math.random() * 0.3 + 0.1) * dist;
      return { cx: mx + normX * magnitude, cy: my + normY * magnitude };
    };

    const initDot = (idx: number): Dot => {
      // Each dot starts at a specific circle, and gets that circle's color
      const currentCircle = idx % NUM_CIRCLES;
      const color = CIRCLE_COLORS[currentCircle];
      const targetCircle = (currentCircle + 1) % NUM_CIRCLES;
      const { cx, cy } = randomControlPoint(circles[currentCircle], circles[targetCircle]);
      return { color, currentCircle, targetCircle, progress: 0, cx, cy, path: [] };
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



      // Clear the entire canvas each frame to prevent residue
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw circle outlines (now in their assigned color)
      circles.forEach(({ x, y, r }, i) => {
        ctx.strokeStyle = CIRCLE_COLORS[i];
        ctx.lineWidth = 2;
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
          const cp = randomControlPoint(circles[dot.currentCircle], circles[dot.targetCircle]);
          dot.cx = cp.cx;
          dot.cy = cp.cy;
        }

        const start = circles[dot.currentCircle];
        const end = circles[dot.targetCircle];
        const t = dot.progress;
        const oneMinusT = 1 - t;
        const x = oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * dot.cx + t * t * end.x;
        const y = oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * dot.cy + t * t * end.y;

        // Add current position to path and trim if too long
        dot.path.push({ x, y });
        if (dot.path.length > MAX_TRAIL_LENGTH) {
          dot.path.shift();
        }

        // Draw the trail from the stored path
        if (dot.path.length > 1) {
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (let i = 1; i < dot.path.length; i++) {
            const segmentAlpha = Math.pow(i / MAX_TRAIL_LENGTH, 2);
            const trailColor = dot.color.replace('hsl(', 'hsla(').replace(')', `, ${segmentAlpha})`);
            ctx.strokeStyle = trailColor;
            ctx.lineWidth = 7; // A tiny bit bigger
            ctx.beginPath();
            ctx.moveTo(dot.path[i - 1].x, dot.path[i - 1].y);
            ctx.lineTo(dot.path[i].x, dot.path[i].y);
            ctx.stroke();
          }
        }

        // Draw the head of the dot
        ctx.fillStyle = dot.color;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2); // A tiny bit bigger
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