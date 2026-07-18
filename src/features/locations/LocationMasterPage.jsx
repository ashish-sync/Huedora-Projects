import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import LocationCascade from '../../components/ui/LocationCascade.jsx';

const emptyForm = {
  pinCode: '',
  locality: '',
  notes: '',
  stateId: '',
  districtId: '',
  cityId: '',
  state: '',
  district: '',
  city: '',
  isActive: true,
};

export default function LocationMasterPage() {
  const { can } = useAuth();
  const canWrite = can('agreements:write') || can('users:write') || can('*');
  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    const params = new URLSearchParams({ limit: '200' });
    if (q) params.set('q', q);
    return Promise.all([
      api('/geo/meta').then((r) => setMeta(r.data)),
      api(`/geo/pin-codes?${params}`).then((r) => setRows(r.data || [])),
    ]).catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      const body = {
        pinCode: form.pinCode,
        cityId: form.cityId,
        districtId: form.districtId || undefined,
        stateId: form.stateId,
        locality: form.locality,
        notes: form.notes,
        isActive: form.isActive,
      };
      if (editId) {
        await api(`/geo/pin-codes/${editId}`, { method: 'PATCH', body });
        setMsg('PIN mapping updated.');
      } else {
        await api('/geo/pin-codes', { method: 'POST', body });
        setMsg('PIN mapping created.');
      }
      setForm(emptyForm);
      setEditId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (row) => {
    setEditId(row._id);
    setForm({
      pinCode: row.pinCode || '',
      locality: row.locality || '',
      notes: row.notes || '',
      stateId: row.stateId || '',
      districtId: row.districtId || '',
      cityId: row.cityId || '',
      state: row.stateName || '',
      district: row.districtName || '',
      city: row.cityName || '',
      isActive: row.isActive !== false,
    });
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this PIN mapping?')) return;
    setError('');
    try {
      await api(`/geo/pin-codes/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <PageShell
      title="Location Master"
      subtitle="India states, districts, and cities from the local database. PIN codes are maintained here and start empty."
      actions={
        <Link className="btn secondary" to="/agreements">
          Back to Document Center
        </Link>
      }
    >
      {error ? <p className="error-text">{error}</p> : null}
      {msg ? <p className="muted">{msg}</p> : null}

      {meta ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>India geography (local)</h3>
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            {meta.counts?.states ?? 0} states · {meta.counts?.districts ?? 0} districts ·{' '}
            {meta.counts?.cities ?? 0} cities · {meta.counts?.pinCodes ?? 0} PIN mappings
          </p>
          <ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {(meta.sources || []).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="toolbar" style={{ gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          placeholder="Search PIN, city, locality…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <button type="button" className="btn secondary" onClick={load}>
          Search
        </button>
      </div>

      <div className="card table-wrap" style={{ marginBottom: '1.25rem' }}>
        <table>
          <thead>
            <tr>
              <th>PIN</th>
              <th>City</th>
              <th>District</th>
              <th>State</th>
              <th>Locality</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>
                  <strong>{r.pinCode}</strong>
                </td>
                <td>{r.cityName || '-'}</td>
                <td>{r.districtName || '-'}</td>
                <td>{r.stateName || '-'}</td>
                <td>{r.locality || '-'}</td>
                <td>{r.isActive === false ? 'No' : 'Yes'}</td>
                <td>
                  {canWrite ? (
                    <>
                      <button className="btn secondary btn-compact" type="button" onClick={() => startEdit(r)}>
                        Edit
                      </button>{' '}
                      <button className="btn secondary btn-compact" type="button" onClick={() => remove(r._id)}>
                        Remove
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="muted" style={{ padding: '1rem' }}>
            No PIN codes yet. Add mappings below as you learn postal codes for each city.
          </p>
        ) : null}
      </div>

      {canWrite ? (
        <form className="card" onSubmit={save}>
          <h3 style={{ marginTop: 0 }}>{editId ? 'Edit PIN mapping' : 'Add PIN mapping'}</h3>
          <div className="field">
            <label>PIN code *</label>
            <input
              required
              inputMode="numeric"
              maxLength={6}
              value={form.pinCode}
              onChange={(e) =>
                setForm({ ...form, pinCode: e.target.value.replace(/\D+/g, '').slice(0, 6) })
              }
              placeholder="6 digits"
            />
          </div>
          <LocationCascade
            required
            showPin={false}
            value={form}
            onChange={(loc) => setForm({ ...form, ...loc })}
          />
          <div className="field">
            <label>Locality</label>
            <input
              value={form.locality}
              onChange={(e) => setForm({ ...form, locality: e.target.value })}
              placeholder="Optional area / post office name"
            />
          </div>
          <div className="field">
            <label>Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="field">
            <label>Status</label>
            <AdaptiveSelect
              value={form.isActive ? '1' : '0'}
              onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}
            >
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </AdaptiveSelect>
          </div>
          <div className="row" style={{ gap: '0.5rem' }}>
            <button className="btn" type="submit">
              {editId ? 'Save changes' : 'Add PIN'}
            </button>
            {editId ? (
              <button
                className="btn secondary"
                type="button"
                onClick={() => {
                  setEditId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </PageShell>
  );
}
