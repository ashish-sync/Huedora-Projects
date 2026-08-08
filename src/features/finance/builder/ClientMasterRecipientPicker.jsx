import { useEffect, useMemo, useState } from 'react';
import AdaptiveSelect from '../../../components/ui/AdaptiveSelect.jsx';
import { parseEmailList } from '../../../shared/validation.js';
import { clientMasterApi } from '../../camps/campOpsApi.js';

/**
 * Map a Client Master program (+ company billing) onto invoice bill-to / proforma recipient fields.
 * Contact Name always prefers program SPOC Name from Client Master.
 */
export function recipientPatchFromClientMaster(row) {
  if (!row) return null;
  const billing = row.billing || row.client || {};
  const name = String(row.clientName || billing.name || '').trim();
  const address = String(billing.address || '').trim();
  const contactPerson = String(
    row.spocName || billing.contactPerson || ''
  ).trim();
  const email =
    parseEmailList(row.spocEmail)[0] ||
    parseEmailList(billing.email)[0] ||
    '';
  const phone = String(row.spocNumber || billing.phone || '').trim();
  const projectName = String(row.programName || row.campName || '').trim();

  return {
    clientMasterId: row._id ? String(row._id) : '',
    clientId: row.clientId ? String(row.clientId) : '',
    billTo: {
      name,
      address,
      stateName: String(billing.stateName || '').trim(),
      stateCode: String(billing.stateCode || '').trim(),
      gstin: String(billing.gstin || '').trim(),
      pan: String(billing.pan || '').trim(),
      contactPerson,
      email,
      phone,
    },
    recipient: {
      name,
      placeOfSupply: address,
      deliveryAddress: address,
      stateCode: String(billing.stateCode || '').trim(),
      recipientGstin: String(billing.gstin || '').trim(),
      recipientPan: String(billing.pan || '').trim(),
      contactPerson,
      contactEmail: email,
      projectName,
    },
    projectName,
  };
}

export default function ClientMasterRecipientPicker({
  value = '',
  onPick,
  onClear,
  disabled = false,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    clientMasterApi
      .list({ limit: 500, page: 1 })
      .then(({ data }) => {
        if (cancelled) return;
        const list = data?.data || data?.pagination?.data || [];
        setRows(Array.isArray(list) ? list.filter((r) => r.isActive !== false) : []);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) {
          setRows([]);
          setError(err?.message || 'Could not load Client Master');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(
    () =>
      rows.map((row) => {
        const code = String(row.clientCode || '').trim() || '—';
        const division = String(row.programName || row.drugTherapyName || '').trim() || '—';
        return {
          id: String(row._id),
          label: `${code} · ${division}`,
          row,
        };
      }),
    [rows]
  );

  return (
    <div className="ib-client-master-pick">
      <AdaptiveSelect
        threshold={1}
        value={value || ''}
        disabled={disabled || loading}
        aria-label="Pick recipient from Client Master"
        placeholder={loading ? 'Loading Client Master…' : 'Search Client Master…'}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) {
            onClear?.();
            return;
          }
          const match = options.find((o) => o.id === id);
          if (match) onPick?.(match.row, recipientPatchFromClientMaster(match.row));
        }}
      >
        <option value="">
          {loading
            ? 'Loading Client Master…'
            : options.length
              ? 'Select from Client Master (or enter details below)'
              : 'No Client Master records'}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </AdaptiveSelect>
      {error ? <p className="ib-client-master-pick-error">{error}</p> : null}
    </div>
  );
}
