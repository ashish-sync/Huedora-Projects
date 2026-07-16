import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadExcel } from '../../shared/api.js';
import { MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import { RESOURCE_TYPES, PROFESSIONS } from './contactPicklists.js';

const empty = {
  name: '',
  email: '',
  resourceType: '',
  profession: '',
  contact: '',
  city: '',
  state: '',
};

export default function ContactDirectoryPage() {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const fileRef = useRef(null);

  const load = () => {
    const params = q ? `?q=${encodeURIComponent(q)}&limit=200` : '?limit=200';
    return api(`/contacts${params}`)
      .then((r) => setRows(r.data))
      .catch((e) => setError(e.message));
  };

  const downloadMaster = async () => {
    setError('');
    setExportBusy(true);
    try {
      await downloadExcel('/contacts/export', 'Contact_Directory.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editId) {
        await api(`/contacts/${editId}`, { method: 'PATCH', body: form });
      } else {
        await api('/contacts', { method: 'POST', body: form });
      }
      setForm(empty);
      setEditId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (c) => {
    setEditId(c._id);
    setForm({
      name: c.name || '',
      email: c.email || '',
      resourceType: c.resourceType || '',
      profession: c.profession || '',
      contact: c.contact || c.mobile || '',
      city: c.city || '',
      state: c.state || '',
    });
  };

  const runImport = async (file, mode) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setImportMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', mode);
      const { data } = await api('/contacts/import', { method: 'POST', body: fd });
      if (mode === 'DRY_RUN') {
        setImportMsg(
          `Dry-run: ${data.totalRows} rows · ${data.validated} valid · ${data.errorRows} errors`
        );
      } else {
        setImportMsg(
          `Imported: ${data.created} created · ${data.updated} updated · ${data.errorRows} errors`
        );
        load();
      }
      if (data.errors?.length) {
        setError(data.errors.slice(0, 5).map((e) => `Row ${e.row}: ${e.message}`).join(' | '));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <PageShell
      breadcrumbs={[
        { to: '/', label: 'Modules' },
        { to: '/agreements', label: MODULE.ASSET_AGREEMENT },
        { label: MODULE.CONTACT_DIRECTORY },
      ]}
      title={MODULE.CONTACT_DIRECTORY}
      description="Maintain recipients used for delivery — add manually or import from Excel."
      actions={
        can('agreements:write') ? (
          <Link className="btn" to="/agreements/new">
            + New document
          </Link>
        ) : null
      }
      kpis={[{ label: 'Contacts', value: rows.length }]}
      toolbar={
        <>
          <input
            className="esign-search"
            placeholder="Search name, email, contact, profession, city, state…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
          <button className="btn secondary" type="button" onClick={load}>
            Search
          </button>
          <button
            className="btn secondary"
            type="button"
            disabled={exportBusy}
            onClick={downloadMaster}
          >
            {exportBusy ? 'Downloading…' : 'Download Excel'}
          </button>
          <a className="btn secondary" href="/samples/Contact_Directory_Sample.xlsx" download>
            Sample Excel
          </a>
          {can('agreements:write') && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) runImport(f, 'COMMIT');
                }}
              />
              <button className="btn secondary" type="button" onClick={() => fileRef.current?.click()}>
                Import Excel
              </button>
            </>
          )}
        </>
      }
    >
      {error && <p className="error">{error}</p>}
      {importMsg && <p className="muted">{importMsg}</p>}

      <p className="muted mono-sm" style={{ margin: '0 0 16px' }}>
        Sample columns: Name · Email · Resource Type · Profession · Contact · City · State.
        Resource Type: Individual, Freelancer, Contractual, Retainer, Full Timer, Service Provider, Supplier, Vendor.
        Profession: MIS Executive, Camp Coordinator, Technician, Phlebotomist, Dietician.
      </p>

      <div className="wizard-grid">
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Resource Type</th>
                <th>Profession</th>
                <th>Contact</th>
                <th>City</th>
                <th>State</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c._id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.email || '—'}</td>
                  <td>{c.resourceType || '—'}</td>
                  <td>{c.profession || '—'}</td>
                  <td>{c.contact || c.mobile || '—'}</td>
                  <td>{c.city || '—'}</td>
                  <td>{c.state || '—'}</td>
                  <td>
                    {can('agreements:write') && (
                      <button className="btn secondary btn-compact" type="button" onClick={() => startEdit(c)}>Edit</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="muted" style={{ padding: '1rem' }}>No contacts yet. Add one or upload Excel.</p>}
        </div>

        {can('agreements:write') && (
          <form className="card" onSubmit={save}>
            <h3 style={{ marginTop: 0 }}>{editId ? 'Edit contact' : 'Create new contact'}</h3>
            <div className="field">
              <label>Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field">
              <label>Resource Type</label>
              <select value={form.resourceType} onChange={(e) => setForm({ ...form, resourceType: e.target.value })}>
                <option value="">Select…</option>
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Profession</label>
              <select value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })}>
                <option value="">Select…</option>
                {PROFESSIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Contact</label>
              <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Mobile / phone" />
            </div>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>City</label>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>State</label>
                <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
            </div>
            <p className="muted mono-sm">Email or Contact is required for delivery.</p>
            <div className="wizard-actions">
              {editId && (
                <button className="btn secondary" type="button" onClick={() => { setEditId(null); setForm(empty); }}>Cancel edit</button>
              )}
              <button className="btn" type="submit">{editId ? 'Save changes' : 'Add to directory'}</button>
            </div>
          </form>
        )}
      </div>
    </PageShell>
  );
}
