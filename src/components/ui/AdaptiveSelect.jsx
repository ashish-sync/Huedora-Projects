import { Children, isValidElement, useCallback, useMemo, useRef, useState } from 'react';
import Select, { components } from 'react-select';

function TyloDropdownIndicator(props) {
  return (
    <components.DropdownIndicator {...props}>
      <span className="tylo-dropdown-chevron" aria-hidden="true" />
    </components.DropdownIndicator>
  );
}

function TyloInput(props) {
  const required = Boolean(props.selectProps?.['aria-required']);
  return <components.Input {...props} aria-required={required || undefined} />;
}

function textContent(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (isValidElement(node)) return textContent(node.props.children);
  return '';
}

function optionChildren(children) {
  return Children.toArray(children).filter(
    (child) => isValidElement(child) && child.type === 'option'
  );
}

function withoutNativeSelectChromeClass(className = '') {
  return className
    .split(/\s+/)
    .filter((token) => token && token !== 'tylo-select' && token !== 'filter-select')
    .join(' ');
}

export default function AdaptiveSelect({
  children,
  threshold = 10,
  value,
  onChange,
  multiple = false,
  disabled = false,
  required = false,
  name,
  id,
  className = '',
  style,
  placeholder,
  'aria-label': ariaLabelProp,
  ...rest
}) {
  const hostRef = useRef(null);
  const [menuWidth, setMenuWidth] = useState(null);
  const childOptions = useMemo(() => optionChildren(children), [children]);
  const parsedOptions = useMemo(
    () =>
      childOptions.map((child) => ({
        value: child.props.value == null ? '' : String(child.props.value),
        label: textContent(child.props.children),
        isDisabled: Boolean(child.props.disabled),
      })),
    [childOptions],
  );
  const emptyOption = parsedOptions.find((option) => option.value === '');
  const choices = useMemo(
    () => parsedOptions.filter((option) => option.value !== ''),
    [parsedOptions],
  );
  const ariaLabel =
    ariaLabelProp || placeholder || emptyOption?.label || name || 'Select option';

  const handleMenuOpen = useCallback(() => {
    const width = hostRef.current?.getBoundingClientRect().width;
    setMenuWidth(width ? Math.round(width) : null);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuWidth(null);
  }, []);

  const selectStyles = useMemo(() => {
    const menuWidthStyle = menuWidth
      ? { width: menuWidth, minWidth: menuWidth, maxWidth: menuWidth }
      : {};

    const styleOverrides = style
      ? {
          container: (base) => ({ ...base, ...style }),
          control: (base) => ({
            ...base,
            ...(style.height ? { minHeight: style.height } : {}),
            ...(style.minHeight ? { minHeight: style.minHeight } : {}),
          }),
        }
      : {};

    return {
      ...styleOverrides,
      menu: (base) => ({
        ...base,
        ...menuWidthStyle,
      }),
      menuPortal: (base) => ({
        ...base,
        zIndex: 1400,
      }),
    };
  }, [menuWidth, style]);

  // Native <select multiple> is poor UX (Ctrl+click listbox). Always use react-select for multi.
  if (!multiple && choices.length < threshold) {
    return (
      <select
        {...rest}
        id={id}
        name={name}
        aria-label={ariaLabel}
        className={['tylo-select', className].filter(Boolean).join(' ')}
        style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', ...style }}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
      >
        {children}
      </select>
    );
  }

  const selected = multiple
    ? choices.filter((option) =>
        (Array.isArray(value) ? value : []).some(
          (selectedValue) => String(selectedValue) === option.value
        )
      )
    : choices.find((option) => String(value ?? '') === option.value) || null;

  const emitChange = (nextSelection) => {
    const selectedOptions = multiple
      ? (nextSelection || []).map((option) => ({ value: option.value, label: option.label }))
      : [];
    const nextValue = multiple
      ? selectedOptions.map((option) => option.value)
      : nextSelection?.value || '';
    onChange?.({
      target: {
        value: nextValue,
        name,
        selectedOptions,
      },
      currentTarget: {
        value: nextValue,
        name,
        selectedOptions,
      },
    });
  };

  const reactClassName = withoutNativeSelectChromeClass(className);

  return (
    <div ref={hostRef} className="adaptive-select-host">
      <Select
        {...rest}
        inputId={id}
        name={name}
        aria-label={ariaLabel}
        className={`adaptive-select${multiple ? ' adaptive-select--multi' : ''}${
          reactClassName ? ` ${reactClassName}` : ''
        }`}
        classNamePrefix="adaptive-select"
        styles={selectStyles}
        options={choices}
        value={selected}
        onChange={emitChange}
        onMenuOpen={handleMenuOpen}
        onMenuClose={handleMenuClose}
        isMulti={multiple}
        isDisabled={disabled}
        isClearable={Boolean(emptyOption) && !required}
        isSearchable={multiple ? choices.length > 6 : choices.length > 8}
        // Do not pass `required` — react-select injects a RequiredInput that
        // inherits app-wide input chrome and shows as a stray control.
        aria-required={required || undefined}
        placeholder={placeholder || emptyOption?.label || 'Select…'}
        noOptionsMessage={({ inputValue }) =>
          inputValue ? 'No matching options' : 'No options available'
        }
        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
        menuPosition="fixed"
        menuPlacement="auto"
        blurInputOnSelect
        components={{ DropdownIndicator: TyloDropdownIndicator, Input: TyloInput }}
      />
    </div>
  );
}
