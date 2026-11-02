import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth.jsx';
import { OPERATIONAL_MODULES } from '../../shared/navModules.jsx';
import { api } from '../../shared/api.js';
import { notificationEntityPath } from '../notifications/notificationLinks.js';
import './homepage.css';

export const MODULES = OPERATIONAL_MODULES;

export const STAKEHOLDER_LEVELS = {
  TOP_MANAGER: 'top_manager',
  TEAM_LEADER: 'team_leader',
  INDIVIDUAL_STAFF: 'individual_staff',
};

export function detectStakeholderRole(user, can) {
  const isTopManager = Boolean(
    can('*') ||
      user?.role === 'admin' ||
      user?.role === 'Administrator' ||
      (can('dashboards:read') && can('users:write')),
  );
  const isTeamLeader = Boolean(
    !isTopManager &&
      (can('camps:approve') ||
        can('asset-requests:approve') ||
        can('movements:approve') ||
        can('finance:approve') ||
        can('finance:verify') ||
        user?.role === 'Approver' ||
        user?.role === 'reviewer' ||
        /leader|manager|supervisor|lead|head/i.test(String(user?.role || ''))),
  );
  return { isTopManager, isTeamLeader };
}

const MY_VIEW_STORAGE_KEY = 'tylo_one_my_view_config';
const NOTE_STORAGE_PREFIX = 'tylo:user-notes-';
const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'quarter', label: 'Quarter' },
];
const OVERVIEW_MODULE_KEY_MAP = {
  assets: 'asset-one',
  agreements: 'document-one',
  verifications: 'verification-one',
  camps: 'camp-one',
  'asset-requests': 'request-one',
  logistics: 'movement-one',
  finance: 'finance-one',
  contacts: 'master-one',
};
const QUICK_ACTIONS = [
  { id: 'ops-dashboard', moduleId: 'dashboards', title: 'Operations Dashboard', hint: 'Review operational performance', to: '/dashboard', canShow: (can) => can('dashboards:read') || can('*') },
  { id: 'manage-camps', moduleId: 'camp-one', title: 'Camp Operations', hint: 'Manage schedules and execution', to: '/camps/manage', canShow: (can) => can('camps:read') || can('camps:request') || can('camps:approve') || can('*') },
  { id: 'new-contact', moduleId: 'master-one', title: 'Contact Directory', hint: 'Clients, vendors and personnel', to: '/master-data?scope=document&entity=contacts', canShow: (can) => can('masters:read') || can('masters:write') || can('contacts:read') || can('*') },
  { id: 'agreements', moduleId: 'document-one', title: 'Agreements Hub', hint: 'Contracts and signatures', to: '/agreements', canShow: (can) => can('agreements:read') || can('agreements:write') || can('*') },
  { id: 'movements-outward', moduleId: 'movement-one', title: 'Goods Dispatch', hint: 'Material issues and tracking', to: '/movement-one/outward', canShow: (can) => can('logistics:read') || can('logistics:write') || can('*') },
  { id: 'finance-docs', moduleId: 'finance-one', title: 'Financial Documents', hint: 'Invoices, bills and settlements', to: '/finance', canShow: (can) => can('finance:read') || can('finance:write') || can('*') },
  { id: 'new-request', moduleId: 'request-one', title: 'Raise Asset Request', hint: 'Equipment or maintenance request', to: '/asset-requests', canShow: (can) => can('asset-requests:create') || can('requests:write') || can('asset-requests:write') || can('*') },
  { id: 'self-verification', moduleId: 'verification-one', title: 'Asset Verification', hint: 'Physical audits and checks', to: '/verifications', canShow: (can) => can('verifications:read') || can('verifications:write') || can('*') },
];
const WIDGETS = [
  { id: 'kpis', label: 'Pinned KPIs' },
  { id: 'shortcuts', label: 'Quick Access Shortcuts' },
  { id: 'tasks', label: 'My Active Tasks' },
  { id: 'productivity', label: 'Personal Productivity Hub' },
];
const DEFAULT_PINNED_MODULES = ['camp-one', 'asset-one', 'finance-one', 'request-one'];

function defaultConfig() {
  return {
    visible: { kpis: true, shortcuts: true, tasks: true, notes: true, messages: true },
    pinnedModules: DEFAULT_PINNED_MODULES,
    widths: { kpis: 'full', shortcuts: 'full', tasks: 'half', productivity: 'half' },
    order: WIDGETS.map((widget) => widget.id),
  };
}

function normalizeConfig(value) {
  const defaults = defaultConfig();
  if (!value || typeof value !== 'object') return defaults;
  const visible = value.visible && typeof value.visible === 'object' ? value.visible : {};
  const widths = value.widths && typeof value.widths === 'object' ? value.widths : {};
  const suppliedOrder = Array.isArray(value.order)
    ? value.order.filter((id) => WIDGETS.some((widget) => widget.id === id))
    : [];
  const order = [...new Set(suppliedOrder)];
  WIDGETS.forEach(({ id }) => { if (!order.includes(id)) order.push(id); });
  return {
    visible: {
      kpis: typeof visible.kpis === 'boolean' ? visible.kpis : defaults.visible.kpis,
      shortcuts: typeof visible.shortcuts === 'boolean' ? visible.shortcuts : defaults.visible.shortcuts,
      tasks: typeof visible.tasks === 'boolean' ? visible.tasks : defaults.visible.tasks,
      notes: typeof visible.notes === 'boolean' ? visible.notes : defaults.visible.notes,
      messages: typeof visible.messages === 'boolean' ? visible.messages : defaults.visible.messages,
    },
    pinnedModules: Array.isArray(value.pinnedModules)
      ? [...new Set(value.pinnedModules.filter((id) => typeof id === 'string'))]
      : defaults.pinnedModules,
    widths: {
      kpis: widths.kpis === 'half' ? 'half' : 'full',
      shortcuts: widths.shortcuts === 'half' ? 'half' : 'full',
      tasks: widths.tasks === 'full' ? 'full' : 'half',
      productivity: widths.productivity === 'full' ? 'full' : 'half',
    },
    order,
  };
}

function readUserConfig(userKey) {
  try {
    const raw = JSON.parse(localStorage.getItem(MY_VIEW_STORAGE_KEY) || '{}');
    if (!raw?.users?.[userKey]) {
      const legacyPins = JSON.parse(localStorage.getItem('tylo:pinned-modules') || 'null');
      if (Array.isArray(legacyPins)) {
        return normalizeConfig({ ...defaultConfig(), pinnedModules: legacyPins });
      }
    }
    return normalizeConfig(raw?.users?.[userKey]);
  } catch {
    return defaultConfig();
  }
}

function writeUserConfig(userKey, config) {
  try {
    const raw = JSON.parse(localStorage.getItem(MY_VIEW_STORAGE_KEY) || '{}');
    const users = raw?.users && typeof raw.users === 'object' ? raw.users : {};
    localStorage.setItem(MY_VIEW_STORAGE_KEY, JSON.stringify({
      version: 1,
      users: { ...users, [userKey]: config },
    }));
  } catch {
    // Personal layout is optional; a blocked storage write should not break the page.
  }
}

function readUserNotes(userKey) {
  try {
    const value = JSON.parse(localStorage.getItem(NOTE_STORAGE_PREFIX + userKey) || '[]');
    if (!Array.isArray(value)) return [];
    return value
      .filter((note) => note && typeof note.id === 'string' && typeof note.text === 'string')
      .map((note) => ({ ...note, done: Boolean(note.done) }));
  } catch {
    return [];
  }
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function countLabel(value) {
  const number = finiteNumber(value);
  return number === null ? '—' : number.toLocaleString('en-IN');
}

function getKpi(overview, id) {
  return finiteNumber(overview?.kpis?.find((item) => item.id === id)?.value);
}

function getStatusCount(map, keys) {
  for (const key of keys) {
    const value = finiteNumber(map?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function sumKnown(...values) {
  const available = values.filter((value) => value !== null && value !== undefined);
  return available.length ? available.reduce((sum, value) => sum + value, 0) : null;
}

function getGreeting(name) {
  const hour = new Date().getHours();
  const prefix = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = String(name || '').trim().split(/\s+/)[0];
  return firstName ? prefix + ', ' + firstName : prefix;
}

function asLocalDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
}

function PanelTitle({ eyebrow, title, action }) {
  return (
    <div className="tylo-home-panel-head">
      <div>{eyebrow && <span className="tylo-home-eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>
      {action}
    </div>
  );
}

function MetricCard({ title, subtitle, value, tone, footerLeft, footerRight, loading }) {
  return (
    <article className={'tylo-home-metric tylo-home-metric--' + tone}>
      <div className="tylo-home-metric-top"><div><p className="tylo-home-metric-label">{title}</p><p className="tylo-home-metric-subtitle">{subtitle}</p></div>
        {loading ? <span className="tylo-home-skeleton-value" aria-hidden="true" /> : <strong className="tylo-home-metric-value tabular-nums">{value}</strong>}
      </div>
      <div className="tylo-home-metric-footer"><span>{footerLeft}</span><span className="tabular-nums">{footerRight}</span></div>
    </article>
  );
}

function StatusPill({ severity, children }) {
  const value = String(severity || '').toLowerCase();
  let tone = 'neutral';
  if (value === 'critical') tone = 'danger';
  else if (['high', 'medium', 'warn'].includes(value)) tone = 'warning';
  else if (value === 'ok') tone = 'success';
  return <span className={'tylo-home-status tylo-home-status--' + tone}>{children}</span>;
}

function DashboardIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></svg>;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>;
}

function RefreshIcon({ spinning }) {
  return <svg className={spinning ? 'is-spinning' : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.7 9a7 7 0 0 1 11.7-2L20 12M4 12l2.6 5a7 7 0 0 0 11.7-2" /></svg>;
}

export default function DashboardPage() {
  const { can, user } = useAuth();
  const userKey = String(user?._id || user?.id || 'guest');
  const canSeeDashboard = Boolean(can('dashboards:read') || can('*'));
  const canReadNotifications = Boolean(can('notifications:read') || can('*'));
  const { isTopManager } = useMemo(() => detectStakeholderRole(user, can), [user, can]);
  const modules = useMemo(() => OPERATIONAL_MODULES.filter((module) => module.canShow(can)), [can]);
  const moduleById = useMemo(() => new Map(modules.map((module) => [module.id, module])), [modules]);
  const authorizedModuleIds = useMemo(() => new Set(modules.map((module) => module.id)), [modules]);
  const canSeeModule = useCallback((id) => isTopManager || authorizedModuleIds.has(id), [isTopManager, authorizedModuleIds]);

  const [activeMode, setActiveMode] = useState(() => canSeeDashboard ? 'dashboard' : 'my_view');
  const [activeDatePreset, setActiveDatePreset] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');
  const [notificationRows, setNotificationRows] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [attentionTab, setAttentionTab] = useState('pending');
  const [taskModuleFilter, setTaskModuleFilter] = useState('all');
  const [productivityTab, setProductivityTab] = useState('notes');
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [configState, setConfigState] = useState(() => ({ owner: userKey, value: readUserConfig(userKey) }));
  const [notesState, setNotesState] = useState(() => ({ owner: userKey, value: readUserNotes(userKey) }));
  const config = configState.owner === userKey ? configState.value : defaultConfig();
  const userNotes = notesState.owner === userKey ? notesState.value : [];

  useEffect(() => {
    if (!canSeeDashboard) setActiveMode('my_view');
  }, [canSeeDashboard]);

  useEffect(() => {
    if (configState.owner !== userKey) setConfigState({ owner: userKey, value: readUserConfig(userKey) });
    if (notesState.owner !== userKey) setNotesState({ owner: userKey, value: readUserNotes(userKey) });
  }, [userKey, configState.owner, notesState.owner]);

  useEffect(() => {
    if (!config.visible.notes && config.visible.messages) setProductivityTab('messages');
    else if (config.visible.notes && !config.visible.messages) setProductivityTab('notes');
  }, [config.visible.notes, config.visible.messages]);

  useEffect(() => {
    if (!canSeeDashboard) {
      setOverview(null);
      setOverviewLoading(false);
      setOverviewError('');
      return undefined;
    }
    let current = true;
    setOverview(null);
    setOverviewLoading(true);
    setOverviewError('');
    api('/dashboards/overview')
      .then((response) => {
        if (!current) return;
        if (!response?.data || typeof response.data !== 'object' ||
            !Array.isArray(response.data.kpis) || !Array.isArray(response.data.pending) ||
            !Array.isArray(response.data.alerts) || !Array.isArray(response.data.modules)) {
          throw new Error('The dashboard returned an invalid response.');
        }
        setOverview(response.data);
      })
      .catch((error) => {
        if (current) setOverviewError(error?.message || 'Unable to load operational metrics.');
      })
      .finally(() => {
        if (current) setOverviewLoading(false);
      });
    return () => { current = false; };
  }, [canSeeDashboard, refreshToken, userKey]);

  useEffect(() => {
    if (!canReadNotifications) {
      setNotificationRows([]);
      setNotificationError('');
      setNotificationLoading(false);
      return undefined;
    }
    let current = true;
    setNotificationRows([]);
    setNotificationLoading(true);
    setNotificationError('');
    api('/notifications?page=1&limit=5')
      .then((response) => {
        if (!Array.isArray(response?.data)) throw new Error('Notifications returned an invalid response.');
        if (current) setNotificationRows(response.data);
      })
      .catch((error) => {
        if (current) setNotificationError(error?.message || 'Unable to load notifications.');
      })
      .finally(() => {
        if (current) setNotificationLoading(false);
      });
    return () => { current = false; };
  }, [canReadNotifications, refreshToken, userKey]);

  const updateConfig = (transform) => {
    const next = normalizeConfig(transform(config));
    writeUserConfig(userKey, next);
    setConfigState({ owner: userKey, value: next });
  };
  const refreshData = () => setRefreshToken((value) => value + 1);
  const setPinned = (moduleId, checked) => updateConfig((previous) => ({
    ...previous,
    pinnedModules: checked
      ? [...new Set([...previous.pinnedModules, moduleId])]
      : previous.pinnedModules.filter((id) => id !== moduleId),
  }));
  const moveWidget = (widgetId, direction) => updateConfig((previous) => {
    const order = [...previous.order];
    const index = order.indexOf(widgetId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return previous;
    [order[index], order[target]] = [order[target], order[index]];
    return { ...previous, order };
  });
  const resetLayout = () => {
    const next = defaultConfig();
    writeUserConfig(userKey, next);
    setConfigState({ owner: userKey, value: next });
    setProductivityTab('notes');
  };

  const pinnedModules = useMemo(
    () => config.pinnedModules.filter((id) => authorizedModuleIds.has(id)).map((id) => moduleById.get(id)).filter(Boolean),
    [config.pinnedModules, authorizedModuleIds, moduleById],
  );
  const authorizedActions = useMemo(
    () => QUICK_ACTIONS.filter((action) => action.canShow(can)).map((action) => ({
      ...action,
      icon: action.moduleId === 'dashboards' ? <DashboardIcon /> : moduleById.get(action.moduleId)?.icon,
    })),
    [can, moduleById],
  );

  const filteredPending = useMemo(() => {
    if (!Array.isArray(overview?.pending)) return [];
    if (isTopManager) return overview.pending;
    return overview.pending.filter((item) => {
      const moduleId = OVERVIEW_MODULE_KEY_MAP[item.module];
      return moduleId ? authorizedModuleIds.has(moduleId) : true;
    });
  }, [overview, isTopManager, authorizedModuleIds]);
  const filteredAlerts = useMemo(() => {
    if (!Array.isArray(overview?.alerts)) return [];
    if (isTopManager) return overview.alerts;
    return overview.alerts.filter((item) => {
      const moduleId = OVERVIEW_MODULE_KEY_MAP[item.module];
      return moduleId ? authorizedModuleIds.has(moduleId) : true;
    });
  }, [overview, isTopManager, authorizedModuleIds]);

  const metrics = useMemo(() => {
    if (!overview) return null;
    const campsAllowed = canSeeModule('camp-one');
    const assetsAllowed = canSeeModule('asset-one');
    const financeAllowed = canSeeModule('finance-one');
    const campsByStatus = overview?.breakdowns?.campsByStatus || {};
    const assetsByStatus = overview?.breakdowns?.assetsByStatus || {};
    const camps = campsAllowed ? getKpi(overview, 'camps') : null;
    const scheduled = campsAllowed ? getStatusCount(campsByStatus, ['SCHEDULED', 'UPCOMING']) : null;
    const ongoing = campsAllowed ? getStatusCount(campsByStatus, ['ONGOING']) : null;
    const completed = campsAllowed ? getStatusCount(campsByStatus, ['COMPLETED']) : null;
    const available = assetsAllowed ? getStatusCount(assetsByStatus, ['AVAILABLE']) : null;
    const maintenance = assetsAllowed
      ? getStatusCount(assetsByStatus, ['MAINTENANCE', 'REPAIR']) ?? getKpi(overview, 'open-repairs')
      : null;
    const financials = financeAllowed ? overview.financials || {} : {};
    const expenseOpen = financeAllowed ? finiteNumber(financials.expenseOpen) : null;
    const invoiceOpen = financeAllowed ? finiteNumber(financials.invoiceOpen) : null;
    const commercialPending = financeAllowed
      ? sumKnown(finiteNumber(financials.commercialDraft), finiteNumber(financials.commercialSubmitted))
      : null;
    const pendingRequests = canSeeModule('request-one')
      ? finiteNumber(overview.pending?.find((item) => item.id === 'requests')?.count) ?? getKpi(overview, 'pending-requests')
      : null;
    const openRepairs = canSeeModule('request-one')
      ? finiteNumber(overview.pending?.find((item) => item.id === 'repairs')?.count) ?? getKpi(overview, 'open-repairs')
      : null;
    const pendingCamps = campsAllowed ? sumKnown(scheduled, ongoing) : null;
    const totalExceptions = filteredAlerts.length + (filteredPending.length > 0 ? 1 : 0);
    const departmentModules = Array.isArray(overview.modules)
      ? overview.modules.filter((item) => {
        const moduleId = OVERVIEW_MODULE_KEY_MAP[item.id];
        return moduleId && canSeeModule(moduleId);
      })
      : [];
    const financeQueue = financeAllowed
      ? filteredPending.filter((item) => item.module === 'finance').reduce((sum, item) => sum + (finiteNumber(item.count) || 0), 0)
      : null;
    const qualityAllowed = canSeeModule('verification-one') || canSeeModule('request-one') || canSeeModule('document-one');
    const qualityAlerts = qualityAllowed
      ? filteredAlerts.filter((item) => ['verifications', 'asset-requests', 'agreements'].includes(item.module))
      : null;
    const repairsBreached = canSeeModule('request-one') ? finiteNumber(overview.repairsSla?.breached) : null;
    const verificationExceptions = canSeeModule('verification-one') ? getKpi(overview, 'verify-exceptions') : null;
    return {
      camps, scheduled, ongoing, completed, available, maintenance,
      expenseOpen, invoiceOpen, commercialPending, pendingRequests, openRepairs,
      pendingCamps, totalExceptions, departmentModules, financeQueue,
      qualityAlerts, repairsBreached, verificationExceptions,
    };
  }, [overview, canSeeModule, filteredAlerts, filteredPending]);

  const taskRows = useMemo(() => [
    ...filteredPending.map((item) => {
      const count = finiteNumber(item.count);
      return {
        id: 'pending-' + item.id,
        label: item.label,
        detail: countLabel(count) + ' open item' + (count === 1 ? '' : 's'),
        severity: item.severity,
        module: item.module,
        href: item.href,
      };
    }),
    ...filteredAlerts.map((item) => ({
      id: 'alert-' + item.id,
      label: item.label,
      detail: item.detail,
      severity: item.severity,
      module: item.module,
      href: item.href,
    })),
  ], [filteredPending, filteredAlerts]);
  const taskModules = useMemo(() => {
    const ids = [...new Set(taskRows.map((item) => OVERVIEW_MODULE_KEY_MAP[item.module]).filter(Boolean))];
    return ids.map((id) => moduleById.get(id)).filter(Boolean);
  }, [taskRows, moduleById]);
  const visibleTaskRows = taskRows.filter((item) => (
    taskModuleFilter === 'all' || OVERVIEW_MODULE_KEY_MAP[item.module] === taskModuleFilter
  ));

  const query = searchQuery.trim().toLowerCase();
  const searchActions = authorizedActions.filter((action) => (action.title + ' ' + action.hint).toLowerCase().includes(query));
  const searchModules = modules.filter((module) => (
    (module.title + ' ' + (module.blurb || '') + ' ' + (module.keywords || []).join(' ')).toLowerCase().includes(query)
  ));
  const isSearching = Boolean(query);
  const saveNotes = (nextNotes) => {
    setNotesState({ owner: userKey, value: nextNotes });
    try {
      localStorage.setItem(NOTE_STORAGE_PREFIX + userKey, JSON.stringify(nextNotes));
    } catch {
      // Notes remain available for this session if browser storage is unavailable.
    }
  };
  const handleAddNote = (event) => {
    event.preventDefault();
    const text = newNoteText.trim();
    if (!text) return;
    saveNotes([{ id: String(Date.now()), text, done: false }, ...userNotes]);
    setNewNoteText('');
  };
  const handleToggleNote = (id) => saveNotes(userNotes.map((note) => note.id === id ? { ...note, done: !note.done } : note));
  const handleDeleteNote = (id) => saveNotes(userNotes.filter((note) => note.id !== id));

  const renderMetricGrid = (workspace) => {
    const data = metrics;
    const loading = overviewLoading;
    return (
      <div className={'tylo-home-metric-grid' + (workspace ? ' tylo-home-metric-grid--workspace' : '')}>
        <MetricCard title="Total camps" subtitle="Across all territories" value={loading ? '' : countLabel(data?.camps)} tone="blue" loading={loading} footerLeft="Camps" footerRight={countLabel(data?.scheduled) + ' scheduled · ' + countLabel(data?.completed) + ' completed'} />
        <MetricCard title="Actioned camps" subtitle="Executed and completed" value={loading ? '' : countLabel(data?.completed)} tone="green" loading={loading} footerLeft="Assets" footerRight={countLabel(data?.available) + ' available · ' + countLabel(data?.maintenance) + ' maintenance / repair'} />
        <MetricCard title="Pending camps" subtitle="Scheduled and in progress" value={loading ? '' : countLabel(data?.pendingCamps)} tone="amber" loading={loading} footerLeft="Pending finance" footerRight={loading ? 'Loading' : countLabel(data?.expenseOpen) + ' expenses'} />
        <MetricCard title="Operational exceptions" subtitle={loading ? 'Loading current queues' : data ? (data.totalExceptions ? 'Queues need review' : 'All queues nominal') : 'Overview unavailable'} value={loading ? '' : data ? countLabel(data.totalExceptions) : '—'} tone={data?.totalExceptions ? 'red' : 'green'} loading={loading} footerLeft="Requests" footerRight={countLabel(data?.pendingRequests) + ' pending · ' + countLabel(data?.openRepairs) + ' repairs'} />
      </div>
    );
  };

  const renderWorkspaceWidget = (widgetId) => {
    const width = config.widths[widgetId] || 'half';
    const widthClass = 'tylo-home-widget--' + width;
    if (widgetId === 'kpis') {
      return (
        <section key={widgetId} className={'tylo-home-panel tylo-home-widget ' + widthClass} aria-label="Pinned KPIs">
          <PanelTitle eyebrow="MY VIEW" title="Pinned KPIs" />
          {!canSeeDashboard
            ? <div className="tylo-home-empty tylo-home-empty--compact"><strong>Dashboard metrics unavailable</strong><span>Your role does not include dashboard access.</span></div>
            : overviewError
              ? <div className="tylo-home-inline-error" role="alert">{overviewError}<button type="button" className="tylo-home-text-button" onClick={refreshData}>Retry</button></div>
              : renderMetricGrid(true)}
        </section>
      );
    }
    if (widgetId === 'shortcuts') {
      return (
        <section key={widgetId} className={'tylo-home-panel tylo-home-widget ' + widthClass} aria-label="Quick Access Shortcuts">
          <PanelTitle eyebrow="PERSONAL SHORTCUTS" title="Pinned modules" action={<button type="button" className="tylo-home-button tylo-home-button--quiet" onClick={() => setCustomizing((value) => !value)} aria-expanded={customizing}>+ Pin module</button>} />
          {pinnedModules.length
            ? <div className="tylo-home-module-grid">{pinnedModules.map((module) => <Link key={module.id} to={module.to} className="tylo-home-module-tile"><span className="tylo-home-module-icon">{module.icon}</span><span className="tylo-home-module-copy"><strong>{module.title}</strong><small>{module.blurb}</small></span><span className="tylo-home-arrow" aria-hidden="true">↗</span></Link>)}</div>
            : <div className="tylo-home-empty"><strong>No modules pinned</strong><span>Choose an authorized module in Customize View.</span></div>}
        </section>
      );
    }
    if (widgetId === 'tasks') {
      return (
        <section key={widgetId} className={'tylo-home-panel tylo-home-widget ' + widthClass} aria-label="My Active Tasks">
          <PanelTitle eyebrow="OPERATIONAL QUEUES" title="My Active Tasks" action={<span className="tylo-home-count tabular-nums">{overviewError ? '—' : countLabel(filteredPending.length + filteredAlerts.length)} queue signals</span>} />
          <p className="tylo-home-panel-note">Live queue items visible to your role. The overview does not provide assignment-specific task ownership.</p>
          {!canSeeDashboard
            ? <div className="tylo-home-empty"><strong>Live queues unavailable</strong><span>Your role does not include dashboard access. Use your authorized module shortcuts.</span></div>
            : overviewLoading
              ? <div className="tylo-home-loading" role="status"><span className="tylo-home-spinner" /> Loading operational queues…</div>
              : overviewError
                ? <div className="tylo-home-inline-error" role="alert">{overviewError}<button type="button" className="tylo-home-text-button" onClick={refreshData}>Retry</button></div>
                : <><div className="tylo-home-filter-pills" aria-label="Filter tasks by module"><button type="button" className={taskModuleFilter === 'all' ? 'is-active' : ''} onClick={() => setTaskModuleFilter('all')}>All queues</button>{taskModules.map((module) => <button type="button" key={module.id} className={taskModuleFilter === module.id ? 'is-active' : ''} onClick={() => setTaskModuleFilter(module.id)}>{module.title}</button>)}</div>
                  {visibleTaskRows.length
                    ? <div className="tylo-home-task-list">{visibleTaskRows.map((task) => { const moduleId = OVERVIEW_MODULE_KEY_MAP[task.module]; const module = moduleById.get(moduleId); return <article className="tylo-home-task-row" key={task.id}><span className="tylo-home-task-icon">{module?.icon || '•'}</span><div className="tylo-home-task-main"><div className="tylo-home-task-title"><strong>{task.label}</strong><StatusPill severity={task.severity}>{task.severity || 'Active'}</StatusPill></div><p>{task.detail}</p><small>{module?.title || task.module}</small></div>{task.href ? <Link className="tylo-home-button tylo-home-button--small" to={task.href}>Open</Link> : null}</article>; })}</div>
                    : <div className="tylo-home-empty"><strong>No active items</strong><span>There are no open queues or alerts for the selected modules.</span></div>}</>}
        </section>
      );
    }
    return (
      <section key={widgetId} className={'tylo-home-panel tylo-home-widget ' + widthClass} aria-label="Personal Productivity Hub">
        <PanelTitle eyebrow="PERSONAL WORKSPACE" title="Productivity hub" />
        <div className="tylo-home-tabs" role="tablist" aria-label="Productivity sections">
          {config.visible.notes && <button type="button" role="tab" aria-selected={productivityTab === 'notes'} className={productivityTab === 'notes' ? 'is-active' : ''} onClick={() => setProductivityTab('notes')}>Sticky Notes / Todo</button>}
          {config.visible.messages && <button type="button" role="tab" aria-selected={productivityTab === 'messages'} className={productivityTab === 'messages' ? 'is-active' : ''} onClick={() => setProductivityTab('messages')}>Messages for Me</button>}
        </div>
        {productivityTab === 'notes' && config.visible.notes
          ? <div className="tylo-home-productivity-body" role="tabpanel"><form className="tylo-home-note-form" onSubmit={handleAddNote}><label className="sr-only" htmlFor="tylo-home-note-input">Add a personal reminder</label><input id="tylo-home-note-input" maxLength={240} value={newNoteText} onChange={(event) => setNewNoteText(event.target.value)} placeholder="Add a reminder…" /><button type="submit" className="tylo-home-button tylo-home-button--primary" disabled={!newNoteText.trim()}>Add note</button></form>
            {userNotes.length ? <ul className="tylo-home-note-list">{userNotes.map((note) => <li key={note.id} className={note.done ? 'is-done' : ''}><label><input type="checkbox" checked={note.done} onChange={() => handleToggleNote(note.id)} /><span>{note.text}</span></label><button type="button" className="tylo-home-icon-button" onClick={() => handleDeleteNote(note.id)} aria-label={'Delete reminder: ' + note.text} title="Delete reminder">×</button></li>)}</ul>
              : <div className="tylo-home-empty tylo-home-empty--compact"><strong>No reminders yet</strong><span>Add a note to keep a personal follow-up here.</span></div>}</div>
          : config.visible.messages
            ? <div className="tylo-home-productivity-body" role="tabpanel"><p className="tylo-home-panel-note">Recent notifications and workflow updates for your account.</p>{!canReadNotifications
              ? <div className="tylo-home-empty tylo-home-empty--compact"><strong>Notification access is not enabled</strong><span>Ask an administrator to grant notification access.</span></div>
              : notificationLoading
                ? <div className="tylo-home-loading" role="status"><span className="tylo-home-spinner" /> Loading notifications…</div>
                : notificationError
                  ? <div className="tylo-home-inline-error" role="alert">{notificationError}<button type="button" className="tylo-home-text-button" onClick={refreshData}>Retry</button></div>
                  : notificationRows.length
                    ? <div className="tylo-home-message-list">{notificationRows.map((notification) => { const target = notificationEntityPath(notification) || '/notifications'; return <Link key={notification._id} to={target} className="tylo-home-message-row"><span className={'tylo-home-unread-dot' + (notification.readAt ? '' : ' is-unread')} aria-label={notification.readAt ? 'Read' : 'Unread'} /><span className="tylo-home-message-copy"><strong>{notification.title || notification.subject || 'Operational notification'}</strong><small>{notification.body || notification.message || notification.actorEmail || 'Open notification details'}</small></span><time dateTime={notification.createdAt || undefined}>{asLocalDate(notification.createdAt)}</time></Link>; })}</div>
                    : <div className="tylo-home-empty tylo-home-empty--compact"><strong>No notifications</strong><span>Your operational notifications will appear here.</span></div>}
              {canReadNotifications && <Link className="tylo-home-inline-link" to="/notifications">Open notification center <span aria-hidden="true">→</span></Link>}</div>
            : <div className="tylo-home-empty tylo-home-empty--compact" role="tabpanel"><strong>Productivity sections are hidden</strong><span>Enable notes or messages in Customize View.</span></div>}
      </section>
    );
  };

  const renderDashboardMode = () => {
    const departmentModules = metrics?.departmentModules || [];
    const pendingTotal = filteredPending.reduce((sum, item) => sum + (finiteNumber(item.count) || 0), 0);
    const alertTotal = filteredAlerts.length;
    const qualityCount = metrics?.qualityAlerts?.length ?? null;
    const financeDetail = countLabel(metrics?.expenseOpen) + ' expenses · ' + countLabel(metrics?.invoiceOpen) + ' invoices · ' + countLabel(metrics?.commercialPending) + ' commercial docs';
    const campStatusDetail = countLabel(metrics?.scheduled) + ' scheduled · ' + countLabel(metrics?.ongoing) + ' in progress · ' + countLabel(metrics?.completed) + ' completed';
    return (
      <>
        {overviewError && <div className="tylo-home-error-banner" role="alert"><span>{overviewError}</span><button type="button" className="tylo-home-button tylo-home-button--small" onClick={refreshData}>Retry</button></div>}
        <div className="tylo-home-section-heading"><div><span className="tylo-home-eyebrow">OPERATIONS SNAPSHOT</span><h2>Key performance indicators</h2></div>{overview?.generatedAt ? <span className="tylo-home-updated">Updated {asLocalDate(overview.generatedAt)}</span> : null}</div>
        {renderMetricGrid(false)}
        <div className="tylo-home-dashboard-grid">
          <div className="tylo-home-dashboard-main">
            <section className="tylo-home-panel" aria-label="Operational overview">
              <PanelTitle eyebrow="FOUR-STAGE OPERATIONAL PIPELINE" title="Operational overview" />
              {overviewLoading
                ? <div className="tylo-home-loading" role="status"><span className="tylo-home-spinner" /> Loading operational data…</div>
                : overviewError
                  ? <div className="tylo-home-empty"><strong>Operational summary unavailable</strong><span>Retry to load the latest module metrics.</span></div>
                  : <div className="tylo-home-stage-grid">
                    <article className="tylo-home-stage-card tylo-home-stage-card--department"><div className="tylo-home-stage-title"><span>1</span><h3>Department performance</h3><strong className="tabular-nums">{departmentModules.length}</strong></div><p>Authorized modules reporting in the overview</p><div className="tylo-home-department-list">
                      {departmentModules.slice(0, 4).map((item) => { const module = moduleById.get(OVERVIEW_MODULE_KEY_MAP[item.id]); return module ? <Link key={item.id} to={module.to}><span>{item.label}</span><strong className="tabular-nums">{countLabel(item.primary)} <small>{item.primaryLabel}</small></strong></Link> : null; })}
                      {!departmentModules.length && <span className="tylo-home-muted">No module summaries are available for this role.</span>}
                    </div></article>
                    <article className="tylo-home-stage-card"><div className="tylo-home-stage-title"><span>2</span><h3>Financials & settlements</h3><strong className="tabular-nums">{countLabel(metrics?.financeQueue)}</strong></div><p>Open finance queue items</p><div className="tylo-home-stage-detail"><span>{financeDetail}</span>{metrics?.financeQueue === 0 ? <StatusPill severity="ok">Nominal</StatusPill> : metrics?.financeQueue == null ? <StatusPill>Restricted</StatusPill> : <StatusPill severity="medium">Review</StatusPill>}</div>{canSeeModule('finance-one') && <Link to="/finance" className="tylo-home-stage-link">Open Finance One <span aria-hidden="true">→</span></Link>}</article>
                    <article className="tylo-home-stage-card"><div className="tylo-home-stage-title"><span>3</span><h3>Camp execution & logistics</h3><strong className="tabular-nums">{countLabel(metrics?.camps)}</strong></div><p>Total camps in the current overview</p><div className="tylo-home-stage-detail"><span>{campStatusDetail}</span>{canSeeModule('movement-one') && overview?.breakdowns?.movementsByStatus && <span>{countLabel(Object.values(overview.breakdowns.movementsByStatus).reduce((sum, value) => sum + (finiteNumber(value) || 0), 0))} movement items</span>}</div>{canSeeModule('camp-one') && <Link to="/camps/manage" className="tylo-home-stage-link">Open Camp One <span aria-hidden="true">→</span></Link>}</article>
                    <article className="tylo-home-stage-card"><div className="tylo-home-stage-title"><span>4</span><h3>Quality & compliance QA</h3><strong className="tabular-nums">{countLabel(qualityCount)}</strong></div><p>Open compliance alerts for authorized modules</p><div className="tylo-home-stage-detail"><span>{countLabel(metrics?.verificationExceptions)} verification exceptions · {countLabel(metrics?.repairsBreached)} repair SLAs past due</span>{qualityCount === 0 ? <StatusPill severity="ok">Nominal</StatusPill> : qualityCount == null ? <StatusPill>Restricted</StatusPill> : <StatusPill severity="high">Review</StatusPill>}</div>{canSeeModule('verification-one') && <Link to="/verifications" className="tylo-home-stage-link">Open Verification One <span aria-hidden="true">→</span></Link>}</article>
                  </div>}
            </section>

            <section className="tylo-home-panel" aria-label="Attention required">
              <PanelTitle eyebrow="TEAM QUEUES AWAITING REVIEW" title="Attention required" action={<span className="tylo-home-count tabular-nums">{overviewError ? '—' : filteredPending.length + alertTotal} open signals</span>} />
              <div className="tylo-home-tabs" role="tablist" aria-label="Attention queues"><button type="button" role="tab" aria-selected={attentionTab === 'pending'} className={attentionTab === 'pending' ? 'is-active' : ''} onClick={() => setAttentionTab('pending')}>Pending actions <span>{overviewError ? '—' : countLabel(pendingTotal)}</span></button><button type="button" role="tab" aria-selected={attentionTab === 'alerts'} className={attentionTab === 'alerts' ? 'is-active' : ''} onClick={() => setAttentionTab('alerts')}>Active alerts <span>{overviewError ? '—' : countLabel(alertTotal)}</span></button></div>
              {overviewLoading
                ? <div className="tylo-home-loading" role="status"><span className="tylo-home-spinner" /> Loading queues…</div>
                : overviewError
                  ? <div className="tylo-home-empty"><strong>Queue data unavailable</strong><button type="button" className="tylo-home-text-button" onClick={refreshData}>Retry</button></div>
                  : <div className="tylo-home-attention-list">{attentionTab === 'pending'
                    ? filteredPending.length ? filteredPending.map((item) => <Link key={item.id} className="tylo-home-attention-row" to={item.href}><span className="tylo-home-attention-icon">{moduleById.get(OVERVIEW_MODULE_KEY_MAP[item.module])?.icon || '•'}</span><span className="tylo-home-attention-copy"><strong>{item.label}</strong><small>{moduleById.get(OVERVIEW_MODULE_KEY_MAP[item.module])?.title || item.module}</small></span><StatusPill severity={item.severity}>{countLabel(item.count)}</StatusPill><span className="tylo-home-arrow" aria-hidden="true">→</span></Link>)
                      : <div className="tylo-home-empty tylo-home-empty--compact"><strong>No pending actions</strong><span>All visible operational queues are clear.</span></div>
                    : filteredAlerts.length ? filteredAlerts.map((item) => <Link key={item.id} className="tylo-home-attention-row" to={item.href}><span className="tylo-home-attention-icon tylo-home-attention-icon--alert" aria-hidden="true">!</span><span className="tylo-home-attention-copy"><strong>{item.label}</strong><small>{item.detail}</small></span><StatusPill severity={item.severity}>{item.severity || 'Alert'}</StatusPill><span className="tylo-home-arrow" aria-hidden="true">→</span></Link>)
                      : <div className="tylo-home-empty tylo-home-empty--compact"><strong>No active alerts</strong><span>There are no visible escalations or exceptions.</span></div>}</div>}
            </section>
          </div>

          <aside className="tylo-home-dashboard-side">
            <section className="tylo-home-panel" aria-label="Quick access">
              <PanelTitle eyebrow="AUTHORIZED WORKFLOWS" title="Quick access" action={<button type="button" className="tylo-home-button tylo-home-button--quiet" onClick={() => setPinPickerOpen((value) => !value)} aria-expanded={pinPickerOpen}>★ Customize pins</button>} />
              {pinPickerOpen && <div className="tylo-home-pin-list" aria-label="Customize pinned modules">{modules.map((module) => <label key={module.id}><input type="checkbox" checked={config.pinnedModules.includes(module.id)} onChange={(event) => setPinned(module.id, event.target.checked)} /><span>{module.title}</span></label>)}</div>}
              <div className="tylo-home-action-grid">{authorizedActions.slice(0, 6).map((action) => <Link key={action.id} to={action.to} className="tylo-home-action-tile"><span className="tylo-home-action-icon">{action.icon}</span><span><strong>{action.title}</strong><small>{action.hint}</small></span><span className="tylo-home-arrow" aria-hidden="true">↗</span></Link>)}{!authorizedActions.length && <div className="tylo-home-empty"><strong>No shortcuts available</strong><span>Your role has no matching module access.</span></div>}</div>
            </section>
            <section className="tylo-home-panel tylo-home-team-summary" aria-label="Team queue and module summary">
              <PanelTitle eyebrow="YOUR WORKSPACE" title="Team queue & modules" />
              <div className="tylo-home-summary-stats"><div><strong className="tabular-nums">{overviewLoading ? '…' : overviewError ? '—' : countLabel(pendingTotal)}</strong><span>open queue items</span></div><div><strong className="tabular-nums">{modules.length}</strong><span>authorized modules</span></div></div>
              <div className="tylo-home-summary-modules">{modules.slice(0, 4).map((module) => <span key={module.id} title={module.title}>{module.icon}<small>{module.title}</small></span>)}</div>
              <button type="button" className="tylo-home-button tylo-home-button--primary tylo-home-open-view" onClick={() => setActiveMode('my_view')}>Open My View <span aria-hidden="true">→</span></button>
            </section>
          </aside>
        </div>
      </>
    );
  };

  const renderSearchResults = () => (
    <section className="tylo-home-panel tylo-home-search-results" aria-label="Search results">
      <PanelTitle eyebrow="AUTHORIZED RESULTS" title={'Results for “' + searchQuery.trim() + '”'} />
      <div className="tylo-home-search-grid">
        {searchActions.map((action) => <Link key={'action-' + action.id} to={action.to} className="tylo-home-search-result"><span className="tylo-home-action-icon">{action.icon}</span><span><strong>{action.title}</strong><small>{action.hint}</small></span><span className="tylo-home-arrow" aria-hidden="true">↗</span></Link>)}
        {searchModules.map((module) => <Link key={'module-' + module.id} to={module.to} className="tylo-home-search-result"><span className="tylo-home-action-icon">{module.icon}</span><span><strong>{module.title}</strong><small>{module.blurb}</small></span><span className="tylo-home-arrow" aria-hidden="true">↗</span></Link>)}
        {!searchActions.length && !searchModules.length && <div className="tylo-home-empty"><strong>No authorized matches</strong><span>Try a different module or workflow name.</span></div>}
      </div>
    </section>
  );

  const canShowProductivity = config.visible.notes || config.visible.messages;
  const orderedWidgets = config.order.filter((id) => (
    id === 'kpis' ? config.visible.kpis
      : id === 'shortcuts' ? config.visible.shortcuts
        : id === 'tasks' ? config.visible.tasks
          : id === 'productivity' ? canShowProductivity
            : false
  ));
  const customizationBar = customizing && activeMode === 'my_view' ? (
    <section className="tylo-home-customize" aria-label="Customize My View">
      <div className="tylo-home-customize-head"><div><span className="tylo-home-eyebrow">PERSONALIZE</span><h2>Customize My View</h2></div><button type="button" className="tylo-home-button tylo-home-button--quiet" onClick={() => setCustomizing(false)}>Done</button></div>
      <div className="tylo-home-customize-grid">
        <div className="tylo-home-customize-group"><h3>Visible sections</h3>{[['kpis', 'Pinned KPIs'], ['shortcuts', 'Quick Access Shortcuts'], ['tasks', 'My Active Tasks'], ['notes', 'Sticky Notes / Todo'], ['messages', 'Messages for Me']].map(([id, label]) => <label className="tylo-home-check-row" key={id}><input type="checkbox" checked={config.visible[id]} disabled={id === 'messages' && !canReadNotifications} onChange={(event) => updateConfig((previous) => ({ ...previous, visible: { ...previous.visible, [id]: event.target.checked } }))} /><span>{label}</span></label>)}{!canReadNotifications && <small className="tylo-home-muted">Messages require notification permission.</small>}</div>
        <div className="tylo-home-customize-group"><h3>Pin authorized modules</h3><div className="tylo-home-pin-options">{modules.map((module) => <label className="tylo-home-check-row" key={module.id}><input type="checkbox" checked={config.pinnedModules.includes(module.id)} onChange={(event) => setPinned(module.id, event.target.checked)} /><span>{module.title}</span></label>)}</div></div>
        <div className="tylo-home-customize-group tylo-home-layout-group"><h3>Layout</h3>{config.order.map((id) => { const widget = WIDGETS.find((item) => item.id === id); return <div className="tylo-home-layout-row" key={id}><span>{widget?.label}{id === 'productivity' && !canShowProductivity ? ' · hidden' : id !== 'productivity' && !config.visible[id] ? ' · hidden' : ''}</span><select aria-label={(widget?.label || 'Widget') + ' width'} value={config.widths[id] || 'half'} onChange={(event) => updateConfig((previous) => ({ ...previous, widths: { ...previous.widths, [id]: event.target.value } }))}><option value="half">Half width</option><option value="full">Full width</option></select><div className="tylo-home-order-buttons"><button type="button" className="tylo-home-icon-button" disabled={config.order.indexOf(id) === 0} aria-label={'Move ' + widget?.label + ' up'} onClick={() => moveWidget(id, -1)}>↑</button><button type="button" className="tylo-home-icon-button" disabled={config.order.indexOf(id) === config.order.length - 1} aria-label={'Move ' + widget?.label + ' down'} onClick={() => moveWidget(id, 1)}>↓</button></div></div>; })}<button type="button" className="tylo-home-button tylo-home-button--quiet tylo-home-reset" onClick={resetLayout}>Reset to default layout</button></div>
      </div>
    </section>
  ) : null;

  const dateText = useMemo(() => new Intl.DateTimeFormat('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date()), []);
  const greetingName = user?.fullName || user?.name || user?.displayName || '';
  const roleName = String(user?.roleLabel || user?.role || 'User');

  return (
    <main className="tylo-home" aria-labelledby="tylo-home-title">
      <header className="tylo-home-command">
        <div className="tylo-home-command-top">
          <div className="tylo-home-identity"><div className="tylo-home-title-line"><h1 id="tylo-home-title">{activeMode === 'dashboard' ? 'Business Overview' : 'My View'}</h1><span className="tylo-home-role-badge">{roleName.toUpperCase()}</span></div><p>{getGreeting(greetingName)} <span aria-hidden="true">·</span> {dateText}</p></div>
          <div className="tylo-home-mode-toggle" role="group" aria-label="Dashboard view"><button type="button" className={activeMode === 'dashboard' ? 'is-active' : ''} aria-pressed={activeMode === 'dashboard'} disabled={!canSeeDashboard} title={!canSeeDashboard ? 'Dashboard access is not enabled for your role' : undefined} onClick={() => setActiveMode('dashboard')}><DashboardIcon /><span>Tylo One Dashboard</span></button><button type="button" className={activeMode === 'my_view' ? 'is-active' : ''} aria-pressed={activeMode === 'my_view'} onClick={() => setActiveMode('my_view')}><span className="tylo-home-user-mark" aria-hidden="true">◉</span><span>My View</span></button></div>
        </div>
        <div className="tylo-home-command-bottom">
          <label className="tylo-home-search"><SearchIcon /><span className="sr-only">Filter modules or workflows</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Filter modules or workflows…" />{searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search">×</button>}</label>
          {activeMode === 'dashboard'
            ? <div className="tylo-home-header-context"><div className="tylo-home-date-filter" role="group" aria-label="Snapshot period" title="The current overview API returns current totals; date presets are visual context only.">{DATE_PRESETS.map((preset) => <button type="button" key={preset.id} className={activeDatePreset === preset.id ? 'is-active' : ''} aria-pressed={activeDatePreset === preset.id} onClick={() => setActiveDatePreset(preset.id)}>{preset.label}</button>)}</div><span className="tylo-home-snapshot-note">Snapshot · periods not applied</span></div>
            : <button type="button" className="tylo-home-button" onClick={() => setCustomizing((value) => !value)} aria-expanded={customizing}><span aria-hidden="true">☷</span> Customize View</button>}
          <button type="button" className="tylo-home-icon-button tylo-home-refresh" onClick={refreshData} aria-label="Refresh dashboard data" title="Refresh dashboard data" disabled={overviewLoading || notificationLoading}><RefreshIcon spinning={overviewLoading || notificationLoading} /></button>
        </div>
      </header>
      {activeMode === 'my_view' && customizationBar}
      {isSearching
        ? renderSearchResults()
        : activeMode === 'dashboard' && canSeeDashboard
          ? renderDashboardMode()
          : <div className="tylo-home-widget-grid">{orderedWidgets.length ? orderedWidgets.map(renderWorkspaceWidget) : <section className="tylo-home-panel tylo-home-empty"><strong>All sections are hidden</strong><button type="button" className="tylo-home-button" onClick={() => setCustomizing(true)}>Customize My View</button></section>}</div>}
    </main>
  );
}
