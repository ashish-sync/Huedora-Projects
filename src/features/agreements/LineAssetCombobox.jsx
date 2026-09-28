import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../shared/api.js';

function assetDisplayName(asset) {
  return String(
    asset?.deviceNameSnapshot || asset?.deviceMasterId?.name || asset?.name || ''
  ).trim();
}

function rowsFromAssetsResponse(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function uniqueNames(assets) {
  const seen = new Set();
  const names = [];
  for (const asset of assets || []) {
    const name = assetDisplayName(asset);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names.sort((a, b) => a.localeCompare(b));
}

async function fetchAssets(query = '') {
  const params = new URLSearchParams({
    limit: '100',
    page: '1',
    availableForAgreement: '1',
  });
  const q = String(query || '').trim();
  if (q) params.set('q', q);
  const res = await api(`/assets?${params}`);
  return rowsFromAssetsResponse(res);
}

function uniqueSerials(assets, deviceName, excludeSerials) {
  const want = String(deviceName || '').trim().toLowerCase();
  const excluded = new Set(
    [...(excludeSerials || [])].map((s) => String(s || '').trim().toLowerCase()).filter(Boolean)
  );
  const seen = new Set();
  const serials = [];
  for (const asset of assets || []) {
    if (want && assetDisplayName(asset).toLowerCase() !== want) continue;
    const serial = String(asset?.serialNumber || '').trim();
    if (!serial) continue;
    const key = serial.toLowerCase();
    if (excluded.has(key) || seen.has(key)) continue;
    seen.add(key);
    serials.push(serial);
  }
  return serials.sort((a, b) => a.localeCompare(b));
}

function ComboboxMenu({ open, anchorRef, children }) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.max(rect.width, 180);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setPos({
        top: rect.bottom + 4,
        left: Math.max(8, left),
        width,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef]);

  if (!open || !pos || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="line-asset-combobox-dropdown is-portal"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 10050,
      }}
      role="listbox"
    >
      {children}
    </div>,
    document.body
  );
}

function useComboboxOpen(menuRef) {
  const wrapperRef = useRef(null);
  const suppressOpenRef = useRef(false);
  const [open, setOpen] = useState(false);

  function closeDropdown() {
    suppressOpenRef.current = true;
    setOpen(false);
    window.setTimeout(() => {
      suppressOpenRef.current = false;
    }, 200);
  }

  function openDropdown() {
    if (!suppressOpenRef.current) setOpen(true);
  }

  useEffect(() => {
    function handleClickOutside(event) {
      const inWrap = wrapperRef.current?.contains(event.target);
      const inMenu = menuRef?.current?.contains(event.target);
      if (!inWrap && !inMenu) closeDropdown();
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuRef]);

  return { wrapperRef, open, setOpen, openDropdown, closeDropdown };
}

export function LineDeviceNameCombobox({
  id,
  value,
  onChange,
  onSelectName,
  placeholder = 'Search or pick device name…',
  required = false,
  disabled = false,
  'aria-label': ariaLabel,
}) {
  const menuRef = useRef(null);
  const { wrapperRef, open, openDropdown, closeDropdown } = useComboboxOpen(menuRef);
  const [loading, setLoading] = useState(false);
  const [names, setNames] = useState([]);
  const [error, setError] = useState('');

  const loadNames = async (query = '') => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchAssets(query);
      setNames(uniqueNames(rows));
    } catch (err) {
      setNames([]);
      setError(err?.message || 'Could not load devices from Asset One');
    } finally {
      setLoading(false);
    }
  };

  // Prefetch so the list is ready when the field is focused.
  useEffect(() => {
    loadNames('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const query = String(value || '').trim();
    const timer = setTimeout(() => {
      loadNames(query);
    }, query ? 250 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const filtered = useMemo(() => {
    const q = String(value || '').trim().toLowerCase();
    if (!q) return names;
    return names.filter((name) => name.toLowerCase().includes(q));
  }, [names, value]);

  const pick = (name) => {
    closeDropdown();
    onChange(name);
    onSelectName?.(name);
  };

  return (
    <div className="line-asset-combobox tylo-combobox-field" ref={wrapperRef}>
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          openDropdown();
        }}
        onFocus={openDropdown}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        required={required}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label={ariaLabel}
      />
      <span className="tylo-dropdown-chevron tylo-combobox-chevron" aria-hidden="true" />
      <ComboboxMenu open={open} anchorRef={wrapperRef}>
        <div ref={menuRef}>
          {loading && <div className="line-asset-combobox-empty">Loading devices…</div>}
          {!loading && error ? (
            <div className="line-asset-combobox-empty">{error}</div>
          ) : null}
          {!loading && !error && filtered.length > 0 && (
            <>
              <div className="line-asset-combobox-label">Asset One · Display Name</div>
              {filtered.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="option"
                  className="line-asset-combobox-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(name)}
                >
                  {name}
                </button>
              ))}
            </>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="line-asset-combobox-empty">
              {String(value || '').trim()
                ? 'No matching display names. Keep typing to use a custom name.'
                : 'No devices found in Asset One.'}
            </div>
          )}
        </div>
      </ComboboxMenu>
    </div>
  );
}

export function LineSerialCombobox({
  id,
  value,
  deviceName,
  onChange,
  onSelectSerial,
  excludeSerials = [],
  placeholder = 'Pick serial for this device…',
  required = false,
  disabled = false,
  'aria-label': ariaLabel,
}) {
  const menuRef = useRef(null);
  const { wrapperRef, open, openDropdown, closeDropdown } = useComboboxOpen(menuRef);
  const [loading, setLoading] = useState(false);
  const [serials, setSerials] = useState([]);
  const [error, setError] = useState('');
  const hasDevice = Boolean(String(deviceName || '').trim());
  const excludeKey = useMemo(
    () =>
      [...(excludeSerials || [])]
        .map((s) => String(s || '').trim().toLowerCase())
        .filter(Boolean)
        .sort()
        .join('|'),
    [excludeSerials]
  );

  useEffect(() => {
    if (!open || !hasDevice) {
      setSerials([]);
      setError('');
      return undefined;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await fetchAssets(deviceName);
        setSerials(uniqueSerials(rows, deviceName, excludeSerials));
      } catch (err) {
        setSerials([]);
        setError(err?.message || 'Could not load serials');
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceName, hasDevice, excludeKey]);

  const filtered = useMemo(() => {
    const q = String(value || '').trim().toLowerCase();
    const list = serials.filter((serial) => {
      const key = serial.toLowerCase();
      if (excludeSerials?.some((s) => String(s || '').trim().toLowerCase() === key)) {
        return false;
      }
      return true;
    });
    if (!q) return list;
    return list.filter((serial) => serial.toLowerCase().includes(q));
  }, [serials, value, excludeSerials]);

  const pick = (serial) => {
    closeDropdown();
    onChange(serial);
    onSelectSerial?.(serial);
  };

  return (
    <div className="line-asset-combobox tylo-combobox-field" ref={wrapperRef}>
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (hasDevice) openDropdown();
        }}
        onFocus={() => {
          if (hasDevice) openDropdown();
        }}
        placeholder={hasDevice ? placeholder : 'Select a device name first…'}
        autoComplete="off"
        disabled={disabled}
        required={required}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label={ariaLabel}
      />
      <span className="tylo-dropdown-chevron tylo-combobox-chevron" aria-hidden="true" />
      <ComboboxMenu open={open && hasDevice} anchorRef={wrapperRef}>
        <div ref={menuRef}>
          {loading && <div className="line-asset-combobox-empty">Loading serials…</div>}
          {!loading && error ? (
            <div className="line-asset-combobox-empty">{error}</div>
          ) : null}
          {!loading && !error && filtered.length > 0 && (
            <>
              <div className="line-asset-combobox-label">Serials for this device</div>
              {filtered.map((serial) => (
                <button
                  key={serial}
                  type="button"
                  role="option"
                  className="line-asset-combobox-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(serial)}
                >
                  {serial}
                </button>
              ))}
            </>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="line-asset-combobox-empty">
              {excludeSerials?.length
                ? 'No available serials for this device (others are already used on this agreement or locked).'
                : 'No serials for this display name. Type a serial to use it anyway.'}
            </div>
          )}
        </div>
      </ComboboxMenu>
    </div>
  );
}
