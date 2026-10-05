import { describe, expect, it } from 'vitest';
import {
  fitClickToSignStamps,
  measureClickToSignContentWidth,
} from './fitClickToSign.js';

describe('fitClickToSign', () => {
  it('measures the wider of name and meta lines', () => {
    const stamp = document.createElement('div');
    stamp.className = 'ti-click-sign';
    const name = document.createElement('div');
    name.className = 'ti-click-sign__name';
    name.textContent = 'BIKRAM BINAY SRIVASTAVA';
    Object.defineProperty(name, 'getBoundingClientRect', {
      value: () => ({ width: 220, height: 16, top: 0, left: 0, bottom: 16, right: 220 }),
    });
    const meta = document.createElement('div');
    meta.className = 'ti-click-sign__meta';
    meta.textContent = 'Digitally signed on 05-10-2026 12:43:18';
    Object.defineProperty(meta, 'getBoundingClientRect', {
      value: () => ({ width: 180, height: 12, top: 0, left: 0, bottom: 12, right: 180 }),
    });
    stamp.append(name, meta);
    expect(measureClickToSignContentWidth(stamp)).toBe(220);
  });

  it('scales stamp down to fit shell width', () => {
    const shell = document.createElement('div');
    shell.className = 'ti-click-sign-shell';
    Object.defineProperty(shell, 'clientWidth', { value: 100 });
    const stamp = document.createElement('div');
    stamp.className = 'ti-click-sign';
    const name = document.createElement('div');
    name.className = 'ti-click-sign__name';
    Object.defineProperty(name, 'getBoundingClientRect', {
      value: () => ({ width: 200, height: 16, top: 0, left: 0, bottom: 16, right: 200 }),
    });
    stamp.append(name);
    shell.append(stamp);
    document.body.append(shell);
    fitClickToSignStamps(shell);
    expect(stamp.style.transform).toMatch(/scale\(0\.4[67]/);
    shell.remove();
  });
});
