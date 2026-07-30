let audioCtx = null;

function getContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function enabled() {
  try {
    return localStorage.getItem('tylo_boot_sound') !== 'off';
  } catch {
    return true;
  }
}

function tone({ frequency = 880, duration = 0.04, volume = 0.03, type = 'sine' }) {
  if (!enabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playTypeTick() {
  tone({ frequency: 1200, duration: 0.012, volume: 0.012, type: 'square' });
}

export function playLineComplete() {
  tone({ frequency: 520, duration: 0.05, volume: 0.025 });
}

export function playAccessGranted() {
  tone({ frequency: 660, duration: 0.08, volume: 0.03 });
  window.setTimeout(() => tone({ frequency: 880, duration: 0.1, volume: 0.028 }), 90);
}

export function playBootComplete() {
  tone({ frequency: 440, duration: 0.12, volume: 0.025 });
}
