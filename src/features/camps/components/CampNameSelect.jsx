import { CAMP_NAME_OPTIONS } from '../constants/campNames';

export function CampNameSelect({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  error = '',
  placeholder = 'Select camp name',
}) {
  return (
    <>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className={error ? 'input-invalid' : ''}
      >
        <option value="">{placeholder}</option>
        {CAMP_NAME_OPTIONS.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      {error && <small className="field-error">{error}</small>}
    </>
  );
}
