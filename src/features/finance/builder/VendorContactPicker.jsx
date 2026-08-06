import { useEffect, useMemo, useState } from 'react';
import AdaptiveSelect from '../../../components/ui/AdaptiveSelect.jsx';
import { api } from '../../../shared/api.js';
import { isVendorContact } from '../../agreements/contactPicklists.js';

/**
 * Map a Contact Directory Vendor onto Purchase Order vendor fields.
 */
export function vendorPatchFromContact(contact) {
  if (!contact) return null;
  const name = String(contact.name || '').trim();
  const mobile = String(contact.mobile || contact.contact || '').trim();
  const email = String(contact.email || '').trim();
  const addressParts = [
    String(contact.address || '').trim(),
    String(contact.city || '').trim(),
    String(contact.state || '').trim(),
    String(contact.pinCode || '').trim(),
  ].filter(Boolean);
  const address = addressParts.join(', ');

  return {
    contactId: contact._id ? String(contact._id) : '',
    vendor: {
      name,
      address,
      mobile,
      email,
      pan: String(contact.panNumber || '').trim(),
      stateName: String(contact.state || '').trim(),
    },
  };
}

export default function VendorContactPicker({
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
    api('/contacts?limit=500&contactCategory=Vendor')
      .then((r) => {
        if (cancelled) return;
        const list = Array.isArray(r?.data) ? r.data : [];
        setRows(list.filter((c) => isVendorContact(c) && c.isActive !== false && !c.isDeleted));
        setError('');
      })
      .catch((err) => {
        if (!cancelled) {
          setRows([]);
          setError(err?.message || 'Could not load vendors from Contact Directory');
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
        const name = row.name || 'Unnamed';
        const city = row.city ? ` · ${row.city}` : '';
        const supply = row.supplyCategory ? ` · ${row.supplyCategory}` : '';
        return {
          id: String(row._id),
          label: `${name}${city}${supply}`,
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
        aria-label="Pick vendor from Contact Directory"
        placeholder={loading ? 'Loading vendors…' : 'Search Contact Directory (Vendor)…'}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) {
            onClear?.();
            return;
          }
          const match = options.find((o) => o.id === id);
          if (match) onPick?.(match.row, vendorPatchFromContact(match.row));
        }}
      >
        <option value="">
          {loading
            ? 'Loading vendors…'
            : options.length
              ? 'Select from Contact Directory · Vendor'
              : 'No Vendor contacts found'}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </AdaptiveSelect>
      {error ? <p className="ib-client-master-pick-error">{error}</p> : null}
      <p className="ib-client-master-pick-hint">
        Vendor Name is filled from Contact Directory contacts with Contact Category = Vendor. You can
        still edit details below.
      </p>
    </div>
  );
}
