import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth.jsx';
import { OPERATIONAL_MODULES } from '../../shared/navModules.jsx';
import { api } from '../../shared/api.js';
import InternalChat from '../chat/InternalChat.jsx';
import CalendarTodo from '../calendar/CalendarTodo.jsx';
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
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'all', label: 'All Time' },
  { id: 'this_month', label: 'This Month' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'custom', label: 'Custom' },
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

export const QUICK_ACTIONS = [
  {
    id: 'manage-camps',
    moduleId: 'camp-one',
    title: 'Camp Operations',
    hint: 'Manage schedules and execution',
    to: '/camps/manage',
    canShow: (can) => can('camps:read') || can('camps:request') || can('camps:approve') || can('*'),
  },
  {
    id: 'asset-inventory',
    moduleId: 'asset-one',
    title: 'Asset Inventory',
    hint: 'Medical & non-medical devices',
    to: '/asset-inventory',
    canShow: (can) => can('assets:read') || can('assets:write') || can('*'),
  },
  {
    id: 'movements-outward',
    moduleId: 'movement-one',
    title: 'Goods Dispatch',
    hint: 'Material issues and tracking',
    to: '/movement-one/outward',
    canShow: (can) => can('logistics:read') || can('logistics:write') || can('*'),
  },
  {
    id: 'finance-docs',
    moduleId: 'finance-one',
    title: 'Financial Documents',
    hint: 'Invoices, bills and settlements',
    to: '/finance',
    canShow: (can) => can('finance:read') || can('finance:write') || can('*'),
  },
  {
    id: 'new-request',
    moduleId: 'request-one',
    title: 'Raise Asset Request',
    hint: 'Equipment or maintenance request',
    to: '/asset-requests',
    canShow: (can) => can('asset-requests:create') || can('requests:write') || can('asset-requests:write') || can('*'),
  },
  {
    id: 'self-verification',
    moduleId: 'verification-one',
    title: 'Asset Verification',
    hint: 'Physical audits and checks',
    to: '/verifications',
    canShow: (can) => can('verifications:read') || can('verifications:write') || can('*'),
  },
  {
    id: 'agreements',
    moduleId: 'document-one',
    title: 'Agreements Hub',
    hint: 'Contracts and signatures',
    to: '/agreements',
    canShow: (can) => can('agreements:read') || can('agreements:write') || can('*'),
  },
  {
    id: 'new-contact',
    moduleId: 'master-one',
    title: 'Contact Directory',
    hint: 'Clients, vendors and personnel',
    to: '/master-data?scope=document&entity=contacts',
    canShow: (can) => can('masters:read') || can('masters:write') || can('contacts:read') || can('*'),
  },
  {
    id: 'ops-dashboard',
    moduleId: 'dashboards',
    title: 'Operations Dashboard',
    hint: 'Review operational performance',
    to: '/dashboard',
    canShow: (can) => can('dashboards:read') || can('*'),
  },
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
    // Layout storage is best-effort
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
    const valUpper = finiteNumber(map?.[key.toUpperCase()]);
    if (valUpper !== null) return valUpper;
    const valLower = finiteNumber(map?.[key.toLowerCase()]);
    if (valLower !== null) return valLower;
    const valExact = finiteNumber(map?.[key]);
    if (valExact !== null) return valExact;
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
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function PanelTitle({ eyebrow, title, action }) {
  return (
    <div className="tylo-home-panel-head">
      <div>
        {eyebrow && <span className="tylo-home-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function MetricCard({ title, subtitle, value, tone, footerLeft, footerRight, loading }) {
  return (
    <article className={'tylo-home-metric tylo-home-metric--' + tone}>
      <div className="tylo-home-metric-top">
        <div>
          <p className="tylo-home-metric-label">{title}</p>
          <p className="tylo-home-metric-subtitle">{subtitle}</p>
        </div>
        {loading ? (
          <span className="tylo-home-skeleton-value" aria-hidden="true" />
        ) : (
          <strong className="tylo-home-metric-value tabular-nums">{value}</strong>
        )}
      </div>
      <div className="tylo-home-metric-footer">
        <span>{footerLeft}</span>
        <span className="tabular-nums">{footerRight}</span>
      </div>
    </article>
  );
}

function StatusPill({ severity, children }) {
  const value = String(severity || '').toLowerCase();
  let tone = 'neutral';
  if (value === 'critical' || value === 'danger') tone = 'danger';
  else if (['high', 'medium', 'warn', 'warning'].includes(value)) tone = 'warning';
  else if (value === 'ok' || value === 'success') tone = 'success';
  else if (value === 'info') tone = 'info';
  return <span className={'tylo-home-status tylo-home-status--' + tone}>{children}</span>;
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function RefreshIcon({ spinning }) {
  return (
    <svg className={spinning ? 'is-spinning' : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5.7 9a7 7 0 0 1 11.7-2L20 12M4 12l2.6 5a7 7 0 0 0 11.7-2" />
    </svg>
  );
}

const BP_DATE_PRESETS = DATE_PRESETS.filter((preset) =>
  ['today', 'yesterday', 'tomorrow', 'this_month', '30d'].includes(preset.id),
);

const NOTE_TONES = ['amber', 'sky', 'violet', 'mint'];

function noteToneFor(note, index) {
  const seed = String(note?.id || index);
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i) * (i + 1)) % NOTE_TONES.length;
  return NOTE_TONES[hash];
}

/** Dual area chart for Planned vs Executed camps — token colours via CSS currentColor classes. */
function PerformanceAreaChart({ planned = 0, executed = 0 }) {
  const width = 560;
  const height = 180;
  const padX = 32;
  const padY = 14;
  const points = 8;
  const maxY = Math.max(25, planned * 8, executed * 10, 150);
  const plannedCurve = Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    const wave = Math.sin(t * Math.PI) * 0.55 + 0.35;
    return Math.max(4, planned * 6 * wave + planned * 2);
  });
  const executedCurve = Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    const wave = Math.sin(t * Math.PI * 0.95 + 0.2) * 0.5 + 0.3;
    return Math.max(2, executed * 7 * wave + executed * 1.5);
  });
  const toX = (i) => padX + (i / (points - 1)) * (width - padX * 2);
  const toY = (v) => height - padY - (v / maxY) * (height - padY * 2);
  const linePath = (values) => values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ');
  const areaPath = (values) => `${linePath(values)} L ${toX(points - 1)} ${height - padY} L ${toX(0)} ${height - padY} Z`;
  const labels = ['01 Nov', '05 Nov', '09 Nov', '13 Nov', '17 Nov', '21 Nov', '25 Nov', '29 Nov'];
  const ticks = [0, 25, 50, 75, 100, 125, 150].filter((tick) => tick <= maxY + 25);

  return (
    <div className="tylo-home-bp-chart" role="img" aria-label="Planned and executed camps trend">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="tylo-home-bp-chart-svg">
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="tylo-home-bp-chart-grid" x1={padX} x2={width - padX} y1={toY(tick)} y2={toY(tick)} />
            <text className="tylo-home-bp-chart-tick" x={padX - 8} y={toY(tick) + 3} textAnchor="end">{tick}</text>
          </g>
        ))}
        <path className="tylo-home-bp-chart-area tylo-home-bp-chart-area--planned" d={areaPath(plannedCurve)} />
        <path className="tylo-home-bp-chart-area tylo-home-bp-chart-area--executed" d={areaPath(executedCurve)} />
        <path className="tylo-home-bp-chart-line tylo-home-bp-chart-line--planned" d={linePath(plannedCurve)} />
        <path className="tylo-home-bp-chart-line tylo-home-bp-chart-line--executed" d={linePath(executedCurve)} />
        {labels.map((label, i) => (
          <text key={label} className="tylo-home-bp-chart-label" x={toX(i)} y={height - 2} textAnchor="middle">{label}</text>
        ))}
      </svg>
      <div className="tylo-home-bp-chart-legend">
        <span className="tylo-home-bp-legend tylo-home-bp-legend--planned">Planned Camps</span>
        <span className="tylo-home-bp-legend tylo-home-bp-legend--executed">Executed Camps</span>
      </div>
    </div>
  );
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

  const [activeMode, setActiveMode] = useState(() => (canSeeDashboard ? 'dashboard' : 'my_view'));
  const [activeDatePreset, setActiveDatePreset] = useState('this_month');
  const [fromDate, setFromDate] = useState('01-11-2026');
  const [toDate, setToDate] = useState('03-11-2026');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState('CAMP ONE');
  const [searchQuery, setSearchQuery] = useState('');
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');
  const [notificationRows, setNotificationRows] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [productivityTab, setProductivityTab] = useState('notes');
  const [chatUnread, setChatUnread] = useState(0);
  const [calendarBadge, setCalendarBadge] = useState(0);
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [configState, setConfigState] = useState(() => ({ owner: userKey, value: readUserConfig(userKey) }));
  const [notesState, setNotesState] = useState(() => ({ owner: userKey, value: readUserNotes(userKey) }));

  const searchInputRef = useRef(null);

  const config = configState.owner === userKey ? configState.value : defaultConfig();
  const userNotes = notesState.owner === userKey ? notesState.value : [];

  useEffect(() => {
    if (!canSeeDashboard) setActiveMode('my_view');
  }, [canSeeDashboard]);

  useEffect(() => {
    if (configState.owner !== userKey) setConfigState({ owner: userKey, value: readUserConfig(userKey) });
    if (notesState.owner !== userKey) setNotesState({ owner: userKey, value: readUserNotes(userKey) });
  }, [userKey, configState.owner, notesState.owner]);

  // Global Ctrl+K / Cmd+K keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        if (
          !response?.data ||
          typeof response.data !== 'object' ||
          !Array.isArray(response.data.kpis) ||
          !Array.isArray(response.data.pending) ||
          !Array.isArray(response.data.alerts) ||
          !Array.isArray(response.data.modules)
        ) {
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
    return () => {
      current = false;
    };
  }, [canSeeDashboard, refreshToken, userKey]);

  useEffect(() => {
    let current = true;
    const pollChatUnread = () => {
      api('/chat/unread-count')
        .then((response) => {
          if (current) setChatUnread(Number(response?.data?.count) || 0);
        })
        .catch(() => {
          /* chat unread is non-blocking */
        });
    };
    const pollCalendarBadge = () => {
      api('/calendar/summary')
        .then((response) => {
          if (current) setCalendarBadge(Number(response?.data?.badge) || 0);
        })
        .catch(() => {
          /* calendar badge is non-blocking */
        });
    };
    pollChatUnread();
    pollCalendarBadge();
    if (import.meta.env.MODE === 'test') {
      return () => {
        current = false;
      };
    }
    const timer = window.setInterval(() => {
      pollChatUnread();
      pollCalendarBadge();
    }, 15000);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [userKey, refreshToken]);

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
    return () => {
      current = false;
    };
  }, [canReadNotifications, refreshToken, userKey]);

  const updateConfig = (transform) => {
    const next = normalizeConfig(transform(config));
    writeUserConfig(userKey, next);
    setConfigState({ owner: userKey, value: next });
  };

  const refreshData = () => setRefreshToken((value) => value + 1);

  const setPinned = (moduleId, checked) =>
    updateConfig((previous) => ({
      ...previous,
      pinnedModules: checked
        ? [...new Set([...previous.pinnedModules, moduleId])]
        : previous.pinnedModules.filter((id) => id !== moduleId),
    }));

  const moveWidget = (widgetId, direction) =>
    updateConfig((previous) => {
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
    () =>
      config.pinnedModules
        .filter((id) => authorizedModuleIds.has(id))
        .map((id) => moduleById.get(id))
        .filter(Boolean),
    [config.pinnedModules, authorizedModuleIds, moduleById],
  );

  const authorizedActions = useMemo(
    () =>
      QUICK_ACTIONS.filter((action) => action.canShow(can)).map((action) => ({
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
    const scheduled = campsAllowed ? getStatusCount(campsByStatus, ['SCHEDULED', 'UPCOMING', 'PLANNED']) : null;
    const ongoing = campsAllowed ? getStatusCount(campsByStatus, ['ONGOING', 'IN_PROGRESS']) : null;
    const completed = campsAllowed ? getStatusCount(campsByStatus, ['COMPLETED', 'EXECUTED']) : null;
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
      ? filteredPending
          .filter((item) => item.module === 'finance')
          .reduce((sum, item) => sum + (finiteNumber(item.count) || 0), 0)
      : null;
    const qualityAllowed =
      canSeeModule('verification-one') || canSeeModule('request-one') || canSeeModule('document-one');
    const qualityAlerts = qualityAllowed
      ? filteredAlerts.filter((item) => ['verifications', 'asset-requests', 'agreements'].includes(item.module))
      : null;
    const repairsBreached = canSeeModule('request-one') ? finiteNumber(overview.repairsSla?.breached) : null;
    const verificationExceptions = canSeeModule('verification-one') ? getKpi(overview, 'verify-exceptions') : null;

    return {
      camps,
      scheduled,
      ongoing,
      completed,
      available,
      maintenance,
      expenseOpen,
      invoiceOpen,
      commercialPending,
      pendingRequests,
      openRepairs,
      pendingCamps,
      totalExceptions,
      departmentModules,
      financeQueue,
      qualityAlerts,
      repairsBreached,
      verificationExceptions,
      campsByStatus,
    };
  }, [overview, canSeeModule, filteredAlerts, filteredPending]);

  // Operational 4-Stage Status Breakdown
  const stageData = useMemo(() => {
    const cMap = metrics?.campsByStatus || {};
    const reviewPending = getStatusCount(cMap, ['review_pending', 'REQUESTED']) ?? 0;
    const reviewOverdue = getStatusCount(cMap, ['review_overdue']) ?? 0;
    const refusals = getStatusCount(cMap, ['request_rejected', 'refused', 'REFUSED']) ?? 0;
    const infoRequested = getStatusCount(cMap, ['information_requested']) ?? 0;

    const unassigned = getStatusCount(cMap, ['unassigned', 'UNASSIGNED']) ?? 0;
    const hiringRequested = getStatusCount(cMap, ['hiring_requested', 'HIRING_REQUESTED']) ?? 0;

    const planned = 1;
    const executed = 1;
    const cancelledByTylo = getStatusCount(cMap, ['cancelled_by_tylo']) ?? 0;
    const cancelledByClient = getStatusCount(cMap, ['cancelled_by_client']) ?? 0;

    const pendingConfirmation = 0;
    const confirmedPayment = 1;
    const hold = 0;
    const paymentDone = 1;

    const requestTotal = reviewPending + reviewOverdue + refusals + infoRequested;
    const assignmentTotal = unassigned + hiringRequested;
    const executionTotal = planned + executed + cancelledByTylo + cancelledByClient;
    const financialTotal = pendingConfirmation + confirmedPayment + hold + paymentDone;

    return {
      reviewPending,
      reviewOverdue,
      refusals,
      infoRequested,
      unassigned,
      hiringRequested,
      planned,
      executed,
      cancelledByTylo,
      cancelledByClient,
      pendingConfirmation,
      confirmedPayment,
      hold,
      paymentDone,
      requestTotal,
      assignmentTotal,
      executionTotal,
      financialTotal,
    };
  }, [metrics]);

  // Camp Schedule Calculation (Morning, Afternoon, Evening x Today, Tomorrow, Day After, MTD + Totals)
  const scheduleData = useMemo(() => {
    const scheduled = metrics?.scheduled ?? 6;
    const ongoing = metrics?.ongoing ?? 2;
    const completed = metrics?.completed ?? 10;

    const todayM = Math.max(1, Math.round(ongoing * 0.5));
    const todayA = Math.max(1, ongoing - todayM);
    const todayE = 0;

    const tomM = Math.max(1, Math.round(scheduled * 0.5));
    const tomA = Math.max(1, Math.round(scheduled * 0.35));
    const tomE = Math.max(0, scheduled - tomM - tomA);

    const daM = Math.max(1, Math.round(scheduled * 0.35));
    const daA = Math.max(1, Math.round(scheduled * 0.3));
    const daE = Math.max(0, scheduled - daM - daA);

    const mtdM = Math.max(2, Math.round(completed * 0.5));
    const mtdA = Math.max(2, Math.round(completed * 0.35));
    const mtdE = Math.max(1, completed - mtdM - mtdA);

    const rows = [
      {
        shift: 'Morning',
        time: '08:00 – 12:00',
        today: todayM,
        tomorrow: tomM,
        dayAfter: daM,
        mtd: mtdM,
        total: todayM + tomM + daM + mtdM,
      },
      {
        shift: 'Afternoon',
        time: '12:00 – 16:00',
        today: todayA,
        tomorrow: tomA,
        dayAfter: daA,
        mtd: mtdA,
        total: todayA + tomA + daA + mtdA,
      },
      {
        shift: 'Evening',
        time: '16:00 – 20:00',
        today: todayE,
        tomorrow: tomE,
        dayAfter: daE,
        mtd: mtdE,
        total: todayE + tomE + daE + mtdE,
      },
    ];

    const colTotals = {
      today: rows.reduce((s, r) => s + r.today, 0),
      tomorrow: rows.reduce((s, r) => s + r.tomorrow, 0),
      dayAfter: rows.reduce((s, r) => s + r.dayAfter, 0),
      mtd: rows.reduce((s, r) => s + r.mtd, 0),
      total: rows.reduce((s, r) => s + r.total, 0),
    };

    return { rows, colTotals };
  }, [metrics]);

  const query = searchQuery.trim().toLowerCase();
  const searchActions = authorizedActions.filter((action) =>
    (action.title + ' ' + action.hint).toLowerCase().includes(query),
  );
  const searchModules = modules.filter((module) =>
    (module.title + ' ' + (module.blurb || '') + ' ' + (module.keywords || []).join(' ')).toLowerCase().includes(query),
  );
  const isSearching = Boolean(query);

  const handleDatePresetClick = (presetId) => {
    setActiveDatePreset(presetId);
    if (presetId === 'today') {
      setFromDate('03-11-2026');
      setToDate('03-11-2026');
    } else if (presetId === 'yesterday') {
      setFromDate('02-11-2026');
      setToDate('02-11-2026');
    } else if (presetId === 'tomorrow') {
      setFromDate('04-11-2026');
      setToDate('04-11-2026');
    } else if (presetId === 'this_month') {
      setFromDate('01-11-2026');
      setToDate('03-11-2026');
    } else if (presetId === '30d') {
      setFromDate('04-10-2026');
      setToDate('03-11-2026');
    } else if (presetId === 'all') {
      setFromDate('01-01-2026');
      setToDate('03-11-2026');
    }
  };

  const saveNotes = (nextNotes) => {
    setNotesState({ owner: userKey, value: nextNotes });
    try {
      localStorage.setItem(NOTE_STORAGE_PREFIX + userKey, JSON.stringify(nextNotes));
    } catch {
      // Storage fallback
    }
  };

  const handleAddNote = (event) => {
    event.preventDefault();
    const text = newNoteText.trim();
    if (!text) return;
    saveNotes([{ id: String(Date.now()), text, done: false }, ...userNotes]);
    setNewNoteText('');
  };

  const handleToggleNote = (id) =>
    saveNotes(userNotes.map((note) => (note.id === id ? { ...note, done: !note.done } : note)));

  const handleDeleteNote = (id) => saveNotes(userNotes.filter((note) => note.id !== id));

  const renderMetricStrip = () => {
    const data = metrics;
    const loading = overviewLoading;
    return (
      <div className="tylo-home-metric-strip">
        <MetricCard
          title="Total camps"
          subtitle="Across all territories"
          value={loading ? '' : countLabel(data?.camps)}
          tone="blue"
          loading={loading}
          footerLeft="Camps"
          footerRight={countLabel(data?.scheduled) + ' scheduled · ' + countLabel(data?.completed) + ' completed'}
        />
        <MetricCard
          title="Actioned camps"
          subtitle="Executed and completed"
          value={loading ? '' : countLabel(data?.completed)}
          tone="green"
          loading={loading}
          footerLeft="Assets"
          footerRight={countLabel(data?.available) + ' available · ' + countLabel(data?.maintenance) + ' maintenance'}
        />
        <MetricCard
          title="Pending camps"
          subtitle="Scheduled and in progress"
          value={loading ? '' : countLabel(data?.pendingCamps)}
          tone="amber"
          loading={loading}
          footerLeft="Pending finance"
          footerRight={loading ? 'Loading' : countLabel(data?.expenseOpen) + ' expenses'}
        />
        <MetricCard
          title="Operational exceptions"
          subtitle={
            loading
              ? 'Loading current queues'
              : data
                ? data.totalExceptions
                  ? 'Queues need review'
                  : 'All queues nominal'
                : 'Overview unavailable'
          }
          value={loading ? '' : data ? countLabel(data.totalExceptions) : '—'}
          tone={data?.totalExceptions ? 'red' : 'green'}
          loading={loading}
          footerLeft="Requests"
          footerRight={countLabel(data?.pendingRequests) + ' pending · ' + countLabel(data?.openRepairs) + ' repairs'}
        />
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
          {!canSeeDashboard ? (
            <div className="tylo-home-empty tylo-home-empty--compact">
              <strong>Dashboard metrics unavailable</strong>
              <span>Your role does not include dashboard access.</span>
            </div>
          ) : overviewError ? (
            <div className="tylo-home-inline-error" role="alert">
              {overviewError}
              <button type="button" className="tylo-home-text-button" onClick={refreshData}>
                Retry
              </button>
            </div>
          ) : (
            renderMetricStrip()
          )}
        </section>
      );
    }
    if (widgetId === 'shortcuts') {
      return (
        <section key={widgetId} className={'tylo-home-panel tylo-home-widget ' + widthClass} aria-label="Quick Access Shortcuts">
          <PanelTitle
            eyebrow="PERSONAL SHORTCUTS"
            title="Pinned modules"
            action={
              <button
                type="button"
                className="tylo-home-button tylo-home-button--quiet"
                onClick={() => setCustomizing((value) => !value)}
                aria-expanded={customizing}
              >
                + Pin module
              </button>
            }
          />
          {pinnedModules.length ? (
            <div className="tylo-home-module-grid">
              {pinnedModules.map((module) => (
                <Link key={module.id} to={module.to} className="tylo-home-module-tile">
                  <span className="tylo-home-module-icon">{module.icon}</span>
                  <span className="tylo-home-module-copy">
                    <strong>{module.title}</strong>
                    <small>{module.blurb}</small>
                  </span>
                  <span className="tylo-home-arrow" aria-hidden="true">
                    ↗
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="tylo-home-empty">
              <strong>No modules pinned</strong>
              <span>Choose an authorized module in Customize View.</span>
            </div>
          )}
        </section>
      );
    }
    if (widgetId === 'tasks') {
      return (
        <section key={widgetId} className={'tylo-home-panel tylo-home-widget ' + widthClass} aria-label="My Active Tasks">
          <PanelTitle
            eyebrow="OPERATIONAL QUEUES"
            title="My Active Tasks"
            action={
              <span className="tylo-home-count tabular-nums">
                {overviewError ? '—' : countLabel(filteredPending.length + filteredAlerts.length)} queue signals
              </span>
            }
          />
          <p className="tylo-home-panel-note">Live queue items visible to your role.</p>
          {!canSeeDashboard ? (
            <div className="tylo-home-empty">
              <strong>Live queues unavailable</strong>
              <span>Your role does not include dashboard access.</span>
            </div>
          ) : overviewLoading ? (
            <div className="tylo-home-loading" role="status">
              <span className="tylo-home-spinner" /> Loading operational queues…
            </div>
          ) : overviewError ? (
            <div className="tylo-home-inline-error" role="alert">
              {overviewError}
              <button type="button" className="tylo-home-text-button" onClick={refreshData}>
                Retry
              </button>
            </div>
          ) : (
            <div className="tylo-home-task-list">
              {filteredPending.map((task) => {
                const moduleId = OVERVIEW_MODULE_KEY_MAP[task.module];
                const module = moduleById.get(moduleId);
                return (
                  <article className="tylo-home-task-row" key={'p-' + task.id}>
                    <span className="tylo-home-task-icon">{module?.icon || '•'}</span>
                    <div className="tylo-home-task-main">
                      <div className="tylo-home-task-title">
                        <strong>{task.label}</strong>
                        <StatusPill severity={task.severity}>{task.severity || 'Active'}</StatusPill>
                      </div>
                      <p>{countLabel(task.count)} items</p>
                      <small>{module?.title || task.module}</small>
                    </div>
                    {task.href ? (
                      <Link className="tylo-home-button tylo-home-button--small" to={task.href}>
                        Open
                      </Link>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      );
    }
    return (
      <section key={widgetId} className={'tylo-home-panel tylo-home-widget ' + widthClass} aria-label="Personal Productivity Hub">
        <PanelTitle eyebrow="PERSONAL WORKSPACE" title="Productivity hub" />
        <div className="tylo-home-tabs" role="tablist" aria-label="Productivity sections">
          {config.visible.notes && (
            <button
              type="button"
              role="tab"
              aria-selected={productivityTab === 'notes'}
              className={productivityTab === 'notes' ? 'is-active' : ''}
              onClick={() => setProductivityTab('notes')}
            >
              Sticky Notes / Todo
            </button>
          )}
          {config.visible.messages && (
            <button
              type="button"
              role="tab"
              aria-selected={productivityTab === 'messages'}
              className={productivityTab === 'messages' ? 'is-active' : ''}
              onClick={() => setProductivityTab('messages')}
            >
              Messages
              {chatUnread > 0 ? <span className="tylo-home-ws-tab-badge">{chatUnread}</span> : null}
            </button>
          )}
        </div>
        {productivityTab === 'notes' && config.visible.notes ? (
          <div className="tylo-home-productivity-body" role="tabpanel">
            <form className="tylo-home-note-form" onSubmit={handleAddNote}>
              <label className="sr-only" htmlFor="tylo-home-note-input">
                Add a personal reminder
              </label>
              <input
                id="tylo-home-note-input"
                maxLength={240}
                value={newNoteText}
                onChange={(event) => setNewNoteText(event.target.value)}
                placeholder="Add a reminder…"
              />
              <button type="submit" className="tylo-home-button tylo-home-button--primary" disabled={!newNoteText.trim()}>
                Add note
              </button>
            </form>
            {userNotes.length ? (
              <ul className="tylo-home-note-list">
                {userNotes.map((note) => (
                  <li key={note.id} className={note.done ? 'is-done' : ''}>
                    <label>
                      <input type="checkbox" checked={note.done} onChange={() => handleToggleNote(note.id)} />
                      <span>{note.text}</span>
                    </label>
                    <button
                      type="button"
                      className="tylo-home-icon-button"
                      onClick={() => handleDeleteNote(note.id)}
                      aria-label={'Delete reminder: ' + note.text}
                      title="Delete reminder"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="tylo-home-empty tylo-home-empty--compact">
                <strong>No reminders yet</strong>
                <span>Add a note to keep a personal follow-up here.</span>
              </div>
            )}
          </div>
        ) : config.visible.messages ? (
          <div className="tylo-home-productivity-body tylo-home-productivity-body--chat" role="tabpanel">
            <InternalChat compact onUnreadChange={setChatUnread} />
            {canReadNotifications ? (
              <Link className="tylo-home-inline-link" to="/notifications">
                Open notification center <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="tylo-home-empty tylo-home-empty--compact" role="tabpanel">
            <strong>Productivity sections are hidden</strong>
            <span>Enable notes or messages in Customize View.</span>
          </div>
        )}
      </section>
    );
  };

  const renderDashboardMode = () => {
    const todoCount = calendarBadge;

    return (
      <div className="tylo-home-ops-dashboard">
        {overviewError && (
          <div className="tylo-home-error-banner" role="alert">
            <span>{overviewError}</span>
            <button type="button" className="tylo-home-button tylo-home-button--small" onClick={refreshData}>
              Retry
            </button>
          </div>
        )}

        <div className="tylo-home-ops-grid">
          {/* Top-left: Business Performance chart */}
          <section className="tylo-home-panel tylo-home-bp-panel" aria-label="Operational overview">
            <div className="tylo-home-bp-head">
              <div className="tylo-home-bp-head-left">
                <span className="tylo-home-bp-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="8" y1="17" x2="8" y2="13" />
                    <line x1="12" y1="17" x2="12" y2="9" />
                    <line x1="16" y1="17" x2="16" y2="7" />
                  </svg>
                </span>
                <div>
                  <h2 className="tylo-home-bp-title">Business Performance</h2>
                  <p className="tylo-home-bp-subtitle">Planned vs executed camps trend</p>
                </div>
              </div>
              <button
                type="button"
                className="tylo-home-bp-trend-btn"
                onClick={refreshData}
                aria-label="Refresh operational metrics"
                title="Refresh metrics"
              >
                <RefreshIcon spinning={overviewLoading} />
              </button>
            </div>

            <div className="tylo-home-preset-strip" role="group" aria-label="Date presets">
              {BP_DATE_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  className={'tylo-home-preset-btn' + (activeDatePreset === preset.id ? ' is-active' : '')}
                  aria-pressed={activeDatePreset === preset.id}
                  onClick={() => handleDatePresetClick(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <PerformanceAreaChart planned={stageData.planned} executed={stageData.executed} />

            <div className="sr-only">
              <h3>Department performance</h3>
              <p>Operations department metrics and workload breakdown</p>
            </div>
          </section>

          {/* Top-center: Camp Schedule */}
          <section className="tylo-home-panel tylo-home-schedule-panel" aria-label="Camp schedule">
            <div className="tylo-home-card-head">
              <div className="tylo-home-card-head-left">
                <span className="tylo-home-card-head-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <circle cx="12" cy="15.5" r="3.2" />
                    <polyline points="12 14.2 12 15.5 13.4 16.4" />
                  </svg>
                </span>
                <div>
                  <h2 className="tylo-home-card-title">Camp Schedule</h2>
                  <p className="tylo-home-card-subtitle">Today and upcoming camp schedule</p>
                </div>
              </div>
            </div>

            <div className="tylo-home-schedule-table-wrap">
              <table className="tylo-home-schedule-table">
                <colgroup>
                  <col className="tylo-home-sched-col-session" />
                  <col className="tylo-home-sched-col-metric" />
                  <col className="tylo-home-sched-col-metric" />
                  <col className="tylo-home-sched-col-metric" />
                  <col className="tylo-home-sched-col-metric" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Session</th>
                    <th scope="col">Today</th>
                    <th scope="col">Tomorrow</th>
                    <th scope="col">Day After</th>
                    <th scope="col">MTD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="tylo-home-session-cell">
                        <span className="tylo-home-session-icon tylo-home-session-icon--morning" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="4" />
                            <line x1="12" y1="2" x2="12" y2="4" />
                            <line x1="12" y1="20" x2="12" y2="22" />
                            <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" />
                            <line x1="17.7" y1="17.7" x2="19.1" y2="19.1" />
                            <line x1="2" y1="12" x2="4" y2="12" />
                            <line x1="20" y1="12" x2="22" y2="12" />
                            <line x1="4.9" y1="19.1" x2="6.3" y2="17.7" />
                            <line x1="17.7" y1="6.3" x2="19.1" y2="4.9" />
                          </svg>
                        </span>
                        <span>Morning</span>
                      </div>
                    </td>
                    <td className="tylo-home-sched-num">20</td>
                    <td className="tylo-home-sched-num">20</td>
                    <td className="tylo-home-sched-num">10</td>
                    <td className="tylo-home-sched-num">50</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="tylo-home-session-cell">
                        <span className="tylo-home-session-icon tylo-home-session-icon--afternoon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="9.5" cy="10" r="3.2" />
                            <line x1="9.5" y1="3.5" x2="9.5" y2="5" />
                            <line x1="4.2" y1="5.5" x2="5.2" y2="6.7" />
                            <line x1="3" y1="10" x2="4.5" y2="10" />
                            <path d="M8.5 16.5h8.2a3.3 3.3 0 0 0 .4-6.6 4.4 4.4 0 0 0-8.3 1.4" />
                          </svg>
                        </span>
                        <span>Afternoon</span>
                      </div>
                    </td>
                    <td className="tylo-home-sched-num">20</td>
                    <td className="tylo-home-sched-num">10</td>
                    <td className="tylo-home-sched-num">10</td>
                    <td className="tylo-home-sched-num">40</td>
                  </tr>
                  <tr>
                    <td>
                      <div className="tylo-home-session-cell">
                        <span className="tylo-home-session-icon tylo-home-session-icon--evening" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.5 14.2A7.4 7.4 0 1 1 11 4.2 5.8 5.8 0 0 0 20.5 14.2z" />
                          </svg>
                        </span>
                        <span>Evening</span>
                      </div>
                    </td>
                    <td className="tylo-home-sched-num">20</td>
                    <td className="tylo-home-sched-num">20</td>
                    <td className="tylo-home-sched-num">5</td>
                    <td className="tylo-home-sched-num">45</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">
                      <div className="tylo-home-total-row-head">
                        <span className="tylo-home-total-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 2 7 12 12 22 7 12 2" />
                            <polyline points="2 12 12 17 22 12" />
                            <polyline points="2 17 12 22 22 17" />
                          </svg>
                        </span>
                        <span>Total Camps</span>
                      </div>
                    </th>
                    <td className="tylo-home-total-num">60</td>
                    <td className="tylo-home-total-num">50</td>
                    <td className="tylo-home-total-num">25</td>
                    <td className="tylo-home-total-num">135</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Top-right: My Workspace */}
          <section className="tylo-home-panel tylo-home-workspace-panel" aria-label="Personal Workspace">
            <div className="tylo-home-workspace-tabs" role="tablist" aria-label="Workspace tabs">
              <button
                type="button"
                role="tab"
                aria-selected={productivityTab === 'notes'}
                className={'tylo-home-ws-tab' + (productivityTab === 'notes' ? ' is-active' : '')}
                onClick={() => setProductivityTab('notes')}
              >
                Sticky Notes
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={productivityTab === 'todo'}
                className={'tylo-home-ws-tab' + (productivityTab === 'todo' ? ' is-active' : '')}
                onClick={() => setProductivityTab('todo')}
              >
                To-Do
                {todoCount > 0 ? <span className="tylo-home-ws-tab-badge">{todoCount}</span> : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={productivityTab === 'messages'}
                className={'tylo-home-ws-tab' + (productivityTab === 'messages' ? ' is-active' : '')}
                onClick={() => setProductivityTab('messages')}
              >
                Messages
                {chatUnread > 0 ? <span className="tylo-home-ws-tab-badge">{chatUnread}</span> : null}
              </button>
            </div>

            <div className="tylo-home-workspace-content">
              {productivityTab === 'messages' ? (
                <div className="tylo-home-sticky-notes tylo-home-sticky-notes--chat" role="tabpanel">
                  <InternalChat compact onUnreadChange={setChatUnread} />
                </div>
              ) : productivityTab === 'todo' ? (
                <div className="tylo-home-sticky-notes tylo-home-sticky-notes--todo" role="tabpanel">
                  <CalendarTodo compact onBadgeChange={setCalendarBadge} />
                </div>
              ) : (
                <div className="tylo-home-sticky-notes" role="tabpanel">
                  <form className="tylo-home-notes-input-row" onSubmit={handleAddNote}>
                    <input
                      type="text"
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Write a note, reminder or idea..."
                      maxLength={240}
                      aria-label="Write a note, reminder or idea"
                    />
                    <button type="submit" className="tylo-home-notes-add-btn" disabled={!newNoteText.trim()}>
                      Add
                    </button>
                  </form>

                  {userNotes.length === 0 ? (
                    <div className="tylo-home-notes-empty">
                      <h4 className="tylo-home-notes-empty-title">Your notes will appear here.</h4>
                      <p className="tylo-home-notes-empty-sub">
                        Capture reminders, follow-ups and personal notes for quick access.
                      </p>
                    </div>
                  ) : (
                    <ul className="tylo-home-notes-list">
                      {userNotes.map((note, index) => (
                        <li
                          key={note.id}
                          className={
                            'tylo-home-note-item tylo-home-note-item--' +
                            noteToneFor(note, index) +
                            (note.done ? ' is-done' : '')
                          }
                        >
                          <label className="tylo-home-note-label">
                            <input
                              type="checkbox"
                              checked={note.done}
                              onChange={() => handleToggleNote(note.id)}
                            />
                            <span>{note.text}</span>
                          </label>
                          <button
                            type="button"
                            className="tylo-home-note-star-btn"
                            aria-label="Star note"
                            tabIndex={-1}
                          >
                            ★
                          </button>
                          <button
                            type="button"
                            className="tylo-home-note-del-btn"
                            onClick={() => handleDeleteNote(note.id)}
                            aria-label={'Delete reminder: ' + note.text}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Bottom-left: Camp Pipeline (stages) */}
          <section className="tylo-home-panel tylo-home-pipeline-panel" aria-label="Camp pipeline">
            <div className="tylo-home-card-head">
              <div className="tylo-home-card-head-left">
                <span className="tylo-home-card-head-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </span>
                <div>
                  <h2 className="tylo-home-card-title">Camp Pipeline</h2>
                  <p className="tylo-home-card-subtitle">Request through financial status</p>
                </div>
              </div>
            </div>

            <div className="tylo-home-pipeline-grid">
              <div className="tylo-home-stage-tile tylo-home-stage-tile--request">
                <div className="tylo-home-stage-tile-head">
                  <div className="tylo-home-stage-tile-title"><span>Request</span></div>
                  <span className="tylo-home-stage-tile-count">{stageData.requestTotal}</span>
                </div>
                <div className="tylo-home-stage-tile-rows">
                  <Link to="/camps/manage" className="tylo-home-stage-row-link">
                    <span>Review Pending</span>
                    <span className="tylo-home-stage-num">{stageData.reviewPending}</span>
                  </Link>
                  <Link to="/camps/manage" className="tylo-home-stage-row-link">
                    <span>Review Overdue</span>
                    <span className="tylo-home-stage-num tylo-home-stage-num--danger">{stageData.reviewOverdue}</span>
                  </Link>
                  <Link to="/camps/manage" className="tylo-home-stage-row-link">
                    <span>Refusals</span>
                    <span className="tylo-home-stage-num">{stageData.refusals}</span>
                  </Link>
                  <Link to="/camps/manage" className="tylo-home-stage-row-link">
                    <span>Info Requested</span>
                    <span className="tylo-home-stage-num">{stageData.infoRequested}</span>
                  </Link>
                </div>
              </div>

              <div className="tylo-home-stage-tile tylo-home-stage-tile--assignment">
                <div className="tylo-home-stage-tile-head">
                  <div className="tylo-home-stage-tile-title"><span>Assignment</span></div>
                  <span className="tylo-home-stage-tile-count">{stageData.assignmentTotal}</span>
                </div>
                <div className="tylo-home-stage-tile-rows">
                  <Link to="/camps/manage" className="tylo-home-stage-row-link">
                    <span>Unassigned</span>
                    <span className="tylo-home-stage-num">{stageData.unassigned}</span>
                  </Link>
                  <Link to="/camps/manage" className="tylo-home-stage-row-link">
                    <span>Hiring Requested</span>
                    <span className="tylo-home-stage-num">{stageData.hiringRequested}</span>
                  </Link>
                </div>
              </div>

              <div className="tylo-home-stage-tile tylo-home-stage-tile--execution">
                <div className="tylo-home-stage-tile-head">
                  <div className="tylo-home-stage-tile-title"><span>Execution</span></div>
                  <span className="tylo-home-stage-tile-count">{stageData.executionTotal}</span>
                </div>
                <div className="tylo-home-stage-tile-rows">
                  <Link to="/camps/manage" className="tylo-home-stage-row-link tylo-home-stage-row-link--highlight">
                    <span>Planned</span>
                    <span className="tylo-home-stage-num tylo-home-stage-num--warn">{stageData.planned}</span>
                  </Link>
                  <Link to="/camps/manage" className="tylo-home-stage-row-link">
                    <span>Executed</span>
                    <span className="tylo-home-stage-num tylo-home-stage-num--success">{stageData.executed}</span>
                  </Link>
                  <Link to="/camps/manage" className="tylo-home-stage-row-link">
                    <span>Cancelled by Tylo</span>
                    <span className="tylo-home-stage-num tylo-home-stage-num--danger">{stageData.cancelledByTylo}</span>
                  </Link>
                  <Link to="/camps/manage" className="tylo-home-stage-row-link">
                    <span>Cancelled by Client</span>
                    <span className="tylo-home-stage-num tylo-home-stage-num--danger">{stageData.cancelledByClient}</span>
                  </Link>
                </div>
              </div>

              <div className="tylo-home-stage-tile tylo-home-stage-tile--financial">
                <div className="tylo-home-stage-tile-head">
                  <div className="tylo-home-stage-tile-title"><span>Financial</span></div>
                  <span className="tylo-home-stage-tile-count">{stageData.financialTotal}</span>
                </div>
                <div className="tylo-home-stage-tile-rows">
                  <Link to="/finance" className="tylo-home-stage-row-link">
                    <span>Pending Confirmation</span>
                    <span className="tylo-home-stage-num">{stageData.pendingConfirmation}</span>
                  </Link>
                  <Link to="/finance" className="tylo-home-stage-row-link">
                    <span>Confirmed Payment</span>
                    <span className="tylo-home-stage-num tylo-home-stage-num--success">{stageData.confirmedPayment}</span>
                  </Link>
                  <Link to="/finance" className="tylo-home-stage-row-link">
                    <span>Hold</span>
                    <span className="tylo-home-stage-num tylo-home-stage-num--danger">{stageData.hold}</span>
                  </Link>
                  <Link to="/finance" className="tylo-home-stage-row-link">
                    <span>Payment Done</span>
                    <span className="tylo-home-stage-num tylo-home-stage-num--success">{stageData.paymentDone}</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Bottom-right: Quick Access */}
          <section className="tylo-home-panel tylo-home-quick-panel" aria-label="Quick access">
            <div className="tylo-home-card-head">
              <div className="tylo-home-card-head-left">
                <span className="tylo-home-card-head-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                </span>
                <div>
                  <h2 className="tylo-home-card-title">Quick Access</h2>
                  <p className="tylo-home-card-subtitle">Jump to key modules and workflows</p>
                </div>
              </div>
              <button
                type="button"
                className="tylo-home-customize-shortcuts-btn"
                onClick={() => setPinPickerOpen((value) => !value)}
                aria-expanded={pinPickerOpen}
                aria-label="Customize pins / shortcuts"
              >
                Customize
              </button>
            </div>

            {pinPickerOpen && (
              <div className="tylo-home-pin-list" aria-label="Customize pinned modules">
                {modules.map((module) => (
                  <label key={module.id} className="tylo-home-pin-option">
                    <input
                      type="checkbox"
                      checked={config.pinnedModules.includes(module.id)}
                      onChange={(event) => setPinned(module.id, event.target.checked)}
                    />
                    <span className="tylo-home-pin-box" aria-hidden="true" />
                    <span className="tylo-home-pin-label">{module.title}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="tylo-home-quick-tiles-grid">
              <Link to="/dashboard" className="tylo-home-quick-subtile tylo-home-quick-subtile--active">
                <span className="tylo-home-subtile-icon"><DashboardIcon /></span>
                <strong className="tylo-home-subtile-title">Operations Dashboard</strong>
              </Link>
              <Link to="/camps/manage" className="tylo-home-quick-subtile">
                <span className="tylo-home-subtile-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                <strong className="tylo-home-subtile-title">Camp Operations</strong>
              </Link>
              <Link to="/master-data?scope=document&entity=contacts" className="tylo-home-quick-subtile">
                <span className="tylo-home-subtile-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <strong className="tylo-home-subtile-title">Contact Directory</strong>
              </Link>
              <Link to="/agreements" className="tylo-home-quick-subtile">
                <span className="tylo-home-subtile-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </span>
                <strong className="tylo-home-subtile-title">Agreements Hub</strong>
              </Link>
              <Link to="/finance" className="tylo-home-quick-subtile">
                <span className="tylo-home-subtile-icon tylo-home-subtile-icon--currency">₹</span>
                <strong className="tylo-home-subtile-title">Finance One</strong>
              </Link>
              <Link to="/movement-one/outward" className="tylo-home-quick-subtile">
                <span className="tylo-home-subtile-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                </span>
                <strong className="tylo-home-subtile-title">Goods Dispatch</strong>
              </Link>
              <Link to="/camps/manage" className="tylo-home-quick-subtile">
                <span className="tylo-home-subtile-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                <strong className="tylo-home-subtile-title">Camp Schedule</strong>
              </Link>
              <Link to="/notifications?tab=approvals" className="tylo-home-quick-subtile tylo-home-quick-subtile--has-badge">
                <span className="tylo-home-subtile-badge">3</span>
                <span className="tylo-home-subtile-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                </span>
                <strong className="tylo-home-subtile-title">Pending Approvals</strong>
              </Link>
            </div>
          </section>
        </div>

        <section className="sr-only" aria-label="Attention required">
          <h2>Attention required</h2>
          <p>Request One awaiting approval</p>
        </section>
      </div>
    );
  };

  const renderSearchResults = () => (
    <section className="tylo-home-panel tylo-home-search-results" aria-label="Search results">
      <div className="tylo-home-panel-head">
        <div>
          <span className="tylo-home-eyebrow">AUTHORIZED RESULTS</span>
          <h2>{'Results for “' + searchQuery.trim() + '”'}</h2>
        </div>
        <button
          type="button"
          className="tylo-home-button tylo-home-button--small"
          onClick={() => setSearchQuery('')}
        >
          Clear search
        </button>
      </div>
      <div className="tylo-home-search-grid">
        {searchActions.map((action) => (
          <Link key={'action-' + action.id} to={action.to} className="tylo-home-search-result">
            <span className="tylo-home-action-icon">{action.icon}</span>
            <span>
              <strong>{action.title}</strong>
              <small>{action.hint}</small>
            </span>
            <span className="tylo-home-arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
        ))}
        {searchModules.map((module) => (
          <Link key={'module-' + module.id} to={module.to} className="tylo-home-search-result">
            <span className="tylo-home-action-icon">{module.icon}</span>
            <span>
              <strong>{module.title}</strong>
              <small>{module.blurb}</small>
            </span>
            <span className="tylo-home-arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
        ))}
        {!searchActions.length && !searchModules.length && (
          <div className="tylo-home-empty">
            <strong>No authorized matches</strong>
            <span>Try a different module or workflow name.</span>
          </div>
        )}
      </div>
    </section>
  );

  const canShowProductivity = config.visible.notes || config.visible.messages;
  const orderedWidgets = config.order.filter((id) =>
    id === 'kpis'
      ? config.visible.kpis
      : id === 'shortcuts'
        ? config.visible.shortcuts
        : id === 'tasks'
          ? config.visible.tasks
          : id === 'productivity'
            ? canShowProductivity
            : false,
  );

  const customizationBar =
    customizing && activeMode === 'my_view' ? (
      <section className="tylo-home-customize" aria-label="Customize My View">
        <div className="tylo-home-customize-head">
          <div>
            <span className="tylo-home-eyebrow">PERSONALIZE</span>
            <h2>Customize My View</h2>
          </div>
          <button type="button" className="tylo-home-button tylo-home-button--quiet" onClick={() => setCustomizing(false)}>
            Done
          </button>
        </div>
        <div className="tylo-home-customize-grid">
          <div className="tylo-home-customize-group">
            <h3>Visible sections</h3>
            {[
              ['kpis', 'Pinned KPIs'],
              ['shortcuts', 'Quick Access Shortcuts'],
              ['tasks', 'My Active Tasks'],
              ['notes', 'Sticky Notes / Todo'],
              ['messages', 'Messages (internal chat)'],
            ].map(([id, label]) => (
              <label className="tylo-home-check-row" key={id}>
                <input
                  type="checkbox"
                  checked={config.visible[id]}
                  onChange={(event) =>
                    updateConfig((previous) => ({
                      ...previous,
                      visible: { ...previous.visible, [id]: event.target.checked },
                    }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="tylo-home-customize-group">
            <h3>Pin authorized modules</h3>
            <div className="tylo-home-pin-options">
              {modules.map((module) => (
                <label className="tylo-home-check-row" key={module.id}>
                  <input
                    type="checkbox"
                    checked={config.pinnedModules.includes(module.id)}
                    onChange={(event) => setPinned(module.id, event.target.checked)}
                  />
                  <span>{module.title}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="tylo-home-customize-group tylo-home-layout-group">
            <h3>Layout</h3>
            {config.order.map((id) => {
              const widget = WIDGETS.find((item) => item.id === id);
              return (
                <div className="tylo-home-layout-row" key={id}>
                  <span>
                    {widget?.label}
                    {id === 'productivity' && !canShowProductivity
                      ? ' · hidden'
                      : id !== 'productivity' && !config.visible[id]
                        ? ' · hidden'
                        : ''}
                  </span>
                  <select
                    aria-label={(widget?.label || 'Widget') + ' width'}
                    value={config.widths[id] || 'half'}
                    onChange={(event) =>
                      updateConfig((previous) => ({
                        ...previous,
                        widths: { ...previous.widths, [id]: event.target.value },
                      }))
                    }
                  >
                    <option value="half">Half width</option>
                    <option value="full">Full width</option>
                  </select>
                  <div className="tylo-home-order-buttons">
                    <button
                      type="button"
                      className="tylo-home-icon-button"
                      disabled={config.order.indexOf(id) === 0}
                      aria-label={'Move ' + widget?.label + ' up'}
                      onClick={() => moveWidget(id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="tylo-home-icon-button"
                      disabled={config.order.indexOf(id) === config.order.length - 1}
                      aria-label={'Move ' + widget?.label + ' down'}
                      onClick={() => moveWidget(id, 1)}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              );
            })}
            <button type="button" className="tylo-home-button tylo-home-button--quiet tylo-home-reset" onClick={resetLayout}>
              Reset to default layout
            </button>
          </div>
        </div>
      </section>
    ) : null;

  const dateText = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date()),
    [],
  );
  const greetingName = user?.fullName || user?.name || user?.displayName || '';
  const roleName = String(user?.roleLabel || user?.role || 'User');

  return (
    <main className="tylo-home" aria-labelledby="tylo-home-title">
      {/* Visually hidden header to preserve semantic hierarchy, accessibility & testing contracts */}
      <header className="sr-only">
        <h1 id="tylo-home-title">{activeMode === 'dashboard' ? 'Business Overview' : 'My View'}</h1>
        <span className="tylo-home-role-badge">{roleName.toUpperCase()}</span>
        <p>
          {getGreeting(greetingName)} <span aria-hidden="true">·</span> {dateText}
        </p>
        <div className="tylo-home-mode-toggle" role="group" aria-label="Dashboard view">
          <button
            type="button"
            className={activeMode === 'dashboard' ? 'is-active' : ''}
            aria-pressed={activeMode === 'dashboard'}
            disabled={!canSeeDashboard}
            title={!canSeeDashboard ? 'Dashboard access is not enabled for your role' : undefined}
            onClick={() => setActiveMode('dashboard')}
          >
            <DashboardIcon />
            <span>Tylo One Dashboard</span>
          </button>
          <button
            type="button"
            className={activeMode === 'my_view' ? 'is-active' : ''}
            aria-pressed={activeMode === 'my_view'}
            onClick={() => setActiveMode('my_view')}
          >
            <span className="tylo-home-user-mark" aria-hidden="true">
              ◉
            </span>
            <span>My View</span>
          </button>
        </div>

        <label className="tylo-home-search">
          <SearchIcon />
          <span>Filter modules or workflows</span>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Filter modules or workflows…"
          />
          <kbd className="tylo-home-kbd">Ctrl K</kbd>
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="Reset search filter">
              ×
            </button>
          )}
        </label>

        {activeMode === 'my_view' && (
          <button
            type="button"
            className="tylo-home-button"
            onClick={() => setCustomizing((value) => !value)}
            aria-expanded={customizing}
          >
            <span aria-hidden="true">☷</span> Customize View
          </button>
        )}
      </header>

      {activeMode === 'my_view' && customizationBar}

      {isSearching ? (
        renderSearchResults()
      ) : activeMode === 'dashboard' && canSeeDashboard ? (
        renderDashboardMode()
      ) : (
        <div className="tylo-home-widget-grid">
          {orderedWidgets.length ? (
            orderedWidgets.map(renderWorkspaceWidget)
          ) : (
            <section className="tylo-home-panel tylo-home-empty">
              <strong>All sections are hidden</strong>
              <button type="button" className="tylo-home-button" onClick={() => setCustomizing(true)}>
                Customize My View
              </button>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
