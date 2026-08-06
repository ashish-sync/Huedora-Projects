import { useEffect, useMemo, useState } from 'react';
import AdaptiveSelect from '../../../components/ui/AdaptiveSelect.jsx';
import { formatDisplayDate } from '../invoiceGenerator/invoiceCalculations.js';
import {
  invoiceDocumentDateIso,
  listIssuedClientInvoices,
} from './lookupTaxInvoices.js';

/**
 * Pick an Issued Tax Invoice — sets document number + document date for Credit/Debit notes.
 */
export default function OriginalTaxInvoicePicker({
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
    listIssuedClientInvoices()
      .then((list) => {
        if (cancelled) return;
        setRows(list);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) {
          setRows([]);
          setError(err?.message || 'Could not load tax invoices');
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
        const number = String(row.documentNumber || '').trim();
        const date = invoiceDocumentDateIso(row);
        const party = String(row.recipientName || '').trim();
        const dateLabel = date ? formatDisplayDate(date) : '';
        return {
          id: number,
          label: [number, dateLabel, party].filter(Boolean).join(' · '),
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
        aria-label="Pick original tax invoice"
        placeholder={loading ? 'Loading tax invoices…' : 'Search Issued Tax Invoice…'}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) {
            onClear?.();
            return;
          }
          const match = options.find((o) => o.id === id);
          if (match) {
            onPick?.(match.row, {
              documentNumber: match.id,
              documentDate: invoiceDocumentDateIso(match.row),
            });
          }
        }}
      >
        <option value="">
          {loading
            ? 'Loading tax invoices…'
            : options.length
              ? 'Select Issued Tax Invoice…'
              : 'No issued tax invoices found'}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </AdaptiveSelect>
      {error ? <p className="ib-client-master-pick-error">{error}</p> : null}
      <p className="ib-client-master-pick-hint">
        Original Invoice Date is filled automatically from the selected Tax Invoice.
      </p>
    </div>
  );
}
