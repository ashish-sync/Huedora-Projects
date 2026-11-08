import { useEffect, useState } from 'react';
import FeedbackBanner from '../../../components/ui/FeedbackBanner.jsx';
import AdaptiveSelect from '../../../components/ui/AdaptiveSelect.jsx';
import { clientApi } from '../campOpsApi.js';
import { trimFormStrings, trimString } from '../utils/trimInput';
import { Pagination } from './Pagination';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { ClientsFilters } from './ClientsFilters';
import { EmptyState } from '../../../components/ui/PageShell.jsx';

const emptyClient = { name: '', code: '', isActive: true };

export function ClientsPanel({
  initialSearch = '',
  canCreate = false,
  canUpdate = false,
  canDelete = false,
}) {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyClient);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClients(1, pageSize, initialSearch);
  }, [initialSearch]);

  async function loadClients(nextPage = page, nextPageSize = pageSize, searchValue = search) {
    setLoading(true);
    const trimmedSearch = trimString(searchValue);
    setSearch(trimmedSearch);
    try {
      const params = { page: nextPage, limit: nextPageSize };
      if (trimmedSearch) params.search = trimmedSearch;
      const { data } = await clientApi.list(params);
      setClients(Array.isArray(data?.data) ? data.data : []);
      setPagination(data?.pagination || null);
      setPage(nextPage);
      setPageSize(nextPageSize);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load Clients');
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setEditingId('new');
    setForm(emptyClient);
  }

  function startEdit(client) {
    setEditingId(client._id);
    setForm({
      name: client.name,
      code: client.code,
      isActive: client.isActive !== false,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyClient);
  }

  async function handleSave(e) {
    e.preventDefault();
    const payload = trimFormStrings(form, ['name', 'code']);
    if (!payload.name) {
      setError('Client name is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingId === 'new') {
        await clientApi.create({ ...payload, isActive: form.isActive });
      } else {
        await clientApi.update(editingId, { ...payload, isActive: form.isActive });
      }
      cancelEdit();
      await loadClients(page);
    } catch (err) {
      setError(err?.message || 'Failed to save Client');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(client) {
    try {
      await clientApi.update(client._id, { isActive: !client.isActive });
      await loadClients(page);
    } catch (err) {
      setError(err?.message || 'Failed to update client status');
    }
  }

  async function handleDelete(client) {
    if (!window.confirm(`Archive client "${client.name}"?`)) return;
    try {
      await clientApi.remove(client._id);
      await loadClients(page);
    } catch (err) {
      setError(err?.message || 'Failed to archive client');
    }
  }

  function handleSearchSubmit() {
    setPage(1);
    loadClients(1, pageSize);
  }

  function clearAllFilters() {
    setSearch('');
    setPage(1);
    loadClients(1, pageSize, '');
  }

  const activeChips = search
    ? [{
      key: 'search',
      label: `Search: ${search}`,
      onRemove: () => {
        setSearch('');
        setPage(1);
        loadClients(1, pageSize, '');
      },
    }]
    : [];

  return (
    <div>
      <ClientsFilters
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearchSubmit}
        canCreate={canCreate}
        onCreate={startCreate}
        activeChips={activeChips}
        onClearAll={clearAllFilters}
      />

      {error && <FeedbackBanner variant="error">{error}</FeedbackBanner>}

      {editingId && (
        <form className="card form-card" onSubmit={handleSave} style={{ marginBottom: 'var(--space-3)' }}>
          <h3 style={{ marginTop: 0 }}>{editingId === 'new' ? 'New Client' : 'Edit Client'}</h3>
          <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
            <div className="field">
              <label htmlFor="client-form-name">Client Name *</label>
              <input
                id="client-form-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="client-form-code">Client Code</label>
              <input
                id="client-form-code"
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="Auto-generated if empty"
              />
            </div>
            <div className="field">
              <label htmlFor="client-form-status">Status</label>
              <AdaptiveSelect
                id="client-form-status"
                value={form.isActive ? 'active' : 'inactive'}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === 'active' }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </AdaptiveSelect>
            </div>
          </div>
          <div className="form-actions" style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
            <button type="button" className="btn secondary btn-compact" onClick={cancelEdit}>Cancel</button>
            <button type="submit" className="btn btn-compact" disabled={saving}>
              {saving ? 'Saving...' : 'Save Client'}
            </button>
          </div>
        </form>
      )}

      <div className="card card--flush table-wrap">
        {loading ? (
          <EmptyState title="Loading…" description="Fetching Clients." />
        ) : clients.length === 0 ? (
          <EmptyState
            title="No Clients found"
            description="Add a Client to link program configurations."
            action={canCreate ? (
              <button type="button" className="btn" onClick={startCreate}>New Client</button>
            ) : null}
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Code</th>
                  <th>Status</th>
                  {(canUpdate || canDelete) && <th className="inv-col-actions">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client._id}>
                    <td><strong>{client.name}</strong></td>
                    <td className="mono-sm">{client.code || '—'}</td>
                    <td>
                      <span className={`badge ${client.isActive ? 'tone-ok' : 'tone-neutral'}`}>
                        {client.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {(canUpdate || canDelete) && (
                      <td className="inv-col-actions">
                        <div className="actions" style={{ display: 'inline-flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
                          {canUpdate && (
                            <>
                              <button type="button" className="btn secondary btn-compact" onClick={() => startEdit(client)}>
                                Edit
                              </button>
                              <button type="button" className="btn secondary btn-compact" onClick={() => handleToggleStatus(client)}>
                                {client.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button type="button" className="btn danger btn-compact" onClick={() => handleDelete(client)}>
                              Archive
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        pagination={pagination}
        pageSize={pageSize}
        onPageChange={(nextPage) => loadClients(nextPage, pageSize)}
        onPageSizeChange={(nextPageSize) => { setPage(1); loadClients(1, nextPageSize); }}
        itemLabel="clients"
      />
    </div>
  );
}
