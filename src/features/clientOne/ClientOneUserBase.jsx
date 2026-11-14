import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Plus, UserRound } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import Input from '../../components/ui/Input.jsx';
import ModalShell from '../../components/ui/ModalShell.jsx';
import { clientOneApi } from './clientOneApi.js';

const LEVELS = [
  { value: 'ho', label: 'Head Office (HO)' },
  { value: 'regional', label: 'Regional / State' },
  { value: 'location', label: 'Location / Branch' },
];

const LEVEL_LABEL = Object.fromEntries(LEVELS.map((l) => [l.value, l.label]));

function emptyForm(overrides = {}) {
  return {
    fullName: '',
    mobile: '',
    email: '',
    designation: '',
    level: 'ho',
    parentId: '',
    regionText: '',
    locationText: '',
    status: 'active',
    ...overrides,
  };
}

function splitLabels(text) {
  return String(text || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function flattenTree(nodes, acc = []) {
  for (const node of nodes || []) {
    acc.push(node);
    if (node.children?.length) flattenTree(node.children, acc);
  }
  return acc;
}

function MemberNode({ node, depth, selectedId, onSelect }) {
  const inactive = node.status === 'inactive';
  return (
    <li className={`c1-org-node c1-org-node--${node.level}${inactive ? ' is-inactive' : ''}`}>
      <button
        type="button"
        className={`c1-org-card${selectedId === node.id ? ' is-selected' : ''}`}
        onClick={() => onSelect(node)}
        style={{ '--c1-org-indent': `${Math.max(0, depth) * 18}px` }}
      >
        <span className="c1-org-card__avatar" aria-hidden="true">
          <UserRound size={16} />
        </span>
        <span className="c1-org-card__body">
          <strong>{node.fullName}</strong>
          <span className="c1-org-card__meta">
            {LEVEL_LABEL[node.level] || node.level}
            {node.designation ? ` · ${node.designation}` : ''}
          </span>
          <span className="c1-org-card__meta">{node.mobile || '—'}</span>
        </span>
        {node.children?.length ? (
          <span className="c1-org-card__count">{node.children.length}</span>
        ) : null}
        <ChevronRight size={16} className="c1-org-card__chevron" aria-hidden="true" />
      </button>
      {node.children?.length ? (
        <ul className="c1-org-children">
          {node.children.map((child) => (
            <MemberNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function ClientOneUserBase({ dateControls }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tree, setTree] = useState([]);
  const [members, setMembers] = useState([]);
  const [capabilities, setCapabilities] = useState({ canManage: false });
  const [selectedId, setSelectedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [revealedPin, setRevealedPin] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const selected = useMemo(
    () => members.find((m) => m.id === selectedId) || null,
    [members, selectedId],
  );

  const parentOptions = useMemo(() => {
    if (form.level === 'regional') {
      return members.filter((m) => m.level === 'ho' && m.status !== 'inactive');
    }
    if (form.level === 'location') {
      return members.filter((m) => m.level === 'regional' && m.status !== 'inactive');
    }
    return [];
  }, [form.level, members]);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const data = await clientOneApi.listMembers();
      setTree(Array.isArray(data.tree) ? data.tree : []);
      setMembers(Array.isArray(data.members) ? data.members : flattenTree(data.tree || []));
      setCapabilities(data.capabilities || { canManage: false });
    } catch (err) {
      setError(err?.message || 'Unable to load users');
      setTree([]);
      setMembers([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = (preset = {}) => {
    setFormMode('create');
    setFormError('');
    setRevealedPin(null);
    const level = preset.level
      || (capabilities.maxCreateLevel === 'location' ? 'location' : 'ho');
    const parentId = preset.parentId
      || (level === 'location' && capabilities.actorMemberId ? capabilities.actorMemberId : '');
    setForm(emptyForm({ level, parentId }));
    setFormOpen(true);
  };

  const openEdit = (member) => {
    setFormMode('edit');
    setFormError('');
    setRevealedPin(null);
    setForm(emptyForm({
      fullName: member.fullName || '',
      mobile: member.mobile || '',
      email: member.email || '',
      designation: member.designation || '',
      level: member.level || 'ho',
      parentId: member.parentId || '',
      regionText: (member.regions || []).join(', '),
      locationText: (member.locations || []).join(', '),
      status: member.status || 'active',
    }));
    setFormOpen(true);
  };

  const onLevelChange = (level) => {
    setForm((prev) => ({
      ...prev,
      level,
      parentId: level === 'ho' ? '' : (level === 'location' && capabilities.actorMemberId ? capabilities.actorMemberId : ''),
      regionText: level === 'location' ? prev.regionText : (level === 'ho' ? '' : prev.regionText),
      locationText: level === 'location' ? prev.locationText : '',
    }));
  };

  const onParentChange = (parentId) => {
    const parent = members.find((m) => m.id === parentId);
    setForm((prev) => ({
      ...prev,
      parentId,
      regionText: parent?.level === 'regional'
        ? (parent.regions || []).join(', ')
        : prev.regionText,
      locationText: prev.level === 'location' ? '' : prev.locationText,
    }));
  };

  const submitForm = async (event) => {
    event?.preventDefault?.();
    setFormError('');
    setSaving(true);
    setRevealedPin(null);
    try {
      const payload = {
        fullName: form.fullName,
        mobile: form.mobile,
        email: form.email,
        designation: form.designation,
        level: form.level,
        parentId: form.level === 'ho' ? null : (form.parentId || null),
        regions: form.level === 'regional' ? splitLabels(form.regionText) : undefined,
        locations: form.level === 'location' ? splitLabels(form.locationText) : undefined,
        status: form.status,
      };
      let result;
      if (formMode === 'create') {
        result = await clientOneApi.createMember(payload);
        if (result?.pin) setRevealedPin(result.pin);
      } else {
        result = await clientOneApi.updateMember(selected.id, payload);
      }
      await load();
      if (result?.id) setSelectedId(result.id);
      if (formMode === 'edit' || !result?.pin) setFormOpen(false);
    } catch (err) {
      setFormError(err?.message || 'Unable to save user');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await clientOneApi.updateMember(selected.id, { status });
      await load();
    } catch (err) {
      setError(err?.message || 'Unable to update status');
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  const rotatePin = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    setRevealedPin(null);
    try {
      const result = await clientOneApi.rotateMemberPin(selected.id);
      if (result?.pin) setRevealedPin(result.pin);
      await load();
    } catch (err) {
      setError(err?.message || 'Unable to rotate PIN');
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  const runConfirm = async () => {
    if (!confirmAction || !selected) return;
    if (confirmAction === 'deactivate') await setStatus('inactive');
    else if (confirmAction === 'activate') await setStatus('active');
    else if (confirmAction === 'rotate') await rotatePin();
  };

  const allowedCreateLevels = useMemo(() => {
    if (!capabilities.canManage) return [];
    if (capabilities.maxCreateLevel === 'location') return LEVELS.filter((l) => l.value === 'location');
    return LEVELS;
  }, [capabilities]);

  return (
    <section className="client-one-section-wrap">
      <div className="c1-page-head">
        <div className="c1-page-head__title-block">
          <h2 className="c1-page-head__title">User Base</h2>
          <p className="c1-page-head__subtitle meta-text">
            Organogram · Head Office → Regional → Location
          </p>
        </div>
        <div className="c1-page-head__actions">
          {dateControls}
          {capabilities.canManage ? (
            <Button type="button" size="compact" onClick={() => openCreate()}>
              <Plus size={14} aria-hidden="true" />
              Add user
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {revealedPin && !formOpen ? (
        <div className="client-one-card c1-org-pin-banner" role="status">
          <p>
            Secure PIN generated (shown once):
            {' '}
            <strong className="c1-org-pin-value">{revealedPin}</strong>
          </p>
          <Button type="button" variant="secondary" size="compact" onClick={() => setRevealedPin(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <div className="c1-org-layout" aria-busy={busy}>
        <section className="client-one-card c1-org-tree-panel">
          {!tree.length && !busy ? (
            <p className="meta-text c1-org-empty">
              No users yet. Add a Head Office user to start the organogram.
            </p>
          ) : (
            <ul className="c1-org-tree">
              {tree.map((node) => (
                <MemberNode
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  onSelect={(n) => {
                    setSelectedId(n.id);
                    setRevealedPin(null);
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <aside className="client-one-card c1-org-detail-panel">
          {!selected ? (
            <p className="meta-text">Select a user to view details and management actions.</p>
          ) : (
            <>
              <header className="c1-org-detail__head">
                <div>
                  <h3>{selected.fullName}</h3>
                  <p className="meta-text">{LEVEL_LABEL[selected.level]}</p>
                </div>
                <span className={`c1-org-status c1-org-status--${selected.status}`}>
                  {selected.status === 'inactive' ? 'Inactive' : 'Active'}
                </span>
              </header>
              <dl className="c1-org-detail__grid">
                <div>
                  <dt>Mobile</dt>
                  <dd>{selected.mobile || '—'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{selected.email || '—'}</dd>
                </div>
                <div>
                  <dt>Designation</dt>
                  <dd>{selected.designation || '—'}</dd>
                </div>
                <div>
                  <dt>Reporting to</dt>
                  <dd>
                    {selected.parentId
                      ? (members.find((m) => m.id === selected.parentId)?.fullName || '—')
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Regions</dt>
                  <dd>{selected.regions?.length ? selected.regions.join(', ') : '—'}</dd>
                </div>
                <div>
                  <dt>Locations</dt>
                  <dd>{selected.locations?.length ? selected.locations.join(', ') : '—'}</dd>
                </div>
              </dl>
              {capabilities.canManage ? (
                <div className="c1-org-detail__actions">
                  <Button type="button" variant="secondary" size="compact" onClick={() => openEdit(selected)}>
                    Edit
                  </Button>
                  {selected.status === 'active' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="compact"
                      onClick={() => setConfirmAction('deactivate')}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="compact"
                      onClick={() => setConfirmAction('activate')}
                    >
                      Activate
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    onClick={() => setConfirmAction('rotate')}
                  >
                    Rotate PIN
                  </Button>
                  {selected.level === 'ho' && capabilities.maxCreateLevel === 'ho' ? (
                    <Button
                      type="button"
                      size="compact"
                      onClick={() => openCreate({ level: 'regional', parentId: selected.id })}
                    >
                      Add regional
                    </Button>
                  ) : null}
                  {(selected.level === 'regional'
                    && (capabilities.maxCreateLevel === 'ho' || capabilities.actorMemberId === selected.id)) ? (
                      <Button
                        type="button"
                        size="compact"
                        onClick={() => openCreate({ level: 'location', parentId: selected.id })}
                      >
                        Add location
                      </Button>
                    ) : null}
                </div>
              ) : null}
            </>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={
          confirmAction === 'rotate'
            ? 'Rotate PIN?'
            : confirmAction === 'deactivate'
              ? 'Deactivate user?'
              : 'Activate user?'
        }
        message={
          confirmAction === 'rotate'
            ? `Generate a new secure PIN for ${selected?.fullName || 'this user'}? The previous PIN stops working immediately.`
            : confirmAction === 'deactivate'
              ? `${selected?.fullName || 'This user'} will no longer be able to sign in with their member PIN.`
              : `${selected?.fullName || 'This user'} will regain access with their member PIN.`
        }
        confirmLabel={
          confirmAction === 'rotate'
            ? 'Rotate PIN'
            : confirmAction === 'deactivate'
              ? 'Deactivate'
              : 'Activate'
        }
        confirmVariant={confirmAction === 'activate' ? 'primary' : 'danger'}
        loading={busy}
        onCancel={() => { if (!busy) setConfirmAction(null); }}
        onConfirm={runConfirm}
      />

      <ModalShell
        open={formOpen}
        onClose={() => {
          if (!saving) setFormOpen(false);
        }}
        title={formMode === 'create' ? 'Add user' : 'Edit user'}
        panelClassName="modal-card c1-org-form-modal"
      >
        <form className="c1-org-form" onSubmit={submitForm}>
          {formError ? <p className="error-text" role="alert">{formError}</p> : null}
          {revealedPin && formMode === 'create' ? (
            <div className="c1-org-pin-banner" role="status">
              <p>
                Secure PIN (shown once):
                {' '}
                <strong className="c1-org-pin-value">{revealedPin}</strong>
              </p>
              <p className="meta-text">Share this PIN privately with the user, then close.</p>
              <Button type="button" size="compact" onClick={() => { setFormOpen(false); setRevealedPin(null); }}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="c1-org-form__grid">
                <label className="field">
                  <span>Full name *</span>
                  <Input
                    required
                    value={form.fullName}
                    onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Mobile *</span>
                  <Input
                    required
                    inputMode="tel"
                    value={form.mobile}
                    onChange={(e) => setForm((p) => ({ ...p, mobile: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Designation</span>
                  <Input
                    value={form.designation}
                    onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Hierarchy level *</span>
                  <select
                    className="adaptive-select"
                    value={form.level}
                    disabled={formMode === 'edit' && !allowedCreateLevels.some((l) => l.value === form.level)}
                    onChange={(e) => onLevelChange(e.target.value)}
                  >
                    {(formMode === 'edit' ? LEVELS : allowedCreateLevels).map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </label>
                {form.level !== 'ho' ? (
                  <label className="field">
                    <span>Reporting to *</span>
                    <select
                      className="adaptive-select"
                      required
                      value={form.parentId}
                      onChange={(e) => onParentChange(e.target.value)}
                    >
                      <option value="">Select parent</option>
                      {parentOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName}
                          {m.regions?.length ? ` (${m.regions.join(', ')})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {form.level === 'regional' ? (
                  <label className="field c1-org-form__span2">
                    <span>Assigned region / state *</span>
                    <Input
                      required
                      placeholder="e.g. Maharashtra, Gujarat"
                      value={form.regionText}
                      onChange={(e) => setForm((p) => ({ ...p, regionText: e.target.value }))}
                    />
                  </label>
                ) : null}
                {form.level === 'location' ? (
                  <label className="field c1-org-form__span2">
                    <span>Assigned location / branch *</span>
                    <Input
                      required
                      placeholder="e.g. Pune, Nashik"
                      value={form.locationText}
                      onChange={(e) => setForm((p) => ({ ...p, locationText: e.target.value }))}
                    />
                  </label>
                ) : null}
                {formMode === 'edit' ? (
                  <label className="field">
                    <span>Status</span>
                    <select
                      className="adaptive-select"
                      value={form.status}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                ) : null}
              </div>
              <p className="meta-text">
                {formMode === 'create'
                  ? 'A secure 6-digit PIN is generated automatically and shown once after save.'
                  : 'PIN is not shown in listings. Use Rotate PIN to issue a new one.'}
              </p>
              <div className="c1-org-form__footer">
                <Button type="button" variant="secondary" disabled={saving} onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : formMode === 'create' ? 'Create user' : 'Save changes'}
                </Button>
              </div>
            </>
          )}
        </form>
      </ModalShell>
    </section>
  );
}
