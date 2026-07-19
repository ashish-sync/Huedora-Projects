import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { userApi } from './campOpsApi.js';
import { Pagination } from './components/Pagination.jsx';
import { DEFAULT_PAGE_SIZE } from './constants/pagination.js';
import { MODULE } from '../../shared/labels.js';
import { apiErrorMessage } from './useCampOpsAuth.js';

export default function CampUsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userApi.list({
        search: search.trim() || undefined,
        page,
        limit: pageSize,
      });
      const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setUsers(rows);
      setPagination(data?.pagination || null);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load users. Full user admin is in Access Control.'));
      setUsers([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return (
    <div className="users-page">
      <div className="info-banner">
        Camp One user list is read-focused here. For roles and permissions, use{' '}
        <Link to="/role-permission-master">{MODULE.ROLES_PERMISSIONS}</Link>.
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel users-filter-panel">
        <label className="users-filter-label" htmlFor="camp-users-search">Search users</label>
        <div className="users-search-field">
          <input
            id="camp-users-search"
            className="users-search-input"
            placeholder="Name or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
          />
          <button type="button" className="btn btn-primary users-search-btn" onClick={loadUsers}>
            Search
          </button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="empty-state">Loading users…</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state">No users found.</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id || user.id || user.email}>
                    <td>{user.fullName || user.name || '—'}</td>
                    <td>{user.email || '—'}</td>
                    <td>{(user.role || '—').toString().replaceAll('_', ' ')}</td>
                    <td>
                      <span className={`status-pill ${user.isActive === false ? 'status-inactive' : 'status-active'}`}>
                        {user.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          pagination={pagination}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          itemLabel="users"
        />
      </div>
    </div>
  );
}
