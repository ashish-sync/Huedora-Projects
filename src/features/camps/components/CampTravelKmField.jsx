import { CampFormInput } from './CampFormInput.jsx';
import './campTravelKmField.css';

export default function CampTravelKmField({
  value,
  source = '',
  status = '',
  reason = '',
  disabled = false,
  onKmChange,
  onReasonChange,
}) {
  const isManual = source === 'manual';
  const badge = source === 'auto' ? 'Estimated' : isManual ? 'Manual' : '';

  return (
    <label className="camp-travel-km-field">
      Travelled Kms (Round Trip)
      <CampFormInput
        type="number"
        min="0"
        step="0.1"
        inputMode="decimal"
        aria-label="Travelled Kms (Round Trip)"
        value={value}
        onChange={(e) => onKmChange?.(e.target.value)}
        disabled={disabled}
      />
      <div className="camp-travel-km-field__meta">
        {badge ? (
          <span className={`camp-travel-km-field__badge camp-travel-km-field__badge--${isManual ? 'manual' : 'auto'}`}>
            {badge}
          </span>
        ) : null}
        {status ? (
          <p className="camp-travel-km-field__status" role="status">{status}</p>
        ) : null}
      </div>
      {isManual ? (
        <div className="camp-travel-km-field__reason">
          <span>Reason for manual distance (optional)</span>
          <textarea
            value={reason}
            disabled={disabled}
            onChange={(e) => onReasonChange?.(e.target.value)}
            placeholder="Why was the estimate changed?"
          />
        </div>
      ) : null}
    </label>
  );
}
