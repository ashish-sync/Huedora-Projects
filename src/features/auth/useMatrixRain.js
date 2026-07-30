import { useEffect, useRef } from 'react';

const CHARSET = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';

export function useMatrixRain(canvasRef, { opacity = 0.14, speed = 1.4 } = {}) {
  const frameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return undefined;

    let columns = [];
    let w = 0;
    let h = 0;
    const fontSize = 14;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.ceil(w / fontSize);
      columns = Array.from({ length: count }, () => ({
        y: Math.random() * h,
        speed: speed * (0.6 + Math.random() * 0.9),
        chars: Array.from({ length: 24 }, () =>
          CHARSET[Math.floor(Math.random() * CHARSET.length)]
        ),
      }));
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.fillStyle = `rgba(8, 10, 9, ${0.12 + opacity * 0.08})`;
      ctx.fillRect(0, 0, w, h);

      ctx.font = `${fontSize}px "JetBrains Mono", "Consolas", monospace`;
      for (let i = 0; i < columns.length; i += 1) {
        const col = columns[i];
        const x = i * fontSize;
        const head = col.chars[0];
        for (let j = 0; j < col.chars.length; j += 1) {
          const y = col.y - j * fontSize;
          if (y < -fontSize || y > h + fontSize) continue;
          const alpha = j === 0 ? opacity * 1.35 : opacity * Math.max(0.15, 1 - j * 0.09);
          ctx.fillStyle =
            j === 0
              ? `rgba(120, 255, 160, ${Math.min(alpha, 0.35)})`
              : `rgba(40, 180, 90, ${alpha})`;
          ctx.fillText(col.chars[j], x, y);
        }
        col.y += col.speed;
        if (col.y > h + fontSize * 8) {
          col.y = -Math.random() * h * 0.25;
          col.speed = speed * (0.6 + Math.random() * 0.9);
        }
        if (Math.random() > 0.96) {
          col.chars.unshift(CHARSET[Math.floor(Math.random() * CHARSET.length)]);
          col.chars.pop();
        }
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [canvasRef, opacity, speed]);
}
