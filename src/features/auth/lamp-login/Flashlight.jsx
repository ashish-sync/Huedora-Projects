/**
 * Interactive flashlight — click to toggle a soft volumetric beam.
 */
export default function Flashlight({ on, onToggle }) {
  return (
    <div className="ll-torch">
      <div className={`ll-torch-beam ${on ? 'is-on' : ''}`} aria-hidden="true">
        <span className="ll-torch-beam__halo" />
        <span className="ll-torch-beam__mid" />
        <span className="ll-torch-beam__core" />
        <span className="ll-torch-beam__spec" />
      </div>

      <button
        type="button"
        className={`ll-torch-btn ${on ? 'is-on' : ''}`}
        onClick={onToggle}
        aria-pressed={on}
        aria-label={on ? 'Turn flashlight off' : 'Turn flashlight on'}
      >
        <svg
          className="ll-torch-svg"
          viewBox="0 0 280 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="torchBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5a5a5e" />
              <stop offset="45%" stopColor="#2a2a2e" />
              <stop offset="100%" stopColor="#141416" />
            </linearGradient>
            <linearGradient id="torchHead" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#323236" />
              <stop offset="100%" stopColor="#161618" />
            </linearGradient>
            <linearGradient id="torchLens" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1a1a1c" />
              <stop offset="100%" stopColor="#0a0a0c" />
            </linearGradient>
            <radialGradient id="torchHot" cx="30%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#fffdf6" />
              <stop offset="40%" stopColor="#ffe2a8" />
              <stop offset="100%" stopColor="#ffb45a" />
            </radialGradient>
            <filter id="torchBloom" x="-80%" y="-100%" width="280%" height="300%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>

          <ellipse cx="118" cy="102" rx="90" ry="8" fill="#000" opacity="0.45" />

          <rect x="28" y="42" width="128" height="36" rx="10" fill="url(#torchBody)" />
          <rect x="36" y="46" width="112" height="6" rx="3" fill="rgba(255,255,255,0.1)" />

          <rect x="48" y="42" width="5" height="36" fill="rgba(0,0,0,0.35)" />
          <rect x="62" y="42" width="5" height="36" fill="rgba(0,0,0,0.28)" />
          <rect x="76" y="42" width="5" height="36" fill="rgba(0,0,0,0.35)" />

          <circle
            cx="118"
            cy="60"
            r="9"
            fill={on ? '#ffb86a' : '#1c1c1e'}
            stroke={on ? 'rgba(255,200,140,0.95)' : 'rgba(255,255,255,0.35)'}
            strokeWidth="1.5"
          />
          <circle cx="118" cy="60" r="3.5" fill={on ? '#fff6e8' : 'rgba(255,255,255,0.28)'} />

          <path d="M156 46h22c4 0 8 4 8 8v12c0 4-4 8-8 8h-22V46z" fill="url(#torchBody)" />

          <path
            d="M178 36h38l14 12v24l-14 12h-38V36z"
            fill="url(#torchHead)"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
          />
          <path d="M186 42h24" stroke="rgba(255,255,255,0.16)" strokeWidth="1.25" />

          <ellipse cx="236" cy="60" rx="10" ry="18" fill="url(#torchLens)" />
          <ellipse
            cx="236"
            cy="60"
            rx="7"
            ry="14"
            fill={on ? 'url(#torchHot)' : '#0d0d0f'}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1"
          />

          {on ? (
            <ellipse
              cx="250"
              cy="60"
              rx="22"
              ry="26"
              fill="#ffc078"
              filter="url(#torchBloom)"
              opacity="0.65"
            />
          ) : null}
        </svg>

        <span className="ll-torch-hint">
          {on ? 'Click to turn off' : 'Click flashlight to illuminate'}
        </span>
      </button>
    </div>
  );
}
