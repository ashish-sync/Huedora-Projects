import { useEffect, useMemo, useState } from 'react';
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
  passwordConfirm: '',
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

function roleIdOf(r) {
  return String(r?._id || r?.id || r || '');
}

function formatWhen(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return null;
  }
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
  const [userQ, setUserQ] = useState('');
  const [userDraft, setUserDraft] = useState(EMPTY_USER);
  const [editingUserId, setEditingUserId] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const selected = useMemo(
    () => roles.find((r) => roleIdOf(r) === String(selectedId)) || null,
    [roles, selectedId]
  );

  const editingUser = useMemo(
    () => users.find((u) => String(u.id) === String(editingUserId)) || null,
    [users, editingUserId]
  );

  const filteredUsers = useMemo(() => {
    const q = userQ.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [u.fullName, u.email, u.username, ...(u.roles || []).map((r) => r.name)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [users, userQ]);

  const loadRoles = () =>
    Promise.all([api('/users/roles'), api('/users/permissions')]).then(([r, p]) => {
      setRoles(r.data || []);
      setModules(p.data?.modules || []);
      if (!selectedId && r.data?.[0]) setSelectedId(roleIdOf(r.data[0]));
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
      passwordConfirm: '',
      roleIds: (editingUser.roles || []).map((r) => String(r.id)).filter(Boolean),
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
    const id = String(roleId);
    setUserDraft((prev) => {
      const has = prev.roleIds.includes(id);
      return {
        ...prev,
        roleIds: has ? prev.roleIds.filter((x) => x !== id) : [...prev.roleIds, id],
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
    if (roles[0]) setSelectedId(roleIdOf(roles[0]));
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
        setSelectedId(roleIdOf(data));
        setMsg('Role saved. Module access will stick after server restart.');
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
        setMsg('Role saved. Module access will stick after server restart.');
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
      roleIds: defaultRole ? [roleIdOf(defaultRole)] : [],
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
    const pwd = userDraft.password.trim();
    if (creatingUser || pwd) {
      if (pwd.length < 12) {
        setError('Password must be at least 12 characters');
        return;
      }
      if (pwd !== userDraft.passwordConfirm) {
        setError('Password and confirmation do not match');
        return;
      }
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
            password: pwd,
            roleIds: userDraft.roleIds,
          },
        });
        setCreatingUser(false);
        await loadUsers();
        setEditingUserId(data.id);
        setMsg('User created. Password and roles are stored permanently.');
      } else if (editingUserId) {
        const body = {
          fullName: userDraft.fullName,
          phone: userDraft.phone,
          roleIds: userDraft.roleIds,
          isActive: userDraft.isActive,
        };
        if (pwd) body.password = pwd;
        await api(`/users/${editingUserId}`, { method: 'PATCH', body });
        await loadUsers();
        setUserDraft((prev) => ({ ...prev, password: '', passwordConfirm: '' }));
        setMsg(
          pwd
            ? 'Password and access saved. Sign in with the new password next time.'
            : 'User access saved. Changes stick after server restart.'
        );
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

  const passwordChangedLabel = formatWhen(editingUser?.passwordChangedAt);

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: 'Modules' }, { label: MODULE.ROLES_PERMISSIONS }]}
      title={MODULE.ROLES_PERMISSIONS}
      description="Manage who can sign in and what each role can open. Saves are permanent — they no longer reset when the server restarts."
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
          People
        </button>
        <button
          type="button"
          role="tab"
          className={`rp-tab ${tab === 'roles' ? 'is-active' : ''}`}
          aria-selected={tab === 'roles'}
          onClick={() => setTab('roles')}
        >
          Roles
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {msg && <p className="rp-toast">{msg}</p>}

      {tab === 'users' && (
        <div className="esign-detail-grid role-master-grid">
          <aside className="card rp-panel">
            <div className="rp-panel-head">
              <h3>People</h3>
              {canViewUsers && (
                <input
                  className="rp-search"
                  placeholder="Search name, email, role…"
                  value={userQ}
                  onChange={(e) => setUserQ(e.target.value)}
                />
              )}
            </div>
            {!canViewUsers && (
              <p className="muted">You need users:read or users:write to list users.</p>
            )}
            <div className="role-list">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`role-list-item ${
                    !creatingUser && String(editingUserId) === String(u.id) ? 'is-selected' : ''
                  }`}
                  onClick={() => {
                    setCreatingUser(false);
                    setEditingUserId(u.id);
                    setMsg('');
                    setError('');
                  }}
                >
                  <strong>
                    {u.fullName || u.email}
                    {String(u.id) === String(me?.id) ? ' (you)' : ''}
                  </strong>
                  <span className="muted mono-sm">
                    {u.email}
                    {(u.roles || []).length
                      ? ` · ${(u.roles || []).map((r) => r.name).filter(Boolean).join(', ')}`
                      : ' · No roles'}
                    {u.isActive === false ? ' · Inactive' : ''}
                  </span>
                </button>
              ))}
              {canViewUsers && !filteredUsers.length && (
                <p className="muted">{users.length ? 'No matches.' : 'No users yet.'}</p>
              )}
            </div>
          </aside>

          <form className="card rp-panel" onSubmit={saveUser} autoComplete="off">
            <h3>
              {creatingUser ? 'Create person' : editingUser ? 'Person details' : 'Person details'}
            </h3>
            {!creatingUser && !editingUser && (
              <p className="muted">Select someone on the left, or create a new person.</p>
            )}
            {(creatingUser || editingUser) && (
              <>
                <section className="rp-section">
                  <h4>Profile</h4>
                  <div className="row">
                    <div className="field">
                      <label>Full name *</label>
                      <input
                        required
                        value={userDraft.fullName}
                        disabled={!canWrite}
                        autoComplete="off"
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
                        autoComplete="off"
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
                        autoComplete="off"
                        onChange={(e) => setUserDraft({ ...userDraft, username: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Phone</label>
                      <input
                        value={userDraft.phone}
                        disabled={!canWrite}
                        autoComplete="off"
                        onChange={(e) => setUserDraft({ ...userDraft, phone: e.target.value })}
                      />
                    </div>
                  </div>
                </section>

                <section className="rp-section">
                  <h4>Password</h4>
                  <p className="muted rp-hint">
                    {creatingUser
                      ? 'Set a password of at least 12 characters. It is stored securely and will not revert on restart.'
                      : passwordChangedLabel
                        ? `Last changed ${passwordChangedLabel}. Leave blank to keep the current password.`
                        : 'Leave blank to keep the current password. New password must be at least 12 characters.'}
                  </p>
                  <div className="row">
                    <div className="field">
                      <label>{creatingUser ? 'Password *' : 'New password'}</label>
                      <input
                        required={creatingUser}
                        type="password"
                        minLength={12}
                        value={userDraft.password}
                        disabled={!canWrite}
                        placeholder="Min 12 characters"
                        autoComplete="new-password"
                        onChange={(e) => setUserDraft({ ...userDraft, password: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>{creatingUser ? 'Confirm password *' : 'Confirm new password'}</label>
                      <input
                        required={creatingUser || Boolean(userDraft.password)}
                        type="password"
                        minLength={12}
                        value={userDraft.passwordConfirm}
                        disabled={!canWrite}
                        placeholder="Repeat password"
                        autoComplete="new-password"
                        onChange={(e) =>
                          setUserDraft({ ...userDraft, passwordConfirm: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </section>

                <section className="rp-section">
                  <h4>Access *</h4>
                  <p className="muted rp-hint">
                    Pick one or more roles. Module rights come from the Roles tab.
                  </p>
                  <div className="user-role-checks">
                    {roles.map((r) => {
                      const id = roleIdOf(r);
                      return (
                        <label key={id} className={`perm-check ${userDraft.roleIds.includes(id) ? 'is-on' : ''}`}>
                          <input
                            type="checkbox"
                            checked={userDraft.roleIds.includes(id)}
                            disabled={!canWrite}
                            onChange={() => toggleUserRole(id)}
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
                      );
                    })}
                  </div>
                </section>

                {!creatingUser && (
                  <label className="perm-check user-active-toggle">
                    <input
                      type="checkbox"
                      checked={userDraft.isActive}
                      disabled={!canWrite || String(editingUserId) === String(me?.id)}
                      onChange={(e) => setUserDraft({ ...userDraft, isActive: e.target.checked })}
                    />
                    <span>
                      <strong>Account active</strong>
                      <em className="mono-sm">Inactive people cannot sign in</em>
                    </span>
                  </label>
                )}

                {canWrite && (
                  <div className="row rp-actions">
                    <button className="btn" type="submit" disabled={busy}>
                      {busy ? 'Saving…' : creatingUser ? 'Create person' : 'Save changes'}
                    </button>
                    {(creatingUser || editingUserId) && (
                      <button className="btn secondary" type="button" onClick={cancelUserForm}>
                        Cancel
                      </button>
                    )}
                    {!creatingUser && editingUserId && String(editingUserId) !== String(me?.id) && (
                      <button className="btn danger" type="button" onClick={removeUser}>
                        Delete
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
          <aside className="card rp-panel">
            <div className="rp-panel-head">
              <h3>Roles</h3>
            </div>
            <div className="role-list">
              {roles.map((r) => {
                const id = roleIdOf(r);
                return (
                  <button
                    key={id}
                    type="button"
                    className={`role-list-item ${
                      !creating && String(selectedId) === id ? 'is-selected' : ''
                    }`}
                    onClick={() => {
                      setCreating(false);
                      setSelectedId(id);
                      setMsg('');
                    }}
                  >
                    <strong>{r.name}</strong>
                    <span className="muted mono-sm">
                      {r.permissions?.includes('*')
                        ? 'Full access'
                        : `${(r.permissions || []).length} module right(s)`}
                      {r.isSystem ? ' · Built-in' : ''}
                    </span>
                  </button>
                );
              })}
              {!roles.length && <p className="muted">No roles yet.</p>}
            </div>
          </aside>

          <form className="card rp-panel" onSubmit={saveRole}>
            <h3>{creating ? 'Create role' : 'Role access'}</h3>
            {!creating && !selected && <p className="muted">Select a role to edit module access.</p>}
            {(creating || selected) && (
              <>
                <section className="rp-section">
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
                </section>

                <label className={`perm-check user-active-toggle ${hasFullAccess || isAdminRole ? 'is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={hasFullAccess || isAdminRole}
                    disabled={!canWrite || isAdminRole}
                    onChange={toggleFullAccess}
                  />
                  <span>
                    <strong>Full access</strong>
                    <em className="mono-sm">Read &amp; write on every module</em>
                  </span>
                </label>

                <section className="rp-section">
                  <h4>Modules</h4>
                  <p className="muted rp-hint">
                    Turn Read / Write on for each module. Changes stick after you click Save.
                  </p>
                  <div className="rp-module-grid">
                    {modules.map((m) => (
                      <div key={m.id} className="rp-module-card">
                        <div className="rp-module-card-copy">
                          <strong>{m.label}</strong>
                          <span className="muted">{m.description}</span>
                        </div>
                        <div className="rp-module-toggles">
                          {m.readKey ? (
                            <label className={`access-toggle ${moduleHasAccess(m, 'read') ? 'is-on' : ''}`}>
                              <input
                                type="checkbox"
                                checked={moduleHasAccess(m, 'read')}
                                disabled={!canWrite || isAdminRole || hasFullAccess}
                                onChange={() => toggleModuleAccess(m, 'read')}
                              />
                              <span>Read</span>
                            </label>
                          ) : (
                            <span className="muted access-toggle">—</span>
                          )}
                          {m.writeKey ? (
                            <label className={`access-toggle ${moduleHasAccess(m, 'write') ? 'is-on' : ''}`}>
                              <input
                                type="checkbox"
                                checked={moduleHasAccess(m, 'write')}
                                disabled={!canWrite || isAdminRole || hasFullAccess}
                                onChange={() => toggleModuleAccess(m, 'write')}
                              />
                              <span>Write</span>
                            </label>
                          ) : (
                            <span className="muted access-toggle">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {canWrite && (
                  <div className="row rp-actions">
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
