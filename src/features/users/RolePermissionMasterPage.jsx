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
  moduleIds: [],
  roleIds: [],
  isActive: true,
};

const DEFAULT_ACTIONS = [
  { id: 'all', label: 'All Access' },
  { id: 'view', label: 'View' },
  { id: 'add', label: 'Add' },
  { id: 'delete', label: 'Delete' },
  { id: 'upload', label: 'Upload' },
  { id: 'request', label: 'Request' },
  { id: 'approve', label: 'Approve' },
];

const WRITE_ACTIONS = new Set(['add', 'delete', 'upload', 'request', 'approve']);

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

function modulePermissionKeys(module) {
  return [...new Set(Object.values(module?.actions || {}).flat().filter(Boolean))];
}

function permissionKeysForModules(moduleList) {
  const keys = new Set();
  for (const m of moduleList) {
    for (const k of modulePermissionKeys(m)) keys.add(k);
  }
  return keys;
}

function roleTouchesModules(role, moduleIds, modules) {
  if (!moduleIds.length) return false;
  if (role?.permissions?.includes('*')) return true;
  if (moduleIds.includes('admin')) return role?.permissions?.includes('*');
  const selected = modules.filter((m) => moduleIds.includes(m.id));
  const keys = permissionKeysForModules(selected);
  return (role?.permissions || []).some((p) => keys.has(p));
}

function modulesCoveredByPermissions(permissions, modules) {
  const perms = new Set(permissions || []);
  if (perms.has('*')) return ['admin', ...modules.map((m) => m.id)];
  return modules
    .filter((m) => modulePermissionKeys(m).some((k) => perms.has(k)))
    .map((m) => m.id);
}

function actionKeys(module, actionId) {
  return module?.actions?.[actionId] || [];
}

function moduleHasAction(module, actionId) {
  return actionKeys(module, actionId).length > 0;
}

function keysGranted(permissions, keys) {
  if (!keys.length) return false;
  const set = new Set(permissions || []);
  if (set.has('*')) return true;
  return keys.every((k) => set.has(k));
}

function detectModuleActions(module, permissions) {
  const perms = permissions || [];
  const available = ACCESS_ACTION_IDS(module);
  if (perms.includes('*')) return available;
  if (available.includes('all') && keysGranted(perms, actionKeys(module, 'all'))) {
    return available;
  }
  const on = [];
  for (const id of available) {
    if (id === 'all') continue;
    if (keysGranted(perms, actionKeys(module, id))) on.push(id);
  }
  return on;
}

function ACCESS_ACTION_IDS(module) {
  return Object.keys(module?.actions || {}).filter((id) => module.actions[id]?.length);
}

function summarizeRoleForModules(role, moduleIds, modules) {
  if (role?.permissions?.includes('*')) return 'Admin all Access';
  const selected = modules.filter((m) => moduleIds.includes(m.id));
  const bits = [];
  for (const m of selected) {
    const actions = detectModuleActions(m, role.permissions || []).filter((a) => a !== 'all');
    const labels = actions.map((id) => {
      const found = DEFAULT_ACTIONS.find((a) => a.id === id);
      return found?.label || id;
    });
    if (detectModuleActions(m, role.permissions || []).includes('all')) {
      bits.push(`${m.label}: All Access`);
    } else if (labels.length) {
      bits.push(`${m.label}: ${labels.join(' + ')}`);
    }
  }
  return bits.length ? bits.join(' · ') : 'No matching rights';
}

function stripModulePermissions(permissions, module) {
  const drop = new Set(modulePermissionKeys(module));
  return (permissions || []).filter((p) => !drop.has(p));
}

function applyModuleAction(permissions, module, actionId, enabled) {
  let next = (permissions || []).filter((p) => p !== '*');
  const available = ACCESS_ACTION_IDS(module);

  if (actionId === 'all') {
    if (enabled) {
      const add = actionKeys(module, 'all');
      next = [...new Set([...stripModulePermissions(next, module), ...add])];
    } else {
      next = stripModulePermissions(next, module);
    }
    return next;
  }

  if (actionId === 'view' && !enabled) {
    return stripModulePermissions(next, module);
  }

  const keys = actionKeys(module, actionId);
  if (!keys.length) return next;

  if (enabled) {
    next = [...new Set([...next, ...keys])];
    if (WRITE_ACTIONS.has(actionId) && moduleHasAction(module, 'view')) {
      next = [...new Set([...next, ...actionKeys(module, 'view')])];
    }
  } else {
    const drop = new Set(keys);
    const stillOn = available.filter((id) => {
      if (id === actionId || id === 'all') return false;
      return keysGranted(next, actionKeys(module, id));
    });
    const keep = new Set(stillOn.flatMap((id) => actionKeys(module, id)));
    next = next.filter((p) => !drop.has(p) || keep.has(p));
  }

  // Sync "all": if every non-all action is on, ensure all keys present
  const nonAll = available.filter((id) => id !== 'all');
  const allOn = nonAll.every((id) => keysGranted(next, actionKeys(module, id)));
  if (allOn && moduleHasAction(module, 'all')) {
    next = [...new Set([...next, ...actionKeys(module, 'all')])];
  }

  return next;
}

function moduleActionOn(module, actionId, permissions) {
  if ((permissions || []).includes('*')) return true;
  if (actionId === 'all') {
    return keysGranted(permissions, actionKeys(module, 'all'));
  }
  return keysGranted(permissions, actionKeys(module, actionId));
}

export default function RolePermissionMasterPage() {
  const { can, user: me } = useAuth();
  const canWrite = can('users:write') || can('*');
  const canViewUsers = canWrite || can('users:read');
  const [tab, setTab] = useState('users');

  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [accessActions, setAccessActions] = useState(DEFAULT_ACTIONS);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState({ name: '', description: '', permissions: [], moduleIds: [] });
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

  const pickerModules = useMemo(
    () => [{ id: 'admin', label: 'Admin all Access', description: 'Full access to every module' }, ...modules],
    [modules]
  );

  const relevantRoles = useMemo(() => {
    if (userDraft.moduleIds.includes('admin')) {
      return roles.filter((r) => r.permissions?.includes('*'));
    }
    return roles.filter((r) => roleTouchesModules(r, userDraft.moduleIds, modules));
  }, [roles, userDraft.moduleIds, modules]);

  const visibleRoleModules = useMemo(() => {
    if (draft.permissions.includes('*') || draft.moduleIds.includes('admin')) return modules;
    return modules.filter((m) => draft.moduleIds.includes(m.id));
  }, [modules, draft.moduleIds, draft.permissions]);

  const loadRoles = () =>
    Promise.all([api('/users/roles'), api('/users/permissions')]).then(([r, p]) => {
      setRoles(r.data || []);
      setModules(p.data?.modules || []);
      if (Array.isArray(p.data?.actions) && p.data.actions.length) {
        setAccessActions(p.data.actions);
      }
      if (!selectedId && r.data?.[0]) setSelectedId(roleIdOf(r.data[0]));
    });

  const loadUsers = () =>
    api('/users')
      .then((r) => {
        const rows = r.data || [];
        setUsers(rows);
        setEditingUserId((cur) => cur || rows[0]?.id || '');
      })
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
    const permissions = [...(selected.permissions || [])];
    setDraft({
      name: selected.name || '',
      description: selected.description || '',
      permissions,
      moduleIds: modulesCoveredByPermissions(permissions, modules),
    });
  }, [selected, creating, modules]);

  useEffect(() => {
    if (creatingUser) return;
    if (!editingUser) {
      setUserDraft(EMPTY_USER);
      return;
    }
    const roleIds = (editingUser.roles || []).map((r) => String(r.id)).filter(Boolean);
    const assignedRoles = roles.filter((r) => roleIds.includes(roleIdOf(r)));
    const unionPerms = assignedRoles.flatMap((r) => r.permissions || []);
    setUserDraft({
      email: editingUser.email || '',
      username: editingUser.username || '',
      fullName: editingUser.fullName || '',
      phone: editingUser.phone || '',
      password: '',
      passwordConfirm: '',
      moduleIds: modulesCoveredByPermissions(unionPerms, modules),
      roleIds,
      isActive: editingUser.isActive !== false,
    });
  }, [editingUser, creatingUser, roles, modules]);

  const isAdminRole = selected?.name === 'Admin';
  const hasFullAccess = draft.permissions.includes('*') || draft.moduleIds.includes('admin');

  const toggleFullAccess = () => {
    if (!canWrite || isAdminRole) return;
    setDraft((prev) => {
      const nextFull = !(prev.permissions.includes('*') || prev.moduleIds.includes('admin'));
      return {
        ...prev,
        permissions: nextFull ? ['*'] : [],
        moduleIds: nextFull ? ['admin', ...modules.map((m) => m.id)] : [],
      };
    });
  };

  const toggleRoleModule = (moduleId) => {
    if (!canWrite || isAdminRole || hasFullAccess) return;
    if (moduleId === 'admin') {
      toggleFullAccess();
      return;
    }
    setDraft((prev) => {
      const has = prev.moduleIds.includes(moduleId);
      if (has) {
        const mod = modules.find((m) => m.id === moduleId);
        return {
          ...prev,
          moduleIds: prev.moduleIds.filter((x) => x !== moduleId),
          permissions: mod ? stripModulePermissions(prev.permissions, mod) : prev.permissions,
        };
      }
      return { ...prev, moduleIds: [...prev.moduleIds.filter((x) => x !== 'admin'), moduleId] };
    });
  };

  const toggleModuleAction = (module, actionId) => {
    if (!canWrite || isAdminRole || hasFullAccess) return;
    if (!moduleHasAction(module, actionId)) return;
    setDraft((prev) => {
      const on = moduleActionOn(module, actionId, prev.permissions);
      return {
        ...prev,
        permissions: applyModuleAction(prev.permissions, module, actionId, !on),
      };
    });
  };

  const toggleUserModule = (moduleId) => {
    if (!canWrite) return;
    setUserDraft((prev) => {
      if (moduleId === 'admin') {
        const has = prev.moduleIds.includes('admin');
        if (has) {
          return { ...prev, moduleIds: [], roleIds: [] };
        }
        const adminRole = roles.find((r) => r.permissions?.includes('*'));
        return {
          ...prev,
          moduleIds: ['admin', ...modules.map((m) => m.id)],
          roleIds: adminRole ? [roleIdOf(adminRole)] : prev.roleIds,
        };
      }
      const withoutAdmin = prev.moduleIds.filter((x) => x !== 'admin');
      const has = withoutAdmin.includes(moduleId);
      const moduleIds = has
        ? withoutAdmin.filter((x) => x !== moduleId)
        : [...withoutAdmin, moduleId];
      const roleIds = prev.roleIds.filter((rid) => {
        const role = roles.find((r) => roleIdOf(r) === rid);
        if (role?.permissions?.includes('*')) return false;
        return role && roleTouchesModules(role, moduleIds, modules);
      });
      return { ...prev, moduleIds, roleIds };
    });
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
      permissions: [],
      moduleIds: [],
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
    const full = draft.permissions.includes('*') || draft.moduleIds.includes('admin');
    if (!isAdminRole && !full && !draft.moduleIds.filter((id) => id !== 'admin').length) {
      setError('Select at least one module for this role');
      return;
    }
    const permissions = isAdminRole || full ? ['*'] : [...new Set(draft.permissions)];
    if (!isAdminRole && !permissions.includes('*') && !permissions.length) {
      setError('Turn on at least one action for the selected modules');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      if (creating) {
        const { data } = await api('/users/roles', {
          method: 'POST',
          body: {
            name: draft.name,
            description: draft.description,
            permissions,
          },
        });
        setCreating(false);
        await loadRoles();
        setSelectedId(roleIdOf(data));
        setMsg('Role saved.');
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
        setMsg('Role saved.');
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
    setUserDraft({ ...EMPTY_USER });
    setMsg('');
    setError('');
  };

  const cancelUserForm = () => {
    setCreatingUser(false);
    setEditingUserId(users[0]?.id || '');
    setUserDraft(EMPTY_USER);
  };

  const saveUser = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    if (!userDraft.moduleIds.length) {
      setError('Select at least one module');
      return;
    }
    if (!userDraft.roleIds.length) {
      setError('Select at least one role for the chosen modules');
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
        setMsg('User created.');
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
            ? 'Password and access saved. Use the new password on next sign-in.'
            : 'Access saved permanently.'
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

  const renderActionMatrix = () => {
    if (hasFullAccess || isAdminRole) {
      return <p className="muted rp-hint">Admin All Access is on. Every module is included.</p>;
    }
    if (!visibleRoleModules.length) {
      return <p className="muted rp-hint">Select modules above to set access actions.</p>;
    }
    return (
      <div className="rp-action-scroll">
        <table className="rp-action-grid">
          <thead>
            <tr>
              <th scope="col">Module</th>
              {accessActions.map((a) => (
                <th key={a.id} scope="col">
                  {a.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRoleModules.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.label}</strong>
                  <span className="muted rp-action-desc">{m.description}</span>
                </td>
                {accessActions.map((a) => {
                  const available = moduleHasAction(m, a.id);
                  if (!available) {
                    return (
                      <td key={a.id} className="rp-action-cell">
                        <span className="access-na">-</span>
                      </td>
                    );
                  }
                  const on = moduleActionOn(m, a.id, draft.permissions);
                  return (
                    <td key={a.id} className="rp-action-cell">
                      <label className={`access-toggle ${on ? 'is-on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!canWrite || isAdminRole}
                          onChange={() => toggleModuleAction(m, a.id)}
                        />
                        <span className="rp-action-short">{a.label}</span>
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.ROLES_PERMISSIONS }]}
      title={MODULE.ROLES_PERMISSIONS}
      description="Select modules, then set View, Add, Delete, Upload, Request, and Approve."
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
              New person
            </button>
          )}
          {canWrite && tab === 'roles' && (
            <button className="btn" type="button" onClick={startCreateRole}>
              New role
            </button>
          )}
        </>
      }
    >
      <div className="rp-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`rp-tab ${tab === 'users' ? 'is-active' : ''}`}
          aria-selected={tab === 'users'}
          onClick={() => setTab('users')}
        >
          People <span className="rp-tab-count">{users.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          className={`rp-tab ${tab === 'roles' ? 'is-active' : ''}`}
          aria-selected={tab === 'roles'}
          onClick={() => setTab('roles')}
        >
          Roles <span className="rp-tab-count">{roles.length}</span>
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {msg && <p className="rp-toast">{msg}</p>}

      {tab === 'users' && (
        <div className="rp-layout">
          <aside className="card rp-panel rp-panel--list">
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
                    {(u.roles || []).map((r) => r.name).filter(Boolean).join(', ') || 'No roles'}
                    {u.isActive === false ? ' · Inactive' : ''}
                  </span>
                </button>
              ))}
              {canViewUsers && !filteredUsers.length && (
                <p className="muted rp-empty">{users.length ? 'No matches.' : 'No users yet.'}</p>
              )}
            </div>
          </aside>

          <form className="card rp-panel" onSubmit={saveUser} autoComplete="off">
            {!creatingUser && !editingUser ? (
              <div className="rp-empty-state">
                <h3>Person details</h3>
                <p className="muted">Select someone on the left, or create a new person.</p>
              </div>
            ) : (
              <>
                <h3>{creatingUser ? 'Create person' : editingUser?.fullName || 'Person details'}</h3>
                {editingUser && !creatingUser && (
                  <p className="muted mono-sm rp-sub">{editingUser.email}</p>
                )}

                <section className="rp-section">
                  <h4>Profile</h4>
                  <div className="rp-form-grid">
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
                      ? 'At least 12 characters. Stored securely and kept across restarts.'
                      : passwordChangedLabel
                        ? `Last changed ${passwordChangedLabel}. Leave blank to keep current.`
                        : 'Leave blank to keep the current password (min 12 if resetting).'}
                  </p>
                  <div className="rp-form-grid">
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
                      <label>{creatingUser ? 'Confirm *' : 'Confirm new'}</label>
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
                  <h4>Applications *</h4>
                  <p className="muted rp-hint">
                    Choose which areas this person can open. Roles below update to match.
                  </p>
                  <div className="user-role-checks">
                    {pickerModules.map((m) => (
                      <label
                        key={m.id}
                        className={`perm-check ${userDraft.moduleIds.includes(m.id) ? 'is-on' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={userDraft.moduleIds.includes(m.id)}
                          disabled={!canWrite}
                          onChange={() => toggleUserModule(m.id)}
                        />
                        <span>
                          <strong>{m.label}</strong>
                          <em className="mono-sm">{m.description}</em>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="rp-section">
                  <h4>Roles *</h4>
                  {!userDraft.moduleIds.length ? (
                    <p className="muted rp-hint">Select modules first to see matching roles.</p>
                  ) : relevantRoles.length ? (
                    <>
                      <p className="muted rp-hint">
                        Only roles with access to the selected modules are shown.
                      </p>
                      <div className="user-role-checks">
                        {relevantRoles.map((r) => {
                          const id = roleIdOf(r);
                          return (
                            <label
                              key={id}
                              className={`perm-check ${userDraft.roleIds.includes(id) ? 'is-on' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={userDraft.roleIds.includes(id)}
                                disabled={!canWrite}
                                onChange={() => toggleUserRole(id)}
                              />
                              <span>
                                <strong>{r.name}</strong>
                                <em className="mono-sm">
                                  {summarizeRoleForModules(r, userDraft.moduleIds, modules)}
                                </em>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="muted rp-hint">
                      No roles cover these modules yet. Create or update a role under the Roles tab.
                    </p>
                  )}
                </section>

                {!creatingUser && (
                  <section className="rp-section">
                    <h4>Status</h4>
                    <label className={`perm-check ${userDraft.isActive ? 'is-on' : ''}`}>
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
                  </section>
                )}

                {canWrite && (
                  <div className="rp-actions">
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
        <div className="rp-layout">
          <aside className="card rp-panel rp-panel--list">
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
                        ? 'Admin all Access'
                        : `${(r.permissions || []).length} rights`}
                      {r.isSystem ? ' · Built-in' : ''}
                    </span>
                  </button>
                );
              })}
              {!roles.length && <p className="muted rp-empty">No roles yet.</p>}
            </div>
          </aside>

          <form className="card rp-panel" onSubmit={saveRole}>
            {!creating && !selected ? (
              <div className="rp-empty-state">
                <h3>Role access</h3>
                <p className="muted">Select a role to edit module access.</p>
              </div>
            ) : (
              <>
                <h3>{creating ? 'Create role' : selected?.name || 'Role access'}</h3>

                <section className="rp-section">
                  <h4>Details</h4>
                  <div className="rp-form-grid">
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
                  </div>
                </section>

                <section className="rp-section">
                  <h4>Applications *</h4>
                  <p className="muted rp-hint">
                    Select modules this role covers. Access actions below only show for those.
                  </p>
                  <div className="user-role-checks">
                    {pickerModules.map((m) => {
                      const checked =
                        m.id === 'admin'
                          ? hasFullAccess || isAdminRole
                          : hasFullAccess || isAdminRole || draft.moduleIds.includes(m.id);
                      return (
                        <label key={m.id} className={`perm-check ${checked ? 'is-on' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!canWrite || isAdminRole || (m.id !== 'admin' && hasFullAccess)}
                            onChange={() => toggleRoleModule(m.id)}
                          />
                          <span>
                            <strong>{m.label}</strong>
                            <em className="mono-sm">{m.description}</em>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>

                <section className="rp-section rp-section--modules">
                  <h4>Access control</h4>
                  <p className="muted rp-hint">
                    Toggle All Access, View, Add, Delete, Upload, Request, or Approve where available.
                  </p>
                  {renderActionMatrix()}
                </section>

                {canWrite && (
                  <div className="rp-actions">
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
