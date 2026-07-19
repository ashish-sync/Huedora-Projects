import { useEffect, useState } from 'react';
import { clientApi } from '../campOpsApi.js';
import { trimFormStrings, trimString } from '../utils/trimInput';
import { Pagination } from './Pagination';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { ClientsFilters } from './ClientsFilters';

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
      setError(err?.message || 'Failed to load clients');
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
      setError(err?.message || 'Failed to save client');
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

      {error && (
        <div className="page-alerts">
          <div className="error-banner">{error}</div>
        </div>
      )}

      {editingId && (
        <form className="form-card" onSubmit={handleSave} style={{ marginBottom: '1rem' }}>
          <h3>{editingId === 'new' ? 'New Client' : 'Edit Client'}</h3>
          <div className="form-grid">
            <label>
              Client Name
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </label>
            <label>
              Client Code
              <input
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="Auto-generated if empty"
              />
            </label>
            <label>
              Status
              <select
                value={form.isActive ? 'active' : 'inactive'}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === 'active' }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Client'}
            </button>
          </div>
        </form>
      )}

      <div className="table-card">
        {loading ? (
          <div className="empty-state">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="empty-state">No clients found.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Code</th>
                  <th>Status</th>
                  {(canUpdate || canDelete) && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client._id}>
                    <td>{client.name}</td>
                    <td>{client.code}</td>
                    <td>{client.isActive ? 'Active' : 'Inactive'}</td>
                    {(canUpdate || canDelete) && (
                      <td>
                        <div className="actions">
                          {canUpdate && (
                            <>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(client)}>
                                Edit
                              </button>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleToggleStatus(client)}>
                                {client.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(client)}>
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
