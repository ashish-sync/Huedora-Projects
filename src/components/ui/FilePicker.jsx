import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react';

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileSummary(fileList) {
  const list = fileList ? Array.from(fileList) : [];
  if (!list.length) return '';
  if (list.length === 1) {
    const f = list[0];
    return f.size ? `${f.name} (${formatSize(f.size)})` : f.name;
  }
  return `${list.length} files selected`;
}

/**
 * Enterprise file control. Hides native picker chrome and shows a Browse
 * button + selected file name that matches other form fields.
 *
 * ref points at the underlying <input type="file"> (with a value setter that
 * also clears the visible label when set to "").
 */
const FilePicker = forwardRef(function FilePicker(
  {
    accept,
    multiple = false,
    required = false,
    disabled = false,
    capture,
    id,
    name,
    className = '',
    buttonLabel,
    emptyLabel = 'No file chosen',
    onChange,
  },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  const localRef = useRef(null);
  const [summary, setSummary] = useState('');

  useImperativeHandle(ref, () => {
    const el = localRef.current;
    if (!el) return null;
    return new Proxy(el, {
      set(target, prop, value) {
        if (prop === 'value') {
          target.value = value;
          if (!value) setSummary('');
          return true;
        }
        target[prop] = value;
        return true;
      },
    });
  });

  const browseLabel = buttonLabel || (multiple ? 'Browse files' : 'Browse');
  const filled = Boolean(summary);

  const openPicker = () => {
    if (disabled) return;
    localRef.current?.click();
  };

  const handleChange = (e) => {
    setSummary(fileSummary(e.target.files));
    onChange?.(e);
  };

  const clear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const input = localRef.current;
    if (!input) return;
    input.value = '';
    setSummary('');
    onChange?.({
      target: input,
      currentTarget: input,
      type: 'change',
      preventDefault() {},
      stopPropagation() {},
    });
  };

  return (
    <div
      className={`file-picker${disabled ? ' is-disabled' : ''}${filled ? ' has-files' : ''}${className ? ` ${className}` : ''}`}
    >
      <input
        ref={localRef}
        id={inputId}
        name={name}
        type="file"
        className="file-picker__input"
        accept={accept}
        multiple={multiple || undefined}
        required={required || undefined}
        disabled={disabled || undefined}
        capture={capture}
        onChange={handleChange}
      />
      <button type="button" className="file-picker__browse" disabled={disabled} onClick={openPicker}>
        {browseLabel}
      </button>
      <button
        type="button"
        className={`file-picker__name${filled ? ' is-filled' : ''}`}
        disabled={disabled}
        onClick={openPicker}
        title={filled ? summary : emptyLabel}
      >
        {filled ? summary : emptyLabel}
      </button>
      {filled && !disabled ? (
        <button type="button" className="file-picker__clear" aria-label="Clear selected file" onClick={clear}>
          Clear
        </button>
      ) : null}
    </div>
  );
});

export default FilePicker;
