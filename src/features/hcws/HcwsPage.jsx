import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import { FIELD } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';

export default function HcwsPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ hcwId: '', name: '', city: '', contact: '', hcwType: '', hcwCategory: '' });
  const [error, setError] = useState('');

  const load = () => api('/hcws?limit=200').then((r) => setRows(r.data)).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api('/hcws', { method: 'POST', body: form });
      setForm({ hcwId: '', name: '', city: '', contact: '', hcwType: '', hcwCategory: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: 'HCW Directory' }]}
      title="Custodians"
      description="Healthcare worker and custodian records (no login accounts)."
      kpis={[{ label: 'Total custodians', value: rows.length }]}
    >
      {error && <p className="error">{error}</p>}

      {can('hcws:write') && (
        <form className="card" onSubmit={create}>
          <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>Add custodian</h3>
          <div className="row">
            {['hcwId', 'name', 'city', 'contact', 'hcwType', 'hcwCategory'].map((k) => (
              <div className="field" key={k}>
                <label>{k}</label>
                <input
                  required={k === 'hcwId' || k === 'name'}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <button className="btn" type="submit">
            Add custodian
          </button>
        </form>
      )}

      <div className="card card--flush table-wrap">
        <table>
          <thead>
            <tr>
              <th>{FIELD.CUSTODIAN_ID}</th>
              <th>Name</th>
              <th>Type</th>
              <th>Category</th>
              <th>City</th>
              <th>Contact</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h._id}>
                <td>{h.hcwId}</td>
                <td>{h.name}</td>
                <td>{h.hcwType || '-'}</td>
                <td>{h.hcwCategory || '-'}</td>
                <td>{h.city || '-'}</td>
                <td>{h.contact || '-'}</td>
                <td>
                  <span className="badge tone-neutral">{h.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
