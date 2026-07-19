import { useEffect, useState } from 'react';
import { formatDateDDMMYYYY, toApiDateValue } from '../utils/dateFormat';

export function DateInput({
  id,
  label,
  value,
  onChange,
  className = '',
  hideLabel = false,
  required = false,
}) {
  const [displayValue, setDisplayValue] = useState(() => formatDateDDMMYYYY(value));

  useEffect(() => {
    setDisplayValue(formatDateDDMMYYYY(value));
  }, [value]);

  function commitValue(nextValue) {
    const apiValue = toApiDateValue(nextValue);
    setDisplayValue(apiValue ? formatDateDDMMYYYY(apiValue) : nextValue);
    onChange(apiValue);
  }

  return (
    <div className={`field date-input-field ${className}`.trim()}>
      {label && !hideLabel && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={displayValue}
        required={required}
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={(e) => commitValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitValue(e.currentTarget.value);
        }}
      />
    </div>
  );
}
