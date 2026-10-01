/**
 * Subtle healthcare / network illustration for the login brand panel.
 * Decorative only — no cartoon styling.
 */
export default function HealthcareNetworkArt() {
  return (
    <div className="ll-network" aria-hidden="true">
      <svg className="ll-network__svg" viewBox="0 0 520 280" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ll-net-stroke" x1="40" y1="40" x2="480" y2="240" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0A5AC2" stopOpacity="0.55" />
            <stop offset="1" stopColor="#38BDF8" stopOpacity="0.35" />
          </linearGradient>
          <radialGradient id="ll-net-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(260 140) rotate(90) scale(160 120)">
            <stop stopColor="#93C5FD" stopOpacity="0.35" />
            <stop offset="1" stopColor="#93C5FD" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="260" cy="150" rx="200" ry="100" fill="url(#ll-net-glow)" />
        <g stroke="url(#ll-net-stroke)" strokeWidth="1.25">
          <path d="M70 180 C120 90, 200 70, 260 120 C320 170, 400 150, 460 90" />
          <path d="M90 90 C150 150, 210 200, 280 170 C350 140, 410 80, 470 120" />
          <path d="M60 130 C140 110, 190 200, 270 210 C350 220, 420 160, 490 170" />
          <path d="M120 220 C180 160, 250 80, 330 110 C410 140, 450 200, 500 190" />
        </g>
        <g fill="#0A5AC2">
          <circle cx="90" cy="96" r="4.5" fill="#0284C7" />
          <circle cx="160" cy="168" r="3.5" opacity="0.85" />
          <circle cx="260" cy="118" r="5" fill="#0369A1" />
          <circle cx="330" cy="178" r="3.5" opacity="0.8" />
          <circle cx="400" cy="108" r="4.5" fill="#0EA5E9" />
          <circle cx="460" cy="160" r="3.5" opacity="0.75" />
          <circle cx="210" cy="210" r="3" opacity="0.7" />
          <circle cx="120" cy="210" r="3" opacity="0.65" />
        </g>
        <g transform="translate(244 128)" fill="none" stroke="#0A5AC2" strokeWidth="1.6" opacity="0.55">
          <circle cx="16" cy="16" r="14" />
          <path d="M16 8v16M8 16h16" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
