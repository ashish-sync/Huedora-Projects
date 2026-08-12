import { useEffect, useState } from 'react';
import { campApi } from '../campOpsApi.js';
import { buildHcwSameDayCampRows } from '../utils/hcwSameDayCamps.js';

function toIsoDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  if (!dmy) return text.slice(0, 10);
  let year = Number(dmy[3]);
  if (year < 100) year += 2000;
  return `${year}-${String(Number(dmy[2])).padStart(2, '0')}-${String(Number(dmy[1])).padStart(2, '0')}`;
}

/**
 * Shows the selected HCW’s other assigned camps on the same date
 * (Start Time, End Time, PIN Code) while assigning / blocking that HCW.
 */
export function HcwSameDayCampsPanel({
  hcwContactId = '',
  campDate = '',
  excludeCampId = '',
  excludeCampKey = '',
  hcwName = '',
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const dateIso = toIsoDate(campDate);
  const contactId = String(hcwContactId || '').trim();

  useEffect(() => {
    if (!contactId || !dateIso) {
      setRows([]);
      setLoadError('');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError('');

    campApi.list({
      hcwContactId: contactId,
      dateFrom: dateIso,
      dateTo: dateIso,
      limit: 100,
    })
      .then(({ data }) => {
        if (cancelled) return;
        const peers = Array.isArray(data?.data) ? data.data : [];
        setRows(buildHcwSameDayCampRows(peers, {
          hcwContactId: contactId,
          excludeCampId,
          excludeCampKey,
        }));
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setLoadError(err?.message || 'Could not load this HCW’s camps for the date');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contactId, dateIso, excludeCampId, excludeCampKey]);

  if (!contactId || !dateIso) return null;

  const who = hcwName ? ` for ${hcwName}` : '';

  return (
    <div className="hcw-same-day-camps" role="region" aria-label="HCW assigned camps for this date">
      <div className="hcw-same-day-camps-header">
        <strong>Assigned camps on this date{who}</strong>
        <span className="meta-text">
          Use Start / End / PIN to keep the 30-minute gap between camps.
        </span>
      </div>

      {loading ? (
        <p className="meta-text hcw-same-day-camps-status">Loading schedule…</p>
      ) : null}

      {!loading && loadError ? (
        <p className="meta-text hcw-same-day-camps-status is-error">{loadError}</p>
      ) : null}

      {!loading && !loadError && rows.length === 0 ? (
        <p className="meta-text hcw-same-day-camps-status">
          No other camps assigned to this HCW on this date.
        </p>
      ) : null}

      {!loading && !loadError && rows.length > 0 ? (
        <div className="table-wrap hcw-same-day-camps-table-wrap">
          <table className="hcw-same-day-camps-table">
            <thead>
              <tr>
                <th>Camp ID</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>PIN Code</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id || `${row.campId}-${row.startTime}`}>
                  <td>{row.campId}</td>
                  <td>{row.startLabel}</td>
                  <td>{row.endLabel}</td>
                  <td>{row.pincode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
