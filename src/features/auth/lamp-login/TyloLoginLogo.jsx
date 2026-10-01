/**
 * Exact TYLO brand logo for the login page.
 */
export default function TyloLoginLogo({ className = '' }) {
  const rootClass = ['ll-tylo-mark', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass}>
      <img
        className="ll-tylo-mark__logo"
        src="/brand/tylo-logo.jpg"
        alt="TYLO — Bringing Healthcare Closer"
        draggable={false}
      />
    </div>
  );
}
