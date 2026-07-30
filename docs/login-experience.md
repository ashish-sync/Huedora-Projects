# Cinematic login & terminal boot

The post-sign-in terminal boot, fullscreen, healthcare insights, and dark-mode handoff are **optional** and controlled by Vite environment variables (set in Render for production or `.env` locally).

## Quick revert to classic login

In Render → **Huedora-Projects** (client) → Environment:

```env
VITE_LOGIN_CINEMATIC=false
```

Redeploy the static site. Users will get: **Sign in → module home** with no boot screen.

## Flags

| Variable | Default (when cinematic on) | Effect |
|----------|----------------------------|--------|
| `VITE_LOGIN_CINEMATIC` | `true` | Master switch — `false` disables all rows below |
| `VITE_LOGIN_BOOT_SEQUENCE` | follows master | Terminal boot screen after sign-in |
| `VITE_LOGIN_FULLSCREEN` | follows master | Browser fullscreen on Sign in |
| `VITE_LOGIN_HEALTH_INSIGHTS` | follows master | Fact cards on login + home |
| `VITE_LOGIN_DARK_AFTER_BOOT` | follows master | Dark theme when boot completes |

Sub-flags can be toggled independently when `VITE_LOGIN_CINEMATIC=true`, e.g. boot on but no fullscreen:

```env
VITE_LOGIN_CINEMATIC=true
VITE_LOGIN_FULLSCREEN=false
```

## Code layout

| Path | Role |
|------|------|
| `src/shared/loginExperienceConfig.js` | Single source of truth for flags |
| `src/features/auth/TyloBootSequence.jsx` | Boot UI (lazy-loaded) |
| `src/features/auth/bootSequenceScript.js` | Typed line script & timings |
| `src/shared/auth.jsx` | Activates boot only when flag is on |

No server changes are required to toggle the experience.
