import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  ChevronRight,
  Copy,
  FolderTree,
  KeyRound,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import Button from '../../components/ui/Button.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import Input from '../../components/ui/Input.jsx';
import ModalShell from '../../components/ui/ModalShell.jsx';
import { CAMP_ZONE_DEFINITIONS } from '../../constants/geoZones.js';
import { clientOneApi } from './clientOneApi.js';

export const DESIGNATIONS = Object.freeze(['Zonal', 'Regional', 'Area', 'Territory']);

export const DESIGNATION_TO_LEVEL = Object.freeze({
  Zonal: 'zonal',
  Regional: 'regional',
  Area: 'area',
  Territory: 'territory',
});

export const LEVEL_TO_DESIGNATION = Object.freeze({
  zonal: 'Zonal',
  ho: 'Zonal',
  regional: 'Regional',
  area: 'Area',
  territory: 'Territory',
  location: 'Territory',
});

export function normalizeDesignation(member) {
  if (member?.designation && DESIGNATIONS.includes(member.designation)) {
    return member.designation;
  }
  return LEVEL_TO_DESIGNATION[member?.level] || 'Zonal';
}

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
    states: [],
    cities: [],
    designation: 'Zonal',
    parentId: '',
    status: 'active',
    ...overrides,
  };
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
  const des = normalizeDesignation(node);
  const tierClass = des.toLowerCase();

  return (
    <li className={`c1-org-node c1-org-node--${tierClass}${inactive ? ' is-inactive' : ''}`}>
      <button
        type="button"
        className={`c1-org-card${isSelected ? ' is-selected' : ''}`}
        onClick={() => onSelect(node)}
        style={{ '--c1-org-indent': `${Math.max(0, depth) * 16}px` }}
      >
        <span
          className={`c1-org-card__avatar c1-org-card__avatar--${tierClass}`}
          aria-hidden="true"
        >
          {initials}
        </span>
        <span className="c1-org-card__body">
          <span className="c1-org-card__title-row">
            <strong className="c1-org-card__name">{node.fullName}</strong>
            <span className={`c1-level-tag c1-level-tag--${tierClass}`}>
              {des}
            </span>
            <span
              className={`c1-status-dot c1-status-dot--${node.status}`}
              title={node.status === 'inactive' ? 'Inactive' : 'Active'}
              aria-label={node.status === 'inactive' ? 'Inactive status' : 'Active status'}
            />
          </span>
          <span className="c1-org-card__meta">
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [revealedPin, setRevealedPin] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Master geography data
  const [masterStates, setMasterStates] = useState([]);
  const [cityCache, setCityCache] = useState({});
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    let cancelled = false;
    clientOneApi.geoStates()
      .then((data) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setMasterStates(data);
        }
      })
      .catch(() => {
        // Fallback gracefully from bundled constants
        if (!cancelled) {
          const fallbackStates = Array.from(
            new Set(CAMP_ZONE_DEFINITIONS.flatMap((z) => z.states))
          ).sort().map((name) => ({ name }));
          setMasterStates(fallbackStates);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fallbackAllStates = useMemo(() => {
    if (masterStates.length) return masterStates;
    return Array.from(
      new Set(CAMP_ZONE_DEFINITIONS.flatMap((z) => z.states))
    ).sort().map((name) => ({ name }));
  }, [masterStates]);

  const selected = useMemo(
    () => members.find((m) => m.id === selectedId) || null,
    [members, selectedId],
  );

  // Selected parent in the form (if any)
  const formParent = useMemo(
    () => (form.parentId ? members.find((m) => m.id === form.parentId) || null : null),
    [members, form.parentId],
  );

  // Available states: scoped to parent's regions if parent has assigned regions
  const availableStates = useMemo(() => {
    if (formParent?.regions?.length) {
      const allowed = new Set(formParent.regions.map((r) => r.toLowerCase()));
      return fallbackAllStates.filter((s) => allowed.has((s.name || s).toLowerCase()));
    }
    return fallbackAllStates;
  }, [formParent, fallbackAllStates]);

  // Load cities dynamically when states change
  useEffect(() => {
    if (!formOpen || !form.states?.length) {
      return;
    }
    const needed = form.states.filter((st) => !cityCache[st.toLowerCase()]);
    if (!needed.length) return;

    let cancelled = false;
    setLoadingCities(true);
    clientOneApi.geoCities(form.states)
      .then((cities) => {
        if (cancelled) return;
        setCityCache((prev) => {
          const next = { ...prev };
          for (const c of cities || []) {
            const stKey = String(c.stateName || '').toLowerCase();
            if (!next[stKey]) next[stKey] = [];
            if (!next[stKey].some((existing) => existing.name === c.name)) {
              next[stKey].push(c);
            }
          }
          return next;
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formOpen, form.states, cityCache]);

  // Available cities: union of cities from selected states, scoped to parent's locations if parent restricted
  const availableCities = useMemo(() => {
    if (!form.states?.length) return [];
    const list = [];
    const seen = new Set();
    for (const st of form.states) {
      const stCities = cityCache[st.toLowerCase()] || [];
      for (const c of stCities) {
        const key = c.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.push(c);
        }
      }
    }
    if (formParent?.locations?.length) {
      const allowed = new Set(formParent.locations.map((l) => l.toLowerCase()));
      return list.filter((c) => allowed.has(c.name.toLowerCase()));
    }
    return list;
  }, [form.states, cityCache, formParent]);

  // Dynamic reporting parent options based on designation
  const parentOptions = useMemo(() => {
    const des = form.designation;
    if (des === 'Zonal') return [];

    let targetTier = '';
    if (des === 'Regional') targetTier = 'Zonal';
    else if (des === 'Area') targetTier = 'Regional';
    else if (des === 'Territory') targetTier = 'Area';

    // In Edit mode, collect descendant IDs of selected user to prevent cycles
    const excludedIds = new Set();
    if (formMode === 'edit' && selected?.id) {
      excludedIds.add(selected.id);
      const queue = [selected.id];
      while (queue.length) {
        const curr = queue.shift();
        for (const m of members) {
          if (m.parentId === curr && !excludedIds.has(m.id)) {
            excludedIds.add(m.id);
            queue.push(m.id);
          }
        }
      }
    }

    return members.filter((m) => {
      if (excludedIds.has(m.id)) return false;
      const mDes = normalizeDesignation(m);
      if (mDes !== targetTier) return false;
      // In edit mode, retain current parent if previously assigned, else only active
      if (formMode === 'edit' && m.id === form.parentId) return true;
      return m.status === 'active';
    });
  }, [form.designation, formMode, selected, members, form.parentId]);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const data = await clientOneApi.listMembers();
      setTree(Array.isArray(data.tree) ? data.tree : []);
      setMembers(Array.isArray(data.members) ? data.members : flattenTree(data.tree || []));
      setCapabilities(data.capabilities || { canManage: false });
    } catch (err) {
      setError(err?.message || 'Unable to load organization chart');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tree.length && !selectedId) {
      setSelectedId(tree[0].id);
    }
  }, [tree, selectedId]);

  const openCreate = (overrides = {}) => {
    setFormMode('create');
    setFormError('');
    setFieldErrors({});
    setRevealedPin(null);
    const initialDes = overrides.designation || 'Zonal';
    setForm(emptyForm({
      designation: initialDes,
      parentId: overrides.parentId || '',
      states: overrides.states || [],
      cities: overrides.cities || [],
      ...overrides,
    }));
    setFormOpen(true);
  };

  const openEdit = (member) => {
    setFormMode('edit');
    setFormError('');
    setFieldErrors({});
    setRevealedPin(null);
    const des = normalizeDesignation(member);
    setForm(emptyForm({
      fullName: member.fullName || '',
      mobile: member.mobile || '',
      designation: des,
      parentId: member.parentId || '',
      states: Array.isArray(member.regions) ? member.regions : [],
      cities: Array.isArray(member.locations) ? member.locations : [],
      status: member.status || 'active',
    }));
    setFormOpen(true);
  };

  // State selection handler: refreshes and validates city selections
  const onStatesChange = (newStates) => {
    const nextStates = Array.isArray(newStates) ? newStates : (newStates ? [newStates] : []);
    const validStateSet = new Set(nextStates.map((s) => s.toLowerCase()));

    // Prune cities that belonged to removed states
    const prunedCities = (form.cities || []).filter((cityName) => {
      for (const [stKey, cities] of Object.entries(cityCache)) {
        if (validStateSet.has(stKey) && cities.some((c) => c.name.toLowerCase() === cityName.toLowerCase())) {
          return true;
        }
      }
      return false;
    });

    setForm((prev) => ({
      ...prev,
      states: nextStates,
      cities: prunedCities,
    }));
  };

  // Designation selection handler
  const onDesignationChange = (newDesignation) => {
    setForm((prev) => {
      let nextParentId = prev.parentId;
      if (newDesignation === 'Zonal') {
        nextParentId = '';
      } else {
        let targetTier = '';
        if (newDesignation === 'Regional') targetTier = 'Zonal';
        else if (newDesignation === 'Area') targetTier = 'Regional';
        else if (newDesignation === 'Territory') targetTier = 'Area';

        const parent = members.find((m) => m.id === prev.parentId);
        if (!parent || normalizeDesignation(parent) !== targetTier) {
          nextParentId = '';
        }
      }
      return {
        ...prev,
        designation: newDesignation,
        parentId: nextParentId,
      };
    });
    if (fieldErrors.parentId) {
      setFieldErrors((p) => ({ ...p, parentId: '' }));
    }
  };

  // Reporting parent selection handler
  const onParentChange = (parentId) => {
    const parent = members.find((m) => m.id === parentId);
    setForm((prev) => {
      let nextStates = prev.states;
      let nextCities = prev.cities;

      if (parent?.regions?.length) {
        const allowed = new Set(parent.regions.map((r) => r.toLowerCase()));
        nextStates = prev.states.filter((st) => allowed.has(st.toLowerCase()));
      }
      if (parent?.locations?.length) {
        const allowed = new Set(parent.locations.map((l) => l.toLowerCase()));
        nextCities = prev.cities.filter((c) => allowed.has(c.toLowerCase()));
      }

      return {
        ...prev,
        parentId,
        states: nextStates,
        cities: nextCities,
      };
    });
    if (fieldErrors.parentId) {
      setFieldErrors((p) => ({ ...p, parentId: '' }));
    }
  };

  const submitForm = async (event) => {
    event?.preventDefault?.();
    setFormError('');
    const errors = {};

    const fullNameTrim = form.fullName.trim();
    if (!fullNameTrim) {
      errors.fullName = 'Full name is required';
    }

    const cleanMobile = form.mobile.replace(/\D+/g, '');
    if (!cleanMobile || cleanMobile.length < 10) {
      errors.mobile = 'Enter a valid 10-digit mobile number';
    }

    if (form.designation !== 'Zonal' && !form.parentId) {
      errors.parentId = `Select a reporting ${form.designation === 'Regional' ? 'Zonal' : form.designation === 'Area' ? 'Regional' : 'Area'} manager`;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    setRevealedPin(null);
    try {
      const payload = {
        fullName: fullNameTrim,
        mobile: cleanMobile,
        designation: form.designation,
        level: DESIGNATION_TO_LEVEL[form.designation] || 'zonal',
        parentId: form.designation === 'Zonal' ? null : (form.parentId || null),
        regions: form.states,
        locations: form.cities,
        status: form.status || 'active',
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

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim() && levelFilter === 'all') return tree;
    const q = searchQuery.trim().toLowerCase();

    function filterNode(node) {
      const des = normalizeDesignation(node);
      const matchSearch = !q
        || node.fullName?.toLowerCase().includes(q)
        || node.mobile?.includes(q)
        || des.toLowerCase().includes(q)
        || (node.regions || []).some((r) => r.toLowerCase().includes(q))
        || (node.locations || []).some((l) => l.toLowerCase().includes(q));

      const matchLevel = levelFilter === 'all' || des === levelFilter;

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
    const zonal = members.filter((m) => normalizeDesignation(m) === 'Zonal').length;
    const regional = members.filter((m) => normalizeDesignation(m) === 'Regional').length;
    const area = members.filter((m) => normalizeDesignation(m) === 'Area').length;
    const territory = members.filter((m) => normalizeDesignation(m) === 'Territory').length;
    const active = members.filter((m) => m.status === 'active').length;
    return { total, zonal, regional, area, territory, active };
  }, [members]);

  const selectedDes = selected ? normalizeDesignation(selected) : 'Zonal';
  const selectedParent = selected?.parentId ? members.find((m) => m.id === selected.parentId) : null;

  return (
    <section className="client-one-section-wrap c1-user-base-section">
      <div className="c1-page-head c1-page-head--with-actions c1-user-base-head">
        <div className="c1-page-head__title-block">
          <h2 className="c1-page-head__title">User Base</h2>
          <p className="c1-page-head__subtitle meta-text">
            Organogram · Zonal → Regional → Area → Territory
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
            <span className="c1-org-kpi__label">Zonal</span>
            <strong className="c1-org-kpi__value">{stats.zonal}</strong>
          </div>
        </div>

        <div className="c1-org-kpi">
          <div className="c1-org-kpi__icon c1-org-kpi__icon--regional" aria-hidden="true">
            <FolderTree size={16} />
          </div>
          <div className="c1-org-kpi__body">
            <span className="c1-org-kpi__label">Regional</span>
            <strong className="c1-org-kpi__value">{stats.regional}</strong>
          </div>
        </div>

        <div className="c1-org-kpi">
          <div className="c1-org-kpi__icon c1-org-kpi__icon--area" aria-hidden="true">
            <MapPin size={16} />
          </div>
          <div className="c1-org-kpi__body">
            <span className="c1-org-kpi__label">Area</span>
            <strong className="c1-org-kpi__value">{stats.area}</strong>
          </div>
        </div>

        <div className="c1-org-kpi">
          <div className="c1-org-kpi__icon c1-org-kpi__icon--location" aria-hidden="true">
            <MapPin size={16} />
          </div>
          <div className="c1-org-kpi__body">
            <span className="c1-org-kpi__label">Territory</span>
            <strong className="c1-org-kpi__value">{stats.territory}</strong>
          </div>
        </div>

        <div className="c1-org-kpi">
          <div className="c1-org-kpi__icon c1-org-kpi__icon--active" aria-hidden="true">
            <ShieldCheck size={16} />
          </div>
          <div className="c1-org-kpi__body">
            <span className="c1-org-kpi__label">Active</span>
            <strong className="c1-org-kpi__value">{stats.active}</strong>
          </div>
        </div>
      </div>

      <div className="c1-org-toolbar" role="search" aria-label="Search and filter users">
        <div className="c1-org-toolbar__search">
          <Search size={14} className="c1-org-toolbar__icon" aria-hidden="true" />
          <input
            type="search"
            className="c1-org-search-input"
            placeholder="Search by name, mobile, designation, state, or city…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search users"
          />
          {searchQuery ? (
            <button
              type="button"
              className="c1-org-toolbar__clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="c1-org-toolbar__filters">
          <label className="c1-org-filter-group">
            <span className="meta-text">Designation:</span>
            <select
              className="tylo-select c1-org-filter-select"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              aria-label="Filter by designation"
            >
              <option value="all">All designations</option>
              <option value="Zonal">Zonal</option>
              <option value="Regional">Regional</option>
              <option value="Area">Area</option>
              <option value="Territory">Territory</option>
            </select>
          </label>
        </div>
      </div>

      {error ? <p className="error-text" role="alert">{error}</p> : null}

      <div className="c1-org-layout">
        <div className="c1-org-tree-panel" role="region" aria-label="Organization hierarchy tree">
          <div className="c1-org-tree-panel__head">
            <h3 className="c1-org-tree-panel__title">
              <FolderTree size={14} aria-hidden="true" />
              Hierarchy Tree
            </h3>
            <span className="meta-text c1-org-tree-panel__count">
              {filteredTree.length} root {filteredTree.length === 1 ? 'branch' : 'branches'}
            </span>
          </div>

          <div className="c1-org-tree-panel__content">
            {busy && !tree.length ? (
              <p className="meta-text c1-org-empty">Loading organogram…</p>
            ) : filteredTree.length ? (
              <ul className="c1-org-tree" role="tree">
                {filteredTree.map((root) => (
                  <MemberNode
                    key={root.id}
                    node={root}
                    depth={0}
                    selectedId={selectedId}
                    onSelect={(n) => setSelectedId(n.id)}
                  />
                ))}
              </ul>
            ) : (
              <div className="c1-org-empty">
                <UserRound size={32} className="c1-org-empty__icon" aria-hidden="true" />
                <p>
                  {searchQuery || levelFilter !== 'all'
                    ? 'No members match the current search or filters.'
                    : 'No users yet. Add a Zonal user to start the organogram.'}
                </p>
                {capabilities.canManage && !searchQuery && levelFilter === 'all' ? (
                  <Button type="button" size="compact" onClick={() => openCreate()}>
                    <Plus size={14} aria-hidden="true" />
                    Add first user
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <aside className="c1-org-detail" aria-label="Selected user details">
          {!selected ? (
            <div className="c1-org-detail__empty">
              <UserRound size={32} className="c1-org-empty__icon" aria-hidden="true" />
              <p className="meta-text">Select a user to view details and management actions.</p>
            </div>
          ) : (
            <div className="c1-org-detail__content">
              <div className="c1-org-detail__header">
                <div
                  className={`c1-org-detail__avatar c1-org-detail__avatar--${selectedDes.toLowerCase()}`}
                  aria-hidden="true"
                >
                  {getInitials(selected.fullName)}
                </div>
                <div className="c1-org-detail__header-text">
                  <h3 className="c1-org-detail__name">{selected.fullName}</h3>
                  <div className="c1-org-detail__tags">
                    <span className={`c1-level-tag c1-level-tag--${selectedDes.toLowerCase()}`}>
                      {selectedDes}
                    </span>
                    <span className={`c1-status-pill c1-status-pill--${selected.status}`}>
                      <span className="c1-status-pill__dot" aria-hidden="true" />
                      {selected.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="c1-org-detail__section">
                <h4 className="c1-org-detail__section-title">
                  <UserRound size={13} aria-hidden="true" />
                  Profile & Contact
                </h4>
                <dl className="c1-org-detail__grid">
                  <div className="c1-org-detail__tile">
                    <dt>Full Name</dt>
                    <dd><strong>{selected.fullName}</strong></dd>
                  </div>

                  <div className="c1-org-detail__tile">
                    <dt>Designation</dt>
                    <dd>{selectedDes}</dd>
                  </div>

                  <div className="c1-org-detail__tile">
                    <dt>Mobile Number</dt>
                    <dd>
                      <a href={`tel:${selected.mobile}`} className="c1-org-detail__link">
                        <Phone size={12} aria-hidden="true" />
                        {selected.mobile}
                      </a>
                    </dd>
                  </div>

                  <div className="c1-org-detail__tile">
                    <dt>Reporting Manager</dt>
                    <dd>
                      {selectedParent ? (
                        <button
                          type="button"
                          className="c1-org-parent-link"
                          onClick={() => setSelectedId(selectedParent.id)}
                          title="Click to jump to manager in organogram"
                        >
                          {selectedParent.fullName}
                          <span className="c1-org-parent-link__sub">
                            ({normalizeDesignation(selectedParent)})
                          </span>
                        </button>
                      ) : (
                        <span className="meta-text">No reporting parent (Top Level)</span>
                      )}
                    </dd>
                  </div>

                  <div className="c1-org-detail__tile c1-org-detail__tile--full">
                    <dt>
                      <MapPin size={12} aria-hidden="true" />
                      Assigned States
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
                      Assigned Cities
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

                    {selectedDes === 'Zonal' ? (
                      <Button
                        type="button"
                        size="compact"
                        onClick={() => openCreate({
                          designation: 'Regional',
                          parentId: selected.id,
                          states: selected.regions,
                        })}
                      >
                        <Plus size={13} aria-hidden="true" />
                        Add Regional
                      </Button>
                    ) : null}

                    {selectedDes === 'Regional' ? (
                      <Button
                        type="button"
                        size="compact"
                        onClick={() => openCreate({
                          designation: 'Area',
                          parentId: selected.id,
                          states: selected.regions,
                          cities: selected.locations,
                        })}
                      >
                        <Plus size={13} aria-hidden="true" />
                        Add Area
                      </Button>
                    ) : null}

                    {selectedDes === 'Area' ? (
                      <Button
                        type="button"
                        size="compact"
                        onClick={() => openCreate({
                          designation: 'Territory',
                          parentId: selected.id,
                          states: selected.regions,
                          cities: selected.locations,
                        })}
                      >
                        <Plus size={13} aria-hidden="true" />
                        Add Territory
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
        <form className="c1-org-form" onSubmit={submitForm} noValidate>
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
                {/* ROW 1: Full Name | Mobile Number */}
                <label className="field">
                  <span className="field__label">
                    Full Name <span className="req-star" aria-hidden="true">*</span>
                  </span>
                  <Input
                    required
                    name="fullName"
                    placeholder="e.g. Rahul Sharma"
                    value={form.fullName}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, fullName: e.target.value }));
                      if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: '' }));
                    }}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.fullName)}
                  />
                  {fieldErrors.fullName ? <span className="c1-field-error">{fieldErrors.fullName}</span> : null}
                </label>

                <label className="field">
                  <span className="field__label">
                    Mobile Number <span className="req-star" aria-hidden="true">*</span>
                  </span>
                  <Input
                    required
                    name="mobile"
                    type="tel"
                    inputMode="tel"
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    value={form.mobile}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D+/g, '').slice(0, 10);
                      setForm((p) => ({ ...p, mobile: val }));
                      if (fieldErrors.mobile) setFieldErrors((p) => ({ ...p, mobile: '' }));
                    }}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors.mobile)}
                  />
                  {fieldErrors.mobile ? <span className="c1-field-error">{fieldErrors.mobile}</span> : null}
                </label>

                {/* ROW 2: State (Multi-select) | City (Multi-select) */}
                <label className="field">
                  <span className="field__label">State (Multi-select)</span>
                  <AdaptiveSelect
                    multiple
                    name="states"
                    placeholder={availableStates.length ? 'Select state(s)' : 'Loading states…'}
                    value={form.states}
                    onChange={(e) => onStatesChange(e.target.value)}
                    aria-label="State (Multi-select)"
                  >
                    {availableStates.map((st) => (
                      <option key={st.name || st} value={st.name || st}>
                        {st.name || st}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </label>

                <label className="field">
                  <span className="field__label">City (Multi-select)</span>
                  <AdaptiveSelect
                    multiple
                    name="cities"
                    placeholder={
                      !form.states.length
                        ? 'Select state(s) first'
                        : loadingCities
                          ? 'Loading cities…'
                          : availableCities.length
                            ? 'Select city/cities'
                            : 'No cities found'
                    }
                    disabled={!form.states.length || loadingCities}
                    value={form.cities}
                    onChange={(e) => setForm((p) => ({ ...p, cities: Array.isArray(e.target.value) ? e.target.value : [] }))}
                    aria-label="City (Multi-select)"
                  >
                    {availableCities.map((ct) => (
                      <option key={`${ct.stateName || ''}-${ct.name || ct}`} value={ct.name || ct}>
                        {ct.name || ct}{ct.stateName ? ` (${ct.stateName})` : ''}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </label>

                {/* ROW 3: Designation (Dropdown) | Reporting To (Dropdown) */}
                <label className="field">
                  <span className="field__label">
                    Designation <span className="req-star" aria-hidden="true">*</span>
                  </span>
                  <select
                    className="tylo-select adaptive-select"
                    value={form.designation}
                    onChange={(e) => onDesignationChange(e.target.value)}
                    aria-label="Designation"
                    aria-required="true"
                  >
                    {DESIGNATIONS.map((des) => (
                      <option key={des} value={des}>{des}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field__label">
                    Reporting To {form.designation !== 'Zonal' ? <span className="req-star" aria-hidden="true">*</span> : null}
                  </span>
                  {form.designation === 'Zonal' ? (
                    <select
                      className="tylo-select adaptive-select"
                      disabled
                      value=""
                      aria-label="Reporting To"
                    >
                      <option value="">No reporting parent</option>
                    </select>
                  ) : (
                    <>
                      <select
                        className={`tylo-select adaptive-select${fieldErrors.parentId ? ' is-invalid' : ''}`}
                        value={form.parentId}
                        onChange={(e) => onParentChange(e.target.value)}
                        aria-label="Reporting To"
                        aria-required="true"
                      >
                        <option value="">
                          {parentOptions.length
                            ? `Select ${form.designation === 'Regional' ? 'Zonal' : form.designation === 'Area' ? 'Regional' : 'Area'} user`
                            : 'No active parent users available'}
                        </option>
                        {parentOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.fullName}{p.regions?.length ? ` (${p.regions.join(', ')})` : ''}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.parentId ? <span className="c1-field-error">{fieldErrors.parentId}</span> : null}
                    </>
                  )}
                </label>
              </div>

              {formMode === 'edit' ? (
                <div className="c1-org-form__status-row">
                  <label className="field">
                    <span className="field__label">Account Status</span>
                    <select
                      className="tylo-select adaptive-select"
                      value={form.status}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                      aria-label="Account Status"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              ) : null}

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
                  {saving ? 'Saving…' : formMode === 'create' ? 'Save User' : 'Save Changes'}
                </Button>
              </div>
            </>
          )}
        </form>
      </ModalShell>
    </section>
  );
}
