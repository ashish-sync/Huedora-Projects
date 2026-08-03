import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import { MODULE } from '../../shared/labels.js';
import PageShell from '../../components/ui/PageShell.jsx';
import LocationCascade from '../../components/ui/LocationCascade.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import MasterExcelToolbar from '../../components/masters/MasterExcelToolbar.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import { masterExcelFor } from '../masters/masterExcelConfig.js';

const emptyForm = {
  pinCode: '',
  stateId: '',
  districtId: '',
  state: '',
  district: '',
  zone: '',
};

export default function LocationMasterPage({ embedded = false } = {}) {
  const { can } = useAuth();
  const canWrite =
    can('camps:request') ||
    can('camps:approve') ||
    can('logistics:master') ||
    can('agreements:write') ||
    can('users:write') ||
    can('*');
  const canDelete = can('*');
  const excelConfig = masterExcelFor('pin-codes');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);

  const load = () => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), active: 'false' });
    if (q) params.set('q', q);
    setLoading(true);
    return api(`/geo/pin-codes?${params}`)
      .then((r) => {
        setRows(r.data || []);
        setListMeta(r.meta || { page, limit, total: 0, pages: 0 });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on page/limit
  }, [page, limit]);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    const pinCode = String(form.pinCode || '').replace(/\D+/g, '');
    if (!/^\d{6}$/.test(pinCode)) {
      setError('Enter a valid 6-digit PIN code.');
      return;
    }
    if (!form.stateId || !form.districtId) {
      setError('Select state and district.');
      return;
    }
    try {
      const body = {
        pinCode,
        stateId: form.stateId,
        districtId: form.districtId,
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
      stateId: row.stateId || '',
      districtId: row.districtId || '',
      state: row.stateName || '',
      district: row.districtName || '',
      zone: row.zone || '',
    });
  };

  const remove = async (id) => {
    if (!canDelete) return;
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
      hideChrome={embedded}
      title={embedded ? undefined : MODULE.LOCATION_MASTER}
      description={
        embedded
          ? undefined
          : `One row per PIN code with State, Zone, and District. Use Sample format for columns: PIN Code, State, Zone, District.`
      }
      actions={
        embedded ? null : (
          <Link className="btn secondary" to="/master-data">
            Back to Master One
          </Link>
        )
      }
    >
      {error ? <p className="error-text">{error}</p> : null}
      {msg ? <p className="muted">{msg}</p> : null}

      <MasterFilterShell
        actions={
          <>
            {excelConfig ? (
              <MasterExcelToolbar
                {...excelConfig}
                canImport={canWrite}
                onImportComplete={() => load()}
                onError={(message) => setError(message)}
                compact
              />
            ) : null}
            <button
              type="button"
              className="btn secondary btn-compact"
              onClick={() => {
                setError('');
                setPage(1);
                load();
              }}
            >
              Refresh
            </button>
          </>
        }
      >
        <MasterSearchField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setError('');
              setPage(1);
              load();
            }
          }}
          placeholder="Search PIN, state, zone, district…"
          aria-label="Search PIN geography"
        />
      </MasterFilterShell>

      <div className="card card--flush table-wrap">
        <table>
          <thead>
            <tr>
              <th>PIN Code</th>
              <th>State</th>
              <th>Zone</th>
              <th>District</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>
                  <strong>{r.pinCode}</strong>
                </td>
                <td>{r.stateName || '-'}</td>
                <td>{r.zone || '-'}</td>
                <td>{r.districtName || '-'}</td>
                <td>
                  {canWrite ? (
                    <>
                      <button className="btn secondary btn-compact" type="button" onClick={() => startEdit(r)}>
                        Edit
                      </button>{' '}
                      {canDelete ? (
                        <button className="btn secondary btn-compact" type="button" onClick={() => remove(r._id)}>
                          Remove
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="muted" style={{ padding: '1rem' }}>
            No PIN codes yet. Add mappings below or import Excel with columns: PIN Code, State, Zone, District.
          </p>
        ) : null}
      </div>

      {canWrite ? (
        <form className="card pin-master-form" onSubmit={save}>
          <h3 style={{ marginTop: 0 }}>{editId ? 'Edit PIN mapping' : 'Add PIN mapping'}</h3>
          <LocationCascade
            required
            pinFirst
            pinInputOnly
            pinRequired
            districtRequired
            showDistrict
            showCity={false}
            showZone
            showMappedPinPreview
            showPinCountsInOptions
            value={form}
            onChange={(loc) => setForm((prev) => ({ ...prev, ...loc }))}
          />
          <div className="row" style={{ gap: '0.5rem', marginTop: '1rem' }}>
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
      <PaginationBar
        page={listMeta.page}
        limit={limit}
        total={listMeta.total}
        pages={listMeta.pages}
        loading={loading}
        onPageChange={setPage}
        onLimitChange={(n) => {
          setLimit(n);
          setPage(1);
        }}
      />
    </PageShell>
  );
}
