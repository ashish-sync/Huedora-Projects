/**
 * Cinematic login / terminal boot — feature flags (Vite env).
 *
 * Set VITE_LOGIN_CINEMATIC=false to restore the classic flow:
 *   Sign in → home (no boot screen, no forced fullscreen, no health insights).
 *
 * Sub-flags only apply when the master switch is on (unless noted).
 */

function envTruthy(name) {
  const raw = import.meta.env[name];
  if (raw === undefined || raw === '') return null;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

function flag(name, defaultWhenMaster) {
  const explicit = envTruthy(name);
  if (explicit !== null) return explicit;
  return defaultWhenMaster;
}

const cinematicMaster = envTruthy('VITE_LOGIN_CINEMATIC') ?? true;

/** @readonly */
export const loginExperience = Object.freeze({
  /** Master switch — false disables all cinematic login features. */
  cinematic: cinematicMaster,
  /** Full-screen terminal boot after successful sign-in. */
  bootSequence: flag('VITE_LOGIN_BOOT_SEQUENCE', cinematicMaster),
  /** Browser fullscreen on Sign in click (F11-style). */
  fullscreenOnSignIn: flag('VITE_LOGIN_FULLSCREEN', cinematicMaster),
  /** Indian healthcare fact cards on login + home. */
  healthcareInsights: flag('VITE_LOGIN_HEALTH_INSIGHTS', cinematicMaster),
  /** Switch to dark theme when boot completes. */
  darkModeAfterBoot: flag('VITE_LOGIN_DARK_AFTER_BOOT', cinematicMaster),
});

export function isBootSequenceEnabled() {
  return loginExperience.cinematic && loginExperience.bootSequence;
}

export function isCinematicLoginActive() {
  return (
    loginExperience.cinematic
    && (loginExperience.bootSequence
      || loginExperience.fullscreenOnSignIn
      || loginExperience.healthcareInsights)
  );
}
