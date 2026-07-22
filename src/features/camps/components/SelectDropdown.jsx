import { useEffect, useId, useRef, useState } from 'react';

export function SelectDropdown({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = 'Select option',
  className = '',
  hideLabel = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const fallbackId = useId();
  const fieldId = id || fallbackId;
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  function handleSelect(nextValue) {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div className={`custom-select${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`} ref={rootRef}>
      {label && !hideLabel && (
        <span className="custom-select-label" id={`${fieldId}-label`}>{label}</span>
      )}
      <button
        type="button"
        id={fieldId}
        className="custom-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label && !hideLabel ? `${fieldId}-label` : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="custom-select-value">{selectedOption?.label || placeholder}</span>
        <span className="custom-select-chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul className="custom-select-menu" role="listbox" aria-label={label || placeholder}>
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`custom-select-option${isSelected ? ' is-selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                >
                  <span>{option.label}</span>
                  {isSelected && <span className="custom-select-check" aria-hidden="true">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
