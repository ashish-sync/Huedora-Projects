import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LEGACY_THEME_STORAGE_KEY } from './legacyMigration.js';

const STORAGE_KEY = 'tylo-one-theme';
const LEGACY_STORAGE_KEY = LEGACY_THEME_STORAGE_KEY;
const THEME_META_COLORS = {
  light: '#0A5AC2',
  dark: '#111827',
};

export function applyThemeToDocument(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', THEME_META_COLORS[theme] || THEME_META_COLORS.light);
  }
}

/** Persist and apply theme (usable outside React context, e.g. after login boot). */
export function persistTheme(theme) {
  const value = theme === 'dark' ? 'dark' : 'light';
  applyThemeToDocument(value);
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
  return value;
}
const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

function readStoredTheme() {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr;
  }
  try {
    let stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== 'dark' && stored !== 'light') {
      stored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        localStorage.setItem(STORAGE_KEY, stored);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  const setTheme = useCallback((next) => {
    const value = next === 'dark' ? 'dark' : 'light';
    setThemeState(value);
    applyThemeToDocument(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
