import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildBootSequence, resolveBootVariables } from './bootSequenceScript.js';
import {
  playAccessGranted,
  playBootComplete,
  playLineComplete,
  playTypeTick,
} from './terminalSounds.js';
import { useMatrixRain } from './useMatrixRain.js';
import { useTheme } from '../../shared/theme.jsx';
import { loginExperience } from '../../shared/loginExperienceConfig.js';

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      window.clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

async function typeText(text, charMs, onChar, signal) {
  for (let i = 0; i < text.length; i += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    onChar(text.slice(0, i + 1));
    if (i % 3 === 0) playTypeTick();
    await sleep(charMs, signal);
  }
}

async function runProgress(durationMs, width, onProgress, signal) {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const tick = (now) => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const t = Math.min(1, (now - start) / durationMs);
      const filled = Math.round(t * width);
      const bar = `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`;
      onProgress(`${bar} ${Math.round(t * 100)}%`);
      if (t >= 1) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export default function TyloBootSequence({ user, onComplete }) {
  const canvasRef = useRef(null);
  const terminalRef = useRef(null);
  const abortRef = useRef(null);
  const finishOnceRef = useRef(false);

  const vars = useMemo(() => resolveBootVariables(user), [user]);
  const script = useMemo(() => buildBootSequence(vars), [vars]);

  const [completedLines, setCompletedLines] = useState([]);
  const [activeLine, setActiveLine] = useState('');
  const [activeClass, setActiveClass] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [phase, setPhase] = useState('running'); // running | done | fading
  const [canContinue, setCanContinue] = useState(false);

  useMatrixRain(canvasRef, { opacity: 0.15, speed: 1.6 });

  const { setTheme } = useTheme();

  const finish = useCallback(() => {
    if (finishOnceRef.current) return;
    finishOnceRef.current = true;
    abortRef.current?.abort();
    if (loginExperience.darkModeAfterBoot) {
      setTheme('dark');
    }
    setPhase('fading');
    window.setTimeout(() => onComplete?.(), 920);
  }, [onComplete, setTheme]);

  const skipBoot = useCallback(() => {
    finish();
  }, [finish]);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    let mounted = true;
    finishOnceRef.current = false;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const run = async () => {
      try {
        if (reducedMotion) {
          const lines = script
            .filter((s) => s.kind === 'type' || s.kind === 'progress')
            .map((s) =>
              s.kind === 'progress'
                ? { text: `${'█'.repeat(s.width)} 100%`, className: 'boot-line--progress' }
                : { text: s.text, className: s.className || '' }
            );
          setCompletedLines(lines);
          setPhase('done');
          setCanContinue(true);
          window.setTimeout(() => {
            if (mounted) finish();
          }, 800);
          return;
        }

        for (const step of script) {
          if (!mounted) return;
          if (step.kind === 'pause') {
            await sleep(step.ms, controller.signal);
            continue;
          }
          if (step.kind === 'progress') {
            setActiveClass('boot-line--progress');
            setActiveLine('');
            let finalProgress = '';
            await runProgress(
              step.durationMs,
              step.width,
              (line) => {
                finalProgress = line;
                setActiveLine(line);
              },
              controller.signal
            );
            playLineComplete();
            setCompletedLines((prev) => [
              ...prev,
              { text: finalProgress, className: 'boot-line--progress' },
            ]);
            setActiveLine('');
            setActiveClass('');
            continue;
          }
          if (step.kind === 'type') {
            setActiveClass(step.className || '');
            setActiveLine('');
            await typeText(step.text, step.charMs, setActiveLine, controller.signal);
            if (step.className === 'boot-line--granted') playAccessGranted();
            else playLineComplete();
            setCompletedLines((prev) => [
              ...prev,
              { text: step.text, className: step.className || '' },
            ]);
            setActiveLine('');
            setActiveClass('');
          }
        }

        if (!mounted) return;
        playBootComplete();
        setPhase('done');
        setCanContinue(true);

        const autoId = window.setTimeout(() => {
          if (mounted) finish();
        }, 3800);
        controller.signal.addEventListener('abort', () => window.clearTimeout(autoId));
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (mounted) finish();
      }
    };

    run();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [script, finish]);

  useEffect(() => {
    const id = window.setInterval(() => setShowCursor((v) => !v), 530);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [completedLines, activeLine]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skipBoot();
        return;
      }
      if (!canContinue) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canContinue, finish, skipBoot]);

  return (
    <div
      className={`tylo-boot${phase === 'fading' ? ' tylo-boot--fade-out' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="TYLO ONE system initialization"
    >
      <canvas ref={canvasRef} className="tylo-boot-rain" aria-hidden="true" />
      <div className="tylo-boot-scanlines" aria-hidden="true" />
      <div className="tylo-boot-vignette" aria-hidden="true" />

      <div className="tylo-boot-inner">
        <header className="tylo-boot-header">
          <span className="tylo-boot-status-dot" aria-hidden="true" />
          <span className="tylo-boot-header-label">TYLO ONE · SECURE OPERATIONS CONSOLE</span>
          <span className="tylo-boot-header-meta">v3.0</span>
        </header>

        <div className="tylo-boot-terminal" ref={terminalRef}>
          {completedLines.map((line, index) => (
            <div key={`${line.text}-${index}`} className={`boot-line ${line.className}`.trim()}>
              {line.text}
            </div>
          ))}
          {(activeLine || phase === 'running') && (
            <div className={`boot-line boot-line--active ${activeClass}`.trim()}>
              {activeLine}
              <span className={`boot-cursor${showCursor ? ' is-visible' : ''}`} aria-hidden="true">
                ▌
              </span>
            </div>
          )}
        </div>

        <footer className="tylo-boot-footer">
          {canContinue && phase !== 'fading' ? (
            <button type="button" className="tylo-boot-continue" onClick={finish}>
              Continue to workspace
            </button>
          ) : (
            <button type="button" className="tylo-boot-continue tylo-boot-continue--ghost" onClick={skipBoot}>
              Skip
            </button>
          )}
          <span className="tylo-boot-footer-hint">
            {canContinue ? 'Press Enter · Esc to skip' : 'Press Esc to skip'}
          </span>
        </footer>
      </div>
    </div>
  );
}
