import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadExcel } from '../../shared/api.js';
import { MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';

const EMPTY_USER = {
  email: '',
  username: '',
  fullName: '',
  phone: '',
  password: '',
  roleIds: [],
  isActive: true,
};

function expandModulePermissions(modules, permissions) {
  const set = new Set(permissions);
  if (set.has('*')) return ['*'];
  for (const m of modules) {
    if (m.writeKey && set.has(m.writeKey)) {
      for (const k of m.writeIncludes || []) set.add(k);
    }
    if (m.readKey && set.has(m.readKey)) {
      for (const k of m.readIncludes || []) set.add(k);
    }
  }
  return [...set];
}

export default function RolePermissionMasterPage() {
  const { can, user: me } = useAuth();
  const canWrite = can('users:write') || can('*');
  const canViewUsers = canWrite || can('users:read');
  const [tab, setTab] = useState('users');

  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState({ name: '', description: '', permissions: [] });
  const [creating, setCreating] = useState(false);

  const [users, setUsers] = useState([]);
  const [userDraft, setUserDraft] = useState(EMPTY_USER);
  const [editingUserId, setEditingUserId] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const selected = useMemo(
    () => roles.find((r) => r._id === selectedId) || null,
    [roles, selectedId]
  );

  const editingUser = useMemo(
    () => users.find((u) => u.id === editingUserId) || null,
    [users, editingUserId]
  );

  const loadRoles = () =>
    Promise.all([api('/users/roles'), api('/users/permissions')]).then(([r, p]) => {
      setRoles(r.data || []);
      setModules(p.data?.modules || []);
      if (!selectedId && r.data?.[0]) setSelectedId(r.data[0]._id);
    });

  const loadUsers = () =>
    api('/users')
      .then((r) => setUsers(r.data || []))
      .catch((e) => {
        if (canViewUsers) setError(e.message);
      });

  const load = () =>
    Promise.all([loadRoles(), canViewUsers ? loadUsers() : Promise.resolve()]).catch((e) =>
      setError(e.message)
    );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected || creating) return;
    setDraft({
      name: selected.name || '',
      description: selected.description || '',
      permissions: [...(selected.permissions || [])],
    });
  }, [selected, creating]);

  useEffect(() => {
    if (creatingUser) return;
    if (!editingUser) {
      setUserDraft(EMPTY_USER);
      return;
    }
    setUserDraft({
      email: editingUser.email || '',
      username: editingUser.username || '',
      fullName: editingUser.fullName || '',
      phone: editingUser.phone || '',
      password: '',
      roleIds: (editingUser.roles || []).map((r) => r.id),
      isActive: editingUser.isActive !== false,
    });
  }, [editingUser, creatingUser]);

  const isAdminRole = selected?.name === 'Admin';
  const hasFullAccess = draft.permissions.includes('*');

  const moduleHasAccess = (module, type) => {
    if (hasFullAccess) return true;
    const key = type === 'read' ? module.readKey : module.writeKey;
    if (!key) return false;
    if (draft.permissions.includes(key)) return true;
    if (type === 'write' && (module.writeIncludes || []).some((k) => draft.permissions.includes(k))) {
      return draft.permissions.includes(module.writeKey);
    }
    return false;
  };

  const toggleModuleAccess = (module, type) => {
    if (!canWrite || isAdminRole) return;
    const key = type === 'read' ? module.readKey : module.writeKey;
    if (!key) return;
    setDraft((prev) => {
      let next = prev.permissions.filter((p) => p !== '*');
      const on = next.includes(key);
      if (on) {
        next = next.filter((p) => p !== key);
        const extras = type === 'write' ? module.writeIncludes || [] : module.readIncludes || [];
        next = next.filter((p) => !extras.includes(p));
      } else {
        next.push(key);
        if (type === 'write' && module.readKey && !next.includes(module.readKey)) {
          next.push(module.readKey);
        }
      }
      return { ...prev, permissions: expandModulePermissions(modules, next) };
    });
  };

  const toggleFullAccess = () => {
    if (!canWrite || isAdminRole) return;
    setDraft((prev) => ({
      ...prev,
      permissions: prev.permissions.includes('*') ? [] : ['*'],
    }));
  };

  const toggleUserRole = (roleId) => {
    if (!canWrite) return;
    setUserDraft((prev) => {
      const has = prev.roleIds.includes(roleId);
      return {
        ...prev,
        roleIds: has ? prev.roleIds.filter((id) => id !== roleId) : [...prev.roleIds, roleId],
      };
    });
  };

  const startCreateRole = () => {
    setTab('roles');
    setCreating(true);
    setSelectedId('');
    setDraft({
      name: '',
      description: '',
      permissions: expandModulePermissions(modules, ['dashboards:read', 'notifications:read']),
    });
    setMsg('');
    setError('');
  };

  const cancelCreateRole = () => {
    setCreating(false);
    if (roles[0]) setSelectedId(roles[0]._id);
  };

  const saveRole = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const permissions = isAdminRole
        ? ['*']
        : expandModulePermissions(modules, draft.permissions);
      if (creating) {
        const { data } = await api('/users/roles', {
          method: 'POST',
          body: { ...draft, permissions },
        });
        setCreating(false);
        await loadRoles();
        setSelectedId(data._id);
        setMsg('Role created');
      } else if (selectedId) {
        await api(`/users/roles/${selectedId}`, {
          method: 'PATCH',
          body: {
            name: draft.name,
            description: draft.description,
            permissions,
          },
        });
        await loadRoles();
        setMsg('Role updated');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeRole = async () => {
    if (!selectedId || !canWrite || selected?.isSystem || isAdminRole) return;
    if (!window.confirm(`Remove role “${selected.name}”?`)) return;
    try {
      await api(`/users/roles/${selectedId}`, { method: 'DELETE' });
      setSelectedId('');
      await loadRoles();
      setMsg('Role removed');
    } catch (err) {
      setError(err.message);
    }
  };

  const startCreateUser = () => {
    setTab('users');
    setCreatingUser(true);
    setEditingUserId('');
    const defaultRole =
      roles.find((r) => r.name === 'Verifier') ||
      roles.find((r) => r.name !== 'Admin') ||
      roles[0];
    setUserDraft({
      ...EMPTY_USER,
      roleIds: defaultRole ? [defaultRole._id] : [],
    });
    setMsg('');
    setError('');
  };

  const cancelUserForm = () => {
    setCreatingUser(false);
    setEditingUserId('');
    setUserDraft(EMPTY_USER);
  };

  const saveUser = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    if (!userDraft.roleIds.length) {
      setError('Select at least one role');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      if (creatingUser) {
        const { data } = await api('/users', {
          method: 'POST',
          body: {
            email: userDraft.email,
            username: userDraft.username,
            fullName: userDraft.fullName,
            phone: userDraft.phone,
            password: userDraft.password,
            roleIds: userDraft.roleIds,
          },
        });
        setCreatingUser(false);
        await loadUsers();
        setEditingUserId(data.id);
        setMsg('User created');
      } else if (editingUserId) {
        const body = {
          fullName: userDraft.fullName,
          phone: userDraft.phone,
          roleIds: userDraft.roleIds,
          isActive: userDraft.isActive,
        };
        if (userDraft.password) body.password = userDraft.password;
        await api(`/users/${editingUserId}`, { method: 'PATCH', body });
        await loadUsers();
        setMsg('User updated');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async () => {
    if (!editingUserId || !canWrite || editingUserId === me?.id) return;
    if (!window.confirm(`Delete user “${editingUser?.fullName || editingUser?.email}”?`)) return;
    try {
      await api(`/users/${editingUserId}`, { method: 'DELETE' });
      setEditingUserId('');
      await loadUsers();
      setMsg('User deleted');
    } catch (err) {
      setError(err.message);
    }
  };

  const downloadMaster = async () => {
    setError('');
    setExportBusy(true);
    try {
      if (tab === 'roles') {
        await downloadExcel('/users/roles/export', 'Roles_Master.xlsx');
      } else {
        await downloadExcel('/users/export', 'Users_Master.xlsx');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: 'Modules' }, { label: MODULE.ROLES_PERMISSIONS }]}
      title={MODULE.ROLES_PERMISSIONS}
      actions={
        <>
          <button
            className="btn secondary"
            type="button"
            disabled={exportBusy || (tab === 'users' && !canViewUsers)}
            onClick={downloadMaster}
          >
            {exportBusy ? 'Downloading…' : 'Download Excel'}
          </button>
          {canWrite && tab === 'users' && (
            <button className="btn" type="button" onClick={startCreateUser}>
              New user
            </button>
          )}
          {canWrite && tab === 'roles' && (
            <button className="btn" type="button" onClick={startCreateRole}>
              New role
            </button>
          )}
        </>
      }
      kpis={[
        { label: 'Users', value: users.length },
        { label: 'Roles', value: roles.length },
      ]}
    >
      <div className="rp-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`rp-tab ${tab === 'users' ? 'is-active' : ''}`}
          aria-selected={tab === 'users'}
          onClick={() => setTab('users')}
        >
          Users
        </button>
        <button
          type="button"
          role="tab"
          className={`rp-tab ${tab === 'roles' ? 'is-active' : ''}`}
          aria-selected={tab === 'roles'}
          onClick={() => setTab('roles')}
        >
          Roles &amp; module access
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {msg && <p className="muted">{msg}</p>}

      {tab === 'users' && (
        <div className="esign-detail-grid role-master-grid">
          <aside className="card">
            <h3 style={{ marginTop: 0 }}>Users</h3>
            {!canViewUsers && <p className="muted">You need users:read or users:write to list users.</p>}
            <div className="role-list">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`role-list-item ${!creatingUser && editingUserId === u.id ? 'is-selected' : ''}`}
                  onClick={() => {
                    setCreatingUser(false);
                    setEditingUserId(u.id);
                    setMsg('');
                    setError('');
                  }}
                >
                  <strong>{u.fullName || u.email}</strong>
                  <span className="muted mono-sm">
                    {u.email}
                    {(u.roles || []).length
                      ? ` · ${(u.roles || []).map((r) => r.name).join(', ')}`
                      : ' · No roles'}
                    {u.isActive === false ? ' · Inactive' : ''}
                  </span>
                </button>
              ))}
              {canViewUsers && !users.length && <p className="muted">No users yet.</p>}
            </div>
          </aside>

          <form className="card" onSubmit={saveUser}>
            <h3 style={{ marginTop: 0 }}>
              {creatingUser ? 'Create user' : editingUser ? 'Manage user' : 'User details'}
            </h3>
            {!creatingUser && !editingUser && (
              <p className="muted">Select a user to manage access, or create a new one.</p>
            )}
            {(creatingUser || editingUser) && (
              <>
                <div className="row">
                  <div className="field">
                    <label>Full name *</label>
                    <input
                      required
                      value={userDraft.fullName}
                      disabled={!canWrite}
                      onChange={(e) => setUserDraft({ ...userDraft, fullName: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Email *</label>
                    <input
                      required
                      type="email"
                      value={userDraft.email}
                      disabled={!canWrite || !creatingUser}
                      onChange={(e) => setUserDraft({ ...userDraft, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="row">
                  <div className="field">
                    <label>Username *</label>
                    <input
                      required
                      value={userDraft.username}
                      disabled={!canWrite || !creatingUser}
                      onChange={(e) => setUserDraft({ ...userDraft, username: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Phone</label>
                    <input
                      value={userDraft.phone}
                      disabled={!canWrite}
                      onChange={(e) => setUserDraft({ ...userDraft, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>
                    {creatingUser ? 'Password *' : 'Reset password'}
                    {!creatingUser && <span className="muted"> — leave blank to keep current</span>}
                  </label>
                  <input
                    required={creatingUser}
                    type="password"
                    minLength={10}
                    value={userDraft.password}
                    disabled={!canWrite}
                    placeholder={creatingUser ? 'Min 12 characters' : 'Optional new password'}
                    onChange={(e) => setUserDraft({ ...userDraft, password: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label>Access roles *</label>
                  <div className="user-role-checks">
                    {roles.map((r) => (
                      <label key={r._id} className="perm-check">
                        <input
                          type="checkbox"
                          checked={userDraft.roleIds.includes(r._id)}
                          disabled={!canWrite}
                          onChange={() => toggleUserRole(r._id)}
                        />
                        <span>
                          <strong>{r.name}</strong>
                          <em className="mono-sm">
                            {r.permissions?.includes('*')
                              ? 'Full access'
                              : `${(r.permissions || []).length} permission(s)`}
                          </em>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {!creatingUser && (
                  <label className="perm-check user-active-toggle">
                    <input
                      type="checkbox"
                      checked={userDraft.isActive}
                      disabled={!canWrite || editingUserId === me?.id}
                      onChange={(e) => setUserDraft({ ...userDraft, isActive: e.target.checked })}
                    />
                    <span>
                      <strong>Account active</strong>
                      <em className="mono-sm">Inactive users cannot sign in</em>
                    </span>
                  </label>
                )}

                {canWrite && (
                  <div className="row" style={{ marginTop: 12 }}>
                    <button className="btn" type="submit" disabled={busy}>
                      {busy ? 'Saving…' : creatingUser ? 'Create user' : 'Save user'}
                    </button>
                    {(creatingUser || editingUserId) && (
                      <button className="btn secondary" type="button" onClick={cancelUserForm}>
                        Cancel
                      </button>
                    )}
                    {!creatingUser && editingUserId && editingUserId !== me?.id && (
                      <button className="btn danger" type="button" onClick={removeUser}>
                        Delete user
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </form>
        </div>
      )}

      {tab === 'roles' && (
        <div className="esign-detail-grid role-master-grid">
          <aside className="card">
            <h3 style={{ marginTop: 0 }}>Roles</h3>
            <div className="role-list">
              {roles.map((r) => (
                <button
                  key={r._id}
                  type="button"
                  className={`role-list-item ${!creating && selectedId === r._id ? 'is-selected' : ''}`}
                  onClick={() => {
                    setCreating(false);
                    setSelectedId(r._id);
                    setMsg('');
                  }}
                >
                  <strong>{r.name}</strong>
                  <span className="muted mono-sm">
                    {r.permissions?.includes('*')
                      ? 'Full access'
                      : `${(r.permissions || []).length} permission(s)`}
                    {r.isSystem ? ' · System' : ''}
                  </span>
                </button>
              ))}
              {!roles.length && <p className="muted">No roles yet.</p>}
            </div>
          </aside>

          <form className="card" onSubmit={saveRole}>
            <h3 style={{ marginTop: 0 }}>{creating ? 'Create role' : 'Edit role'}</h3>
            {!creating && !selected && <p className="muted">Select a role to set module access.</p>}
            {(creating || selected) && (
              <>
                <div className="field">
                  <label>Role name *</label>
                  <input
                    required
                    value={draft.name}
                    disabled={!canWrite || isAdminRole}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Description</label>
                  <input
                    value={draft.description}
                    disabled={!canWrite}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="What this role is for"
                  />
                </div>

                <label className="perm-check user-active-toggle">
                  <input
                    type="checkbox"
                    checked={hasFullAccess || isAdminRole}
                    disabled={!canWrite || isAdminRole}
                    onChange={toggleFullAccess}
                  />
                  <span>
                    <strong>Full access (all modules)</strong>
                    <em className="mono-sm">Admin override — Read &amp; Write everywhere</em>
                  </span>
                </label>

                <div className="module-access-table-wrap">
                  <table className="module-access-table">
                    <thead>
                      <tr>
                        <th>Module</th>
                        <th>Read</th>
                        <th>Write</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modules.map((m) => (
                        <tr key={m.id}>
                          <td>
                            <strong>{m.label}</strong>
                            <div className="muted mono-sm">{m.description}</div>
                          </td>
                          <td>
                            {m.readKey ? (
                              <label className="access-toggle">
                                <input
                                  type="checkbox"
                                  checked={moduleHasAccess(m, 'read')}
                                  disabled={
                                    !canWrite ||
                                    isAdminRole ||
                                    hasFullAccess
                                  }
                                  onChange={() => toggleModuleAccess(m, 'read')}
                                />
                                <span>Read</span>
                              </label>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td>
                            {m.writeKey ? (
                              <label className="access-toggle">
                                <input
                                  type="checkbox"
                                  checked={moduleHasAccess(m, 'write')}
                                  disabled={
                                    !canWrite ||
                                    isAdminRole ||
                                    hasFullAccess
                                  }
                                  onChange={() => toggleModuleAccess(m, 'write')}
                                />
                                <span>Write</span>
                              </label>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {canWrite && (
                  <div className="row" style={{ marginTop: 12 }}>
                    <button className="btn" type="submit" disabled={busy}>
                      {busy ? 'Saving…' : creating ? 'Create role' : 'Save access'}
                    </button>
                    {creating && (
                      <button className="btn secondary" type="button" onClick={cancelCreateRole}>
                        Cancel
                      </button>
                    )}
                    {!creating && selected && !selected.isSystem && !isAdminRole && (
                      <button className="btn danger" type="button" onClick={removeRole}>
                        Remove role
                      </button>
                    )}
                  </div>
                )}
                {!canWrite && (
                  <p className="muted">You can view roles. Editing requires users:write.</p>
                )}
              </>
            )}
          </form>
        </div>
      )}
    </PageShell>
  );
}
