import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  ChevronRight,
  Copy,
  FolderTree,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';
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

function getInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
  const isSelected = selectedId === node.id;
  const initials = getInitials(node.fullName);
  const reportsCount = node.children?.length || 0;

  return (
    <li className={`c1-org-node c1-org-node--${node.level}${inactive ? ' is-inactive' : ''}`}>
      <button
        type="button"
        className={`c1-org-card${isSelected ? ' is-selected' : ''}`}
        onClick={() => onSelect(node)}
        style={{ '--c1-org-indent': `${Math.max(0, depth) * 16}px` }}
      >
        <span
          className={`c1-org-card__avatar c1-org-card__avatar--${node.level}`}
          aria-hidden="true"
        >
          {initials}
        </span>
        <span className="c1-org-card__body">
          <span className="c1-org-card__title-row">
            <strong className="c1-org-card__name">{node.fullName}</strong>
            <span className={`c1-level-tag c1-level-tag--${node.level}`}>
              {LEVEL_LABEL[node.level] || node.level}
            </span>
            <span
              className={`c1-status-dot c1-status-dot--${node.status}`}
              title={node.status === 'inactive' ? 'Inactive' : 'Active'}
              aria-label={node.status === 'inactive' ? 'Inactive status' : 'Active status'}
            />
          </span>
          <span className="c1-org-card__meta">
            {node.designation ? (
              <span className="c1-org-card__meta-item">{node.designation}</span>
            ) : null}
            {node.mobile ? (
              <span className="c1-org-card__meta-item">
                <Phone size={11} aria-hidden="true" />
                {node.mobile}
              </span>
            ) : null}
          </span>
        </span>
        {reportsCount ? (
          <span className="c1-org-card__count" title={`${reportsCount} direct reports`}>
            {reportsCount} {reportsCount === 1 ? 'report' : 'reports'}
          </span>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

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

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        if (fieldName === 'pin') {
          setCopiedPin(true);
          setTimeout(() => setCopiedPin(false), 2000);
        } else {
          setCopiedField(fieldName);
          setTimeout(() => setCopiedField(null), 2000);
        }
      }).catch(() => {});
    }
  };

  const allowedCreateLevels = useMemo(() => {
    if (!capabilities.canManage) return [];
    if (capabilities.maxCreateLevel === 'location') return LEVELS.filter((l) => l.value === 'location');
    return LEVELS;
  }, [capabilities]);

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim() && levelFilter === 'all') return tree;
    const q = searchQuery.trim().toLowerCase();

    function filterNode(node) {
      const matchSearch = !q
        || node.fullName?.toLowerCase().includes(q)
        || node.mobile?.includes(q)
        || node.email?.toLowerCase().includes(q)
        || node.designation?.toLowerCase().includes(q)
        || (node.regions || []).some((r) => r.toLowerCase().includes(q))
        || (node.locations || []).some((l) => l.toLowerCase().includes(q));

      const matchLevel = levelFilter === 'all' || node.level === levelFilter;

      const filteredChildren = (node.children || [])
        .map(filterNode)
        .filter(Boolean);

      if ((matchSearch && matchLevel) || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
      return null;
    }

    return tree.map(filterNode).filter(Boolean);
  }, [tree, searchQuery, levelFilter]);

  const stats = useMemo(() => {
    const total = members.length;
    const ho = members.filter((m) => m.level === 'ho').length;
    const regional = members.filter((m) => m.level === 'regional').length;
    const location = members.filter((m) => m.level === 'location').length;
    const active = members.filter((m) => m.status === 'active').length;
    return { total, ho, regional, location, active };
  }, [members]);

  return (
    <section className="client-one-section-wrap c1-user-base-section">
      <div className="c1-page-head c1-page-head--with-actions c1-user-base-head">
        <div className="c1-page-head__title-block">
          <h2 className="c1-page-head__title">User Base</h2>
          <p className="c1-page-head__subtitle meta-text">
            Organogram · Head Office → Regional → Location
          </p>
        </div>

        <div className="c1-user-base-head__controls">
          {dateControls ? (
            <div className="c1-page-head__filters">
              {dateControls}
            </div>
          ) : null}
          {capabilities.canManage ? (
            <div className="c1-page-head__actions">
              <Button type="button" size="compact" onClick={() => openCreate()}>
                <Plus size={14} aria-hidden="true" />
                Add user
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="c1-org-kpis" role="region" aria-label="Hierarchy overview metrics">
        <div className="c1-org-kpi">
          <div className="c1-org-kpi__icon c1-org-kpi__icon--total" aria-hidden="true">
            <Users size={16} />
          </div>
          <div className="c1-org-kpi__body">
            <span className="c1-org-kpi__label">Total Members</span>
            <strong className="c1-org-kpi__value">{stats.total}</strong>
          </div>
        </div>

        <div className="c1-org-kpi">
          <div className="c1-org-kpi__icon c1-org-kpi__icon--ho" aria-hidden="true">
            <Building2 size={16} />
          </div>
          <div className="c1-org-kpi__body">
            <span className="c1-org-kpi__label">Head Office</span>
            <strong className="c1-org-kpi__value">{stats.ho}</strong>
          </div>
        </div>

        <div className="c1-org-kpi">
          <div className="c1-org-kpi__icon c1-org-kpi__icon--regional" aria-hidden="true">
            <FolderTree size={16} />
          </div>
          <div className="c1-org-kpi__body">
            <span className="c1-org-kpi__label">Regional / State</span>
            <strong className="c1-org-kpi__value">{stats.regional}</strong>
          </div>
        </div>

        <div className="c1-org-kpi">
          <div className="c1-org-kpi__icon c1-org-kpi__icon--location" aria-hidden="true">
            <MapPin size={16} />
          </div>
          <div className="c1-org-kpi__body">
            <span className="c1-org-kpi__label">Location / Branch</span>
            <strong className="c1-org-kpi__value">{stats.location}</strong>
          </div>
        </div>

        <div className="c1-org-kpi">
          <div className="c1-org-kpi__icon c1-org-kpi__icon--active" aria-hidden="true">
            <ShieldCheck size={16} />
          </div>
          <div className="c1-org-kpi__body">
            <span className="c1-org-kpi__label">Active Access</span>
            <strong className="c1-org-kpi__value">{stats.active}</strong>
          </div>
        </div>
      </div>

      {error ? <p className="error-text" role="alert">{error}</p> : null}

      {revealedPin && !formOpen ? (
        <div className="client-one-card c1-org-pin-banner" role="status">
          <div className="c1-org-pin-banner__content">
            <div className="c1-org-pin-banner__badge">
              <KeyRound size={14} aria-hidden="true" />
              <span>SECURE ACCESS PIN</span>
            </div>
            <p className="c1-org-pin-banner__text">
              Generated PIN (shown once):
              {' '}
              <strong className="c1-org-pin-value">{revealedPin}</strong>
            </p>
            <p className="meta-text c1-org-pin-banner__hint">
              Share this 6-digit PIN securely with the member. It will not be shown again.
            </p>
          </div>
          <div className="c1-org-pin-banner__actions">
            <Button
              type="button"
              variant="secondary"
              size="compact"
              onClick={() => copyToClipboard(revealedPin, 'pin')}
            >
              {copiedPin ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              {copiedPin ? 'Copied' : 'Copy PIN'}
            </Button>
            <Button type="button" size="compact" onClick={() => setRevealedPin(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <div className="c1-org-layout" aria-busy={busy}>
        <section className="client-one-card c1-org-tree-panel">
          <div className="c1-org-panel-head">
            <div className="c1-org-panel-head__left">
              <FolderTree size={16} className="c1-org-panel-head__icon" aria-hidden="true" />
              <h3 className="c1-org-panel-head__title">Hierarchy Structure</h3>
              <span className="c1-org-panel-head__badge">{members.length} members</span>
            </div>
            {capabilities.canManage && tree.length > 0 ? (
              <Button type="button" variant="ghost" size="compact" onClick={() => openCreate()}>
                <Plus size={13} aria-hidden="true" />
                Add
              </Button>
            ) : null}
          </div>

          {members.length > 0 ? (
            <div className="c1-org-toolbar">
              <div className="c1-org-search-wrap">
                <Search size={14} className="c1-org-search-icon" aria-hidden="true" />
                <input
                  type="search"
                  className="c1-org-search-input"
                  placeholder="Search members by name, mobile, territory..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search members"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="c1-org-search-clear"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <div className="c1-org-filter-pills" role="tablist" aria-label="Filter hierarchy level">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'ho', label: 'Head Office' },
                  { id: 'regional', label: 'Regional' },
                  { id: 'location', label: 'Location' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={levelFilter === tab.id}
                    className={`c1-org-pill${levelFilter === tab.id ? ' is-active' : ''}`}
                    onClick={() => setLevelFilter(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {!tree.length && !busy ? (
            <div className="c1-org-empty-state">
              <div className="c1-org-empty-state__icon">
                <Building2 size={36} aria-hidden="true" />
              </div>
              <h4 className="c1-org-empty-state__title">No users configured yet</h4>
              <p className="meta-text c1-org-empty">
                No users yet. Add a Head Office user to start the organogram.
              </p>
              <p className="c1-org-empty-state__desc">
                Head Office users sit at the top tier. Regional managers and location users report upwards through this hierarchy.
              </p>
              {capabilities.canManage ? (
                <Button type="button" size="compact" onClick={() => openCreate({ level: 'ho' })}>
                  <Plus size={14} aria-hidden="true" />
                  Add Head Office user
                </Button>
              ) : null}
            </div>
          ) : filteredTree.length === 0 && searchQuery ? (
            <div className="c1-org-empty-state c1-org-empty-state--compact">
              <div className="c1-org-empty-state__icon">
                <Search size={28} aria-hidden="true" />
              </div>
              <h4 className="c1-org-empty-state__title">No matching members</h4>
              <p className="meta-text">
                No members found matching &quot;{searchQuery}&quot;.
              </p>
              <Button type="button" variant="secondary" size="compact" onClick={() => setSearchQuery('')}>
                Clear search
              </Button>
            </div>
          ) : (
            <div className="c1-org-tree-scroll">
              <ul className="c1-org-tree">
                {filteredTree.map((node) => (
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
            </div>
          )}
        </section>

        <aside className="client-one-card c1-org-detail-panel">
          <div className="c1-org-panel-head">
            <div className="c1-org-panel-head__left">
              <UserRound size={16} className="c1-org-panel-head__icon" aria-hidden="true" />
              <h3 className="c1-org-panel-head__title">Member Profile & Access</h3>
            </div>
          </div>

          {!selected ? (
            <div className="c1-org-empty-state">
              <div className="c1-org-empty-state__icon">
                <UserRound size={36} aria-hidden="true" />
              </div>
              <h4 className="c1-org-empty-state__title">No Member Selected</h4>
              <p className="c1-org-empty-state__subtitle meta-text">
                Select a user to view details and management actions.
              </p>
              <p className="c1-org-empty-state__desc">
                Choose any member from the hierarchy on the left to inspect profile attributes, hierarchy level, assigned regions, and manage portal access credentials.
              </p>
            </div>
          ) : (
            <div className="c1-org-detail-content">
              <header className="c1-org-detail__hero">
                <div className={`c1-org-detail__avatar c1-org-detail__avatar--${selected.level}`}>
                  {getInitials(selected.fullName)}
                </div>
                <div className="c1-org-detail__hero-text">
                  <div className="c1-org-detail__hero-title-row">
                    <h3>{selected.fullName}</h3>
                    <span className={`c1-org-status c1-org-status--${selected.status}`}>
                      <span className={`c1-status-dot c1-status-dot--${selected.status}`} />
                      {selected.status === 'inactive' ? 'Inactive' : 'Active'}
                    </span>
                  </div>
                  <div className="c1-org-detail__hero-badges">
                    <span className={`c1-level-tag c1-level-tag--${selected.level}`}>
                      {LEVEL_LABEL[selected.level] || selected.level}
                    </span>
                    {selected.designation ? (
                      <span className="c1-org-detail__designation-badge">
                        {selected.designation}
                      </span>
                    ) : null}
                  </div>
                </div>
              </header>

              <div className="c1-org-detail__section">
                <h4 className="c1-org-detail__section-title">Contact & Organization</h4>
                <dl className="c1-org-detail__grid">
                  <div className="c1-org-detail__tile">
                    <dt>
                      <Phone size={12} aria-hidden="true" />
                      Mobile
                    </dt>
                    <dd className="c1-org-detail__val-with-copy">
                      <span>{selected.mobile || '—'}</span>
                      {selected.mobile ? (
                        <button
                          type="button"
                          className="c1-copy-btn"
                          onClick={() => copyToClipboard(selected.mobile, 'mobile')}
                          title="Copy mobile number"
                        >
                          {copiedField === 'mobile' ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      ) : null}
                    </dd>
                  </div>

                  <div className="c1-org-detail__tile">
                    <dt>
                      <Mail size={12} aria-hidden="true" />
                      Email
                    </dt>
                    <dd className="c1-org-detail__val-with-copy">
                      <span>{selected.email || '—'}</span>
                      {selected.email ? (
                        <button
                          type="button"
                          className="c1-copy-btn"
                          onClick={() => copyToClipboard(selected.email, 'email')}
                          title="Copy email address"
                        >
                          {copiedField === 'email' ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      ) : null}
                    </dd>
                  </div>

                  <div className="c1-org-detail__tile">
                    <dt>Designation</dt>
                    <dd>{selected.designation || '—'}</dd>
                  </div>

                  <div className="c1-org-detail__tile">
                    <dt>Reporting to</dt>
                    <dd>
                      {selected.parentId ? (
                        (() => {
                          const parent = members.find((m) => m.id === selected.parentId);
                          if (!parent) return '—';
                          return (
                            <button
                              type="button"
                              className="c1-org-parent-link"
                              onClick={() => setSelectedId(parent.id)}
                              title="Click to jump to manager in organogram"
                            >
                              {parent.fullName}
                              <span className="c1-org-parent-link__sub">
                                ({LEVEL_LABEL[parent.level] || parent.level})
                              </span>
                            </button>
                          );
                        })()
                      ) : (
                        <span className="meta-text">Top-level (Head Office)</span>
                      )}
                    </dd>
                  </div>

                  <div className="c1-org-detail__tile c1-org-detail__tile--full">
                    <dt>
                      <MapPin size={12} aria-hidden="true" />
                      Assigned Regions / States
                    </dt>
                    <dd>
                      {selected.regions?.length ? (
                        <div className="c1-org-chips">
                          {selected.regions.map((reg) => (
                            <span key={reg} className="c1-org-chip">{reg}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="meta-text">—</span>
                      )}
                    </dd>
                  </div>

                  <div className="c1-org-detail__tile c1-org-detail__tile--full">
                    <dt>
                      <MapPin size={12} aria-hidden="true" />
                      Assigned Locations / Branches
                    </dt>
                    <dd>
                      {selected.locations?.length ? (
                        <div className="c1-org-chips">
                          {selected.locations.map((loc) => (
                            <span key={loc} className="c1-org-chip c1-org-chip--branch">{loc}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="meta-text">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {capabilities.canManage ? (
                <div className="c1-org-detail__section c1-org-detail__section--actions">
                  <h4 className="c1-org-detail__section-title">
                    <KeyRound size={13} aria-hidden="true" />
                    Access & Management Controls
                  </h4>
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
                      <KeyRound size={13} aria-hidden="true" />
                      Rotate PIN
                    </Button>
                    {selected.level === 'ho' && capabilities.maxCreateLevel === 'ho' ? (
                      <Button
                        type="button"
                        size="compact"
                        onClick={() => openCreate({ level: 'regional', parentId: selected.id })}
                      >
                        <Plus size={13} aria-hidden="true" />
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
                          <Plus size={13} aria-hidden="true" />
                          Add location
                        </Button>
                      ) : null}
                  </div>
                </div>
              ) : null}
            </div>
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
              <div className="c1-org-pin-banner__content">
                <div className="c1-org-pin-banner__badge">
                  <KeyRound size={14} aria-hidden="true" />
                  <span>SECURE ACCESS PIN</span>
                </div>
                <p className="c1-org-pin-banner__text">
                  Generated PIN (shown once):
                  {' '}
                  <strong className="c1-org-pin-value">{revealedPin}</strong>
                </p>
                <p className="meta-text c1-org-pin-banner__hint">
                  Share this 6-digit PIN securely with the member. It will not be shown again.
                </p>
              </div>
              <div className="c1-org-pin-banner__actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  onClick={() => copyToClipboard(revealedPin, 'pin')}
                >
                  {copiedPin ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                  {copiedPin ? 'Copied' : 'Copy PIN'}
                </Button>
                <Button
                  type="button"
                  size="compact"
                  onClick={() => { setFormOpen(false); setRevealedPin(null); }}
                >
                  Done
                </Button>
              </div>
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
