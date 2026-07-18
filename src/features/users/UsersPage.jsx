import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';

export default function UsersPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({
    email: '',
    username: '',
    fullName: '',
    password: '',
    roleIds: [],
  });
  const [error, setError] = useState('');

  if (!can('users:write')) return <p className="error">Admin only</p>;

  const load = () => {
    api('/users').then((r) => setRows(r.data)).catch((e) => setError(e.message));
    api('/users/roles').then((r) => setRoles(r.data)).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: 'Modules' }, { label: 'System users' }]}
      title="System users"
      description="User accounts and role assignments."
      kpis={[{ label: 'Active users', value: rows.length }]}
    >
      {error && <p className="error">{error}</p>}

      <form
        className="card"
        style={{ padding: 20, marginBottom: 16 }}
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api('/users', { method: 'POST', body: form });
            load();
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>Create user</h3>
        <div className="row">
          <div className="field">
            <label>Email</label>
            <input required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label>Username</label>
            <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="field">
            <label>Full name</label>
            <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="field">
            <label>Password</label>
            <input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Roles</label>
          <AdaptiveSelect
            multiple
            value={form.roleIds}
            onChange={(e) =>
              setForm({
                ...form,
                roleIds: [...e.target.selectedOptions].map((o) => o.value),
              })
            }
            style={{ minHeight: 100 }}
          >
            {roles.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </AdaptiveSelect>
        </div>
        <button className="btn" type="submit">
          Create user
        </button>
      </form>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Roles</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u._id}>
                <td>{u.fullName}</td>
                <td>{u.email}</td>
                <td>{(u.roles || []).map((r) => r.name).join(', ') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
