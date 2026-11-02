import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import { FIELD, MODULE } from '../../shared/labels.js';
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
          <h3 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 700 }}>Add custodian</h3>
          <div className="form-grid form-grid-3">
            {[
              { key: 'hcwId', label: `${FIELD.CUSTODIAN_ID} *`, placeholder: 'e.g. HCW-001', required: true },
              { key: 'name', label: 'Full Name *', placeholder: 'e.g. Rahul Sharma', required: true },
              { key: 'city', label: 'City', placeholder: 'e.g. Mumbai' },
              { key: 'contact', label: 'Contact Number', placeholder: '+91 9876543210' },
              { key: 'hcwType', label: 'Custodian Type', placeholder: 'e.g. Coordinator' },
              { key: 'hcwCategory', label: 'Category', placeholder: 'e.g. Healthcare Staff' },
            ].map(({ key, label, placeholder, required }) => (
              <div className="field" key={key}>
                <label>{label}</label>
                <input
                  required={required}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button className="btn" type="submit">
              Add custodian
            </button>
          </div>
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
