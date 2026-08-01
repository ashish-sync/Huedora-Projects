import { useEffect, useMemo, useRef, useState } from 'react';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import { api, downloadExcel } from '../../shared/api.js';
import { MODULE, ACTION } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import { formatDateTime } from '../../shared/dateFormat.js';
import PageShell from '../../components/ui/PageShell.jsx';
import OrgHierarchyPanel from './OrgHierarchyPanel.jsx';
import {
  DESIGNATION_ACCESS_TEMPLATES,
  getDesignationAccessTemplate,
} from './designationAccess.js';
import {
  buildUserAccessDraft,
  hasAnyModuleAccess,
  permissionsFromModuleMatrix,
  tierIsOnInMatrix,
  tiersForModule,
  toggleModuleTierInMatrix,
} from './moduleAccessTiers.js';

const EMPTY_USER = {
  email: '',
  username: '',
  fullName: '',
  phone: '',
  designation: '',
  reportingManagerId: '',
  password: '',
  passwordConfirm: '',
  roleIds: [],
  moduleAccess: {},
  isActive: true,
};

function roleIdOf(r) {
  return String(r?._id || r?.id || r || '');
}

function buildUserDraftFromRecord(user, modules, roles) {
  if (!user) return { ...EMPTY_USER };
  const access = buildUserAccessDraft(user, modules, roles, roleIdOf);
  return {
    email: user.email || '',
    username: user.username || '',
    fullName: user.fullName || '',
    phone: user.phone || '',
    designation: user.designation || '',
    reportingManagerId: user.reportingManagerId ? String(user.reportingManagerId) : '',
    password: '',
    passwordConfirm: '',
    roleIds: access.roleIds,
    moduleAccess: access.moduleAccess,
    isActive: user.isActive !== false,
  };
}

function resolveAccessPayload(userDraft, modules, roles) {
  const adminRole = roles.find((r) => r.permissions?.includes('*'));
  const adminRoleId = adminRole ? roleIdOf(adminRole) : '';
  const hasAdmin = Boolean(adminRoleId && userDraft.roleIds.includes(adminRoleId));
  if (hasAdmin) {
    return { roleIds: [adminRoleId], grantedPermissions: [] };
  }
  const grantedPermissions = permissionsFromModuleMatrix(modules, userDraft.moduleAccess);
  if (!grantedPermissions.length) {
    return null;
  }
  return { roleIds: [], grantedPermissions };
}

function mergeUserRecord(users, saved) {
  if (!saved?.id) return users;
  const idx = users.findIndex((u) => String(u.id) === String(saved.id));
  if (idx < 0) return [...users, saved];
  const next = [...users];
  next[idx] = saved;
  return next;
}

function formatWhen(iso) {
  if (!iso) return null;
  return formatDateTime(iso) === '-' ? null : formatDateTime(iso);
}

export default function RolePermissionMasterPage() {
  const { can, user: me } = useAuth();
  const canWrite = can('users:write') || can('*');
  const canDelete = can('*');
  const canViewUsers = canWrite || can('users:read');
  const [tab, setTab] = useState('users');

  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);

  const [users, setUsers] = useState([]);
  const [userQ, setUserQ] = useState('');
  const [userDraft, setUserDraft] = useState(EMPTY_USER);
  const [editingUserId, setEditingUserId] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [designations, setDesignations] = useState([]);
  const [designationTemplates, setDesignationTemplates] = useState({});

  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const usersLoadSeq = useRef(0);
  const skipDraftSyncRef = useRef(false);
  const syncedUserIdRef = useRef('');

  const editingUser = useMemo(
    () => users.find((u) => String(u.id) === String(editingUserId)) || null,
    [users, editingUserId]
  );

  const filteredUsers = useMemo(() => {
    const q = userQ.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [
        u.fullName,
        u.email,
        u.username,
        u.designation,
        u.reportingManager?.fullName,
        ...(u.roles || []).map((r) => r.name),
      ]
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
    });

  const loadUsers = () => {
    const seq = ++usersLoadSeq.current;
    return api('/users?limit=200')
      .then((r) => {
        if (seq !== usersLoadSeq.current) return;
        const rows = r.data || [];
        setUsers(rows);
        setEditingUserId((cur) => cur || rows[0]?.id || '');
      })
      .catch((e) => {
        if (seq !== usersLoadSeq.current) return;
        if (canViewUsers) setError(e.message);
      });
  };

  const load = () =>
    Promise.all([loadRoles(), canViewUsers ? loadUsers() : Promise.resolve()]).catch((e) =>
      setError(e.message)
    );

  useEffect(() => {
    load();
    if (canViewUsers) {
      api('/users/designations')
        .then((res) => {
          setDesignations(res.data || []);
          setDesignationTemplates({
            ...DESIGNATION_ACCESS_TEMPLATES,
            ...(res.accessTemplates || {}),
          });
        })
        .catch(() => {
          setDesignationTemplates({ ...DESIGNATION_ACCESS_TEMPLATES });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipDraftSyncRef.current) {
      skipDraftSyncRef.current = false;
      return;
    }
    if (creatingUser) {
      syncedUserIdRef.current = '';
      return;
    }
    if (!editingUserId) {
      syncedUserIdRef.current = '';
      setUserDraft(EMPTY_USER);
      return;
    }
    const userKey = String(editingUserId);
    if (syncedUserIdRef.current === userKey) return;

    const user = users.find((u) => String(u.id) === userKey);
    if (!user) return;

    syncedUserIdRef.current = userKey;
    setUserDraft(buildUserDraftFromRecord(user, modules, roles));
  }, [editingUserId, creatingUser, users, modules, roles]);

  const toggleUserRole = (roleId) => {
    if (!canWrite) return;
    const id = String(roleId);
    const role = roles.find((r) => roleIdOf(r) === id);
    const isAdmin = role?.permissions?.includes('*');
    setUserDraft((prev) => {
      const has = prev.roleIds.includes(id);
      if (isAdmin) {
        return has
          ? { ...prev, roleIds: [], moduleAccess: { ...prev.moduleAccess } }
          : { ...prev, roleIds: [id], moduleAccess: {} };
      }
      if (has) {
        return { ...prev, roleIds: prev.roleIds.filter((x) => x !== id) };
      }
      const adminRole = roles.find((r) => r.permissions?.includes('*'));
      const adminId = adminRole ? roleIdOf(adminRole) : '';
      return { ...prev, roleIds: [...prev.roleIds.filter((x) => x !== adminId), id] };
    });
  };

  const toggleModuleTier = (module, tier) => {
    if (!canWrite) return;
    setUserDraft((prev) => {
      const adminRole = roles.find((r) => r.permissions?.includes('*'));
      const adminId = adminRole ? roleIdOf(adminRole) : '';
      return {
        ...prev,
        roleIds: adminId ? prev.roleIds.filter((x) => x !== adminId) : prev.roleIds,
        moduleAccess: toggleModuleTierInMatrix(prev.moduleAccess, module, tier),
      };
    });
  };

  const startCreateUser = () => {
    setTab('users');
    setCreatingUser(true);
    setEditingUserId('');
    syncedUserIdRef.current = '';
    setUserDraft({ ...EMPTY_USER });
    setMsg('');
    setError('');
  };

  const cancelUserForm = () => {
    setCreatingUser(false);
    syncedUserIdRef.current = '';
    setEditingUserId(users[0]?.id || '');
    setUserDraft(EMPTY_USER);
  };

  const openPersonFromHierarchy = (userId) => {
    if (!userId) return;
    setTab('users');
    setCreatingUser(false);
    syncedUserIdRef.current = '';
    setEditingUserId(String(userId));
    setMsg('');
    setError('');
  };

  const managerOptions = useMemo(() => {
    const excludeId = creatingUser ? '' : String(editingUserId || '');
    return users
      .filter((u) => u.isActive !== false && String(u.id) !== excludeId)
      .sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email));
  }, [users, creatingUser, editingUserId]);

  const saveUser = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    const access = resolveAccessPayload(userDraft, modules, roles);
    if (!access) {
      setError('Assign at least one access option in Control Center below');
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
            designation: userDraft.designation,
            reportingManagerId: userDraft.reportingManagerId || null,
            password: pwd,
            roleIds: access.roleIds,
            grantedPermissions: access.grantedPermissions,
          },
        });
        setCreatingUser(false);
        skipDraftSyncRef.current = true;
        syncedUserIdRef.current = String(data.id);
        setUsers((prev) => mergeUserRecord(prev, data));
        setEditingUserId(data.id);
        setUserDraft(buildUserDraftFromRecord(data, modules, roles));
        void loadUsers();
        setMsg('User created.');
      } else if (editingUserId) {
        const body = {
          fullName: userDraft.fullName,
          phone: userDraft.phone,
          designation: userDraft.designation,
          reportingManagerId: userDraft.reportingManagerId || null,
          roleIds: access.roleIds,
          grantedPermissions: access.grantedPermissions,
          isActive: userDraft.isActive,
        };
        if (pwd) body.password = pwd;
        const { data } = await api(`/users/${editingUserId}`, { method: 'PATCH', body });
        skipDraftSyncRef.current = true;
        syncedUserIdRef.current = String(data.id);
        setUsers((prev) => mergeUserRecord(prev, data));
        setUserDraft(buildUserDraftFromRecord(data, modules, roles));
        void loadUsers();
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
    if (!editingUserId || !canDelete || editingUserId === me?.id) return;
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
      await downloadExcel('/users/export', 'Users_Master.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  const passwordChangedLabel = formatWhen(editingUser?.passwordChangedAt);

  const renderUserAccessGrid = () => {
    const adminRole = roles.find((r) => r.permissions?.includes('*'));
    const adminRoleId = adminRole ? roleIdOf(adminRole) : '';
    const hasAdmin = Boolean(adminRoleId && userDraft.roleIds.includes(adminRoleId));
    const designationTemplate = getDesignationAccessTemplate(
      userDraft.designation,
      designationTemplates
    );

    return (
      <section className="rp-section rp-section--modules">
        <h4>Control Center</h4>
        <p className="muted rp-hint">
          Choose what this person can do in each application independently. Viewer on one app does not
          affect another. Use All for every option on that app only.
        </p>
        {designationTemplate && (
          <p className="muted rp-hint rp-hint--template">
            Suggested bundle for <strong>{userDraft.designation}</strong>:{' '}
            {designationTemplate.summary}
          </p>
        )}
        <div className="rp-module-grid">
          {adminRole && (
            <div className="rp-module-row rp-module-row--admin">
              <div className="rp-module-card-copy">
                <strong>Admin all Access</strong>
                <span className="muted">Full access to every application</span>
              </div>
              <div className="rp-module-toggles">
                <label className={`access-toggle ${hasAdmin ? 'is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={hasAdmin}
                    disabled={!canWrite}
                    onChange={() => toggleUserRole(adminRoleId)}
                  />
                  Admin
                </label>
              </div>
            </div>
          )}
          {modules.map((m) => {
            const moduleTiers = tiersForModule(m);
            if (!moduleTiers.length) return null;
            const moduleActive = hasAnyModuleAccess({ [m.id]: userDraft.moduleAccess[m.id] });
            const allOn = tierIsOnInMatrix(m, { id: 'all' }, userDraft.moduleAccess);
            return (
              <div
                key={m.id}
                className={`rp-module-row ${hasAdmin ? 'is-muted' : ''} ${moduleActive || allOn ? 'is-active' : ''}`}
              >
                <div className="rp-module-card-copy">
                  <strong>{m.label}</strong>
                  <span className="muted">{m.description}</span>
                </div>
                <div className="rp-module-toggles">
                  {moduleTiers.map((tier) => {
                    const on = tierIsOnInMatrix(m, tier, userDraft.moduleAccess);
                    return (
                      <label
                        key={`${m.id}-${tier.id}`}
                        className={`access-toggle ${tier.id === 'all' ? 'access-toggle--all' : ''} ${on ? 'is-on' : ''}`}
                        title={
                          tier.id === 'all'
                            ? 'Select every access level for this application'
                            : `${tier.label} access for ${m.label}`
                        }
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!canWrite || hasAdmin}
                          onChange={() => toggleModuleTier(m, tier)}
                        />
                        {tier.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <PageShell
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.ROLES_PERMISSIONS }]}
      title={MODULE.ROLES_PERMISSIONS}
      description="Manage people and assign application access in one place. Built-in roles apply per app."
      actions={
        <>
          <button
            className="btn secondary"
            type="button"
            disabled={exportBusy || !canViewUsers}
            onClick={downloadMaster}
          >
            {exportBusy ? ACTION.DOWNLOADING : ACTION.DOWNLOAD_EXCEL}
          </button>
          {canWrite && (
            <button className="btn" type="button" onClick={startCreateUser}>
              New person
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
        {canViewUsers && (
          <button
            type="button"
            role="tab"
            className={`rp-tab ${tab === 'hierarchy' ? 'is-active' : ''}`}
            aria-selected={tab === 'hierarchy'}
            onClick={() => setTab('hierarchy')}
          >
            Org hierarchy
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {msg && <FeedbackBanner variant="success">{msg}</FeedbackBanner>}

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
                    syncedUserIdRef.current = '';
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
                    {[u.designation, (u.roles || []).map((r) => r.name).filter(Boolean).join(', ')]
                      .filter(Boolean)
                      .join(' · ') || 'No roles'}
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
                    <div className="field">
                      <label>Designation</label>
                      <input
                        list="user-designation-options"
                        value={userDraft.designation}
                        disabled={!canWrite}
                        placeholder="e.g. Healthcare Camp Coordinator"
                        onChange={(e) =>
                          setUserDraft((prev) => ({ ...prev, designation: e.target.value }))
                        }
                      />
                      <datalist id="user-designation-options">
                        {designations.map((title) => (
                          <option key={title} value={title} />
                        ))}
                      </datalist>
                    </div>
                    <div className="field">
                      <label>Reporting manager</label>
                      <select
                        value={userDraft.reportingManagerId}
                        disabled={!canWrite}
                        onChange={(e) =>
                          setUserDraft({ ...userDraft, reportingManagerId: e.target.value })
                        }
                      >
                        <option value="">— None (top level) —</option>
                        {managerOptions.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.fullName || person.email}
                            {person.designation ? ` · ${person.designation}` : ''}
                          </option>
                        ))}
                      </select>
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

                {renderUserAccessGrid()}

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
                    {!creatingUser && editingUserId && String(editingUserId) !== String(me?.id) && canDelete && (
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

      {tab === 'hierarchy' && canViewUsers && (
        <OrgHierarchyPanel canWrite={canWrite} onEditPerson={openPersonFromHierarchy} />
      )}
    </PageShell>
  );
}
