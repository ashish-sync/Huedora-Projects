import { useEffect, useMemo, useRef, useState } from 'react';
import { clientApi, clientMasterApi } from '../campOpsApi.js';
import { useSearchDropdownKeyboard } from '../hooks/useSearchDropdownKeyboard';
import { trimString } from '../utils/trimInput';

function uniqueByClientName(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = String(record.clientName || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ClientNameSearchInput({
  value,
  error,
  onChange,
  onSelectRecord,
  disabled = false,
  requireExistingClient = false,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const suppressOpenRef = useRef(false);

  function closeDropdown() {
    suppressOpenRef.current = true;
    setOpen(false);
    setSuggestions([]);
    setClientSuggestions([]);
    window.setTimeout(() => {
      suppressOpenRef.current = false;
    }, 200);
  }

  function openDropdown() {
    if (!suppressOpenRef.current) setOpen(true);
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        closeDropdown();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const query = trimString(value);
    if (query.length < 2) {
      setSuggestions([]);
      setClientSuggestions([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [masterRes, clientRes] = await Promise.all([
          clientMasterApi.list({ search: query, limit: 20, page: 1 }),
          clientApi.list({ search: query, limit: 10, page: 1 }),
        ]);
        setSuggestions(masterRes.data.data || []);
        setClientSuggestions(clientRes.data.data || []);
      } catch {
        setSuggestions([]);
        setClientSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, open]);

  const masterByClient = uniqueByClientName(suggestions);
  const hasResults = masterByClient.length > 0 || clientSuggestions.length > 0;

  const selectableItems = useMemo(() => {
    const items = [];
    masterByClient.forEach((record) => {
      items.push({ key: `master-${record._id}`, type: 'master', record });
    });
    clientSuggestions.forEach((client) => {
      items.push({ key: `client-${client._id}`, type: 'client', client });
    });
    return items;
  }, [masterByClient, clientSuggestions]);

  function handleSelectMaster(record) {
    closeDropdown();
    onChange(record.clientName || '');
    onSelectRecord({
      ...record,
      clientId: record.client?._id || record.client || '',
    });
  }

  function handleSelectClient(client) {
    closeDropdown();
    onChange(client.name);
    onSelectRecord({
      clientId: client._id,
      clientName: client.name,
      client: { code: client.code },
      programName: '',
      drugTherapyName: '',
      campName: '',
      campType: '',
      coordinatorName: '',
      healthcareWorker: '',
      poAmount: 0,
      campDuration: '4:00',
      spocName: '',
      spocNumber: '',
      requestTimeline: '',
      executedCampUnit: 0,
      cancelledCampUnit: 0,
      otUnit: 0,
      minimumPatientCovered: 0,
      minimumKmsCovered: 0,
      extPatientUnit: 0,
      kmsUnit: 0,
      isActive: true,
    });
  }

  function handleSelectItem(item) {
    if (item.type === 'master') {
      handleSelectMaster(item.record);
      return;
    }
    handleSelectClient(item.client);
  }

  const {
    setItemRef,
    getItemClassName,
    handleKeyDown,
  } = useSearchDropdownKeyboard({
    open: open && !loading && hasResults,
    itemCount: selectableItems.length,
    onSelectIndex: (index) => handleSelectItem(selectableItems[index]),
    onClose: closeDropdown,
    onOpen: openDropdown,
    resetDeps: [value, selectableItems.length, loading],
  });

  return (
    <div className="client-search-field" ref={wrapperRef}>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          openDropdown();
        }}
        onFocus={openDropdown}
        onKeyDown={handleKeyDown}
        placeholder={requireExistingClient ? 'Search and select an existing company' : 'Search or type client name, e.g. Intas'}
        autoComplete="off"
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className={error ? 'input-invalid' : ''}
      />
      {error && <small className="field-error">{error}</small>}
      {open && value.trim().length >= 2 && (
        <div className="client-search-dropdown" role="listbox">
          {loading && <div className="client-search-item muted">Searching...</div>}
          {!loading && !hasResults && (
            <div className="client-search-item muted">
              {requireExistingClient ? 'No matching companies found' : 'No matching clients found'}
            </div>
          )}
          {!loading && masterByClient.length > 0 && (
            <>
              <div className="client-search-group-label">Existing program configs</div>
              {masterByClient.map((record, index) => (
                  <button
                    key={record._id}
                    ref={(node) => setItemRef(index, node)}
                    type="button"
                    role="option"
                    className={getItemClassName(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectMaster(record)}
                  >
                    <strong>{record.clientName}</strong>
                    <span>{record.programName || 'Division'} · {record.campName || 'Camp name'}</span>
                  </button>
                ))}
            </>
          )}
          {!loading && clientSuggestions.length > 0 && (
            <>
              <div className="client-search-group-label">Clients</div>
              {clientSuggestions.map((client, index) => (
                  <button
                    key={client._id}
                    ref={(node) => setItemRef(masterByClient.length + index, node)}
                    type="button"
                    role="option"
                    className={getItemClassName(masterByClient.length + index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectClient(client)}
                  >
                    <strong>{client.name}</strong>
                    <span>{client.code}</span>
                  </button>
                ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
