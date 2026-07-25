import { CAMP_NAME_OPTIONS } from '../constants/campNames';

export function CampNameSelect({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  error = '',
  placeholder = 'Select method',
  options = CAMP_NAME_OPTIONS,
  emptyLabel = '',
}) {
  const list = Array.isArray(options) ? options : CAMP_NAME_OPTIONS;
  const placeholderText = emptyLabel || placeholder;

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
        <option value="">{placeholderText}</option>
        {list.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      {error && <small className="field-error">{error}</small>}
    </>
  );
}
