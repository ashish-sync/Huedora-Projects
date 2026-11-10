import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth.jsx';
import { OPERATIONAL_MODULES } from '../../shared/navModules.jsx';
import { api } from '../../shared/api.js';
import InternalChat from '../chat/InternalChat.jsx';
import CalendarTodo from '../calendar/CalendarTodo.jsx';
import WelcomeMetrics from './WelcomeMetrics.jsx';
import CampPipelinePanel from './CampPipelinePanel.jsx';
import { formatDateTime, TIME_ZONE } from '../../shared/dateFormat.js';
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

const EMPTY_SCHEDULE_COUNTS = { today: 0, tomorrow: 0, dayAfter: 0, restOfMonth: 0 };

const CAMP_SCHEDULE_SLOT_UI = [
  {
    campSlot: 'Morning',
    iconClass: 'tylo-home-session-icon--morning',
    icon: (
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
    ),
  },
  {
    campSlot: 'Noon',
    iconClass: 'tylo-home-session-icon--noon',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9.5" cy="10" r="3.2" />
        <line x1="9.5" y1="3.5" x2="9.5" y2="5" />
        <line x1="4.2" y1="5.5" x2="5.2" y2="6.7" />
        <line x1="3" y1="10" x2="4.5" y2="10" />
        <path d="M8.5 16.5h8.2a3.3 3.3 0 0 0 .4-6.6 4.4 4.4 0 0 0-8.3 1.4" />
      </svg>
    ),
  },
  {
    campSlot: 'Evening',
    iconClass: 'tylo-home-session-icon--evening',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.5 14.2A7.4 7.4 0 1 1 11 4.2 5.8 5.8 0 0 0 20.5 14.2z" />
      </svg>
    ),
  },
];

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
const QUICK_ACCESS_SLOTS = 9;

function makeModuleQuickItem(moduleId) {
  return { type: 'module', id: String(moduleId) };
}

function makeUrlQuickItem({ title, to }) {
  return {
    type: 'url',
    id: `url-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: String(title || 'Page').trim() || 'Page',
    to: String(to || '').trim(),
  };
}

function titleFromPath(pathname = '/') {
  const parts = String(pathname || '/')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return 'Home';
  const last = decodeURIComponent(parts[parts.length - 1]).replace(/[-_]+/g, ' ');
  return last.replace(/\b\w/g, (char) => char.toUpperCase()) || 'Page';
}

/** Accept internal paths or absolute same-app URLs; reject unsafe schemes. */
export function parseQuickAccessUrlInput(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  let label = '';
  let urlPart = text;
  const labeled = text.match(/^(.+?)\s*\|\s*(.+)$/);
  if (labeled) {
    label = labeled[1].trim();
    urlPart = labeled[2].trim();
  }

  if (/^(javascript|data|vbscript):/i.test(urlPart)) return null;

  let pathname = '';
  let search = '';
  let hash = '';

  try {
    if (/^https?:\/\//i.test(urlPart)) {
      const parsed = new URL(urlPart);
      if (typeof window !== 'undefined' && window.location?.origin && parsed.origin !== window.location.origin) {
        return null;
      }
      pathname = parsed.pathname || '/';
      search = parsed.search || '';
      hash = parsed.hash || '';
    } else if (urlPart.startsWith('/')) {
      const parsed = new URL(urlPart, 'https://tylo.local');
      pathname = parsed.pathname || '/';
      search = parsed.search || '';
      hash = parsed.hash || '';
    } else if (/^[\w.-]+(?:\/[\w.?&=%#-]*)*$/i.test(urlPart)) {
      const parsed = new URL(`/${urlPart}`, 'https://tylo.local');
      pathname = parsed.pathname || '/';
      search = parsed.search || '';
      hash = parsed.hash || '';
    } else {
      return null;
    }
  } catch {
    return null;
  }

  const to = `${pathname}${search}${hash}` || '/';
  return {
    title: label || titleFromPath(pathname),
    to,
  };
}

function normalizeQuickAccessItems(value) {
  if (Array.isArray(value?.quickAccessItems)) {
    const items = [];
    const seenModules = new Set();
    for (const raw of value.quickAccessItems) {
      if (!raw || typeof raw !== 'object') continue;
      if (raw.type === 'url') {
        const parsed = parseQuickAccessUrlInput(raw.to);
        if (!parsed) continue;
        items.push({
          type: 'url',
          id: typeof raw.id === 'string' && raw.id ? raw.id : makeUrlQuickItem(parsed).id,
          title: String(raw.title || parsed.title).trim() || parsed.title,
          to: parsed.to,
        });
      } else if (raw.type === 'module' || raw.id) {
        const id = String(raw.id || '').trim();
        if (!id || seenModules.has(id)) continue;
        seenModules.add(id);
        items.push(makeModuleQuickItem(id));
      }
      if (items.length >= QUICK_ACCESS_SLOTS) break;
    }
    if (items.length) return items;
  }

  const moduleIds = Array.isArray(value?.pinnedModules)
    ? [...new Set(value.pinnedModules.filter((id) => typeof id === 'string' && id.trim()))]
    : DEFAULT_PINNED_MODULES;
  return moduleIds.slice(0, QUICK_ACCESS_SLOTS).map(makeModuleQuickItem);
}

function moduleIdsFromQuickAccess(items = []) {
  return items.filter((item) => item?.type === 'module').map((item) => item.id);
}

function defaultConfig() {
  const quickAccessItems = DEFAULT_PINNED_MODULES.map(makeModuleQuickItem);
  return {
    visible: { kpis: true, shortcuts: true, tasks: true, notes: true, messages: true },
    pinnedModules: DEFAULT_PINNED_MODULES,
    quickAccessItems,
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
  const quickAccessItems = normalizeQuickAccessItems(value);
  return {
    visible: {
      kpis: typeof visible.kpis === 'boolean' ? visible.kpis : defaults.visible.kpis,
      shortcuts: typeof visible.shortcuts === 'boolean' ? visible.shortcuts : defaults.visible.shortcuts,
      tasks: typeof visible.tasks === 'boolean' ? visible.tasks : defaults.visible.tasks,
      notes: typeof visible.notes === 'boolean' ? visible.notes : defaults.visible.notes,
      messages: typeof visible.messages === 'boolean' ? visible.messages : defaults.visible.messages,
    },
    pinnedModules: moduleIdsFromQuickAccess(quickAccessItems),
    quickAccessItems,
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

/** Prefer personal name; fall back to a friendly role identity (never blank). */
export function welcomeHeadingName(user) {
  const personal = String(user?.fullName || user?.name || user?.displayName || '').trim();
  if (personal) return personal.split(/\s+/)[0];
  const role = String(user?.roleLabel || user?.systemRole || user?.role || '').trim();
  if (!role) return '';
  if (/super\s*admin|administrator|^admin$/i.test(role)) return 'Administrator';
  return role.split(/\s+/)[0];
}

function asLocalDate(value) {
  if (!value) return '';
  return formatDateTime(value);
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

function LinkShortcutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

const NOTE_TONES = ['amber', 'sky', 'violet', 'mint'];

function noteToneFor(note, index) {
  const seed = String(note?.id || index);
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i) * (i + 1)) % NOTE_TONES.length;
  return NOTE_TONES[hash];
}

export default function DashboardPage() {
  const { can, user } = useAuth();
  const [searchParams] = useSearchParams();
  const userKey = String(user?._id || user?.id || 'guest');
  const canSeeDashboard = Boolean(can('dashboards:read') || can('*'));
  const canReadNotifications = Boolean(can('notifications:read') || can('*'));
  const { isTopManager } = useMemo(() => detectStakeholderRole(user, can), [user, can]);
  const modules = useMemo(() => OPERATIONAL_MODULES.filter((module) => module.canShow(can)), [can]);
  const moduleById = useMemo(() => new Map(modules.map((module) => [module.id, module])), [modules]);
  const authorizedModuleIds = useMemo(() => new Set(modules.map((module) => module.id)), [modules]);
  const canSeeModule = useCallback((id) => isTopManager || authorizedModuleIds.has(id), [isTopManager, authorizedModuleIds]);

  const [activeMode, setActiveMode] = useState(() => (canSeeDashboard ? 'dashboard' : 'my_view'));
  const [selectedModuleFilter, setSelectedModuleFilter] = useState('CAMP ONE');
  const [searchQuery, setSearchQuery] = useState(() => String(searchParams.get('q') || ''));
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');
  const [campSchedule, setCampSchedule] = useState(null);
  const [campScheduleLoading, setCampScheduleLoading] = useState(false);
  const [campScheduleError, setCampScheduleError] = useState('');
  const [notificationRows, setNotificationRows] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [productivityTab, setProductivityTab] = useState('notes');
  const [chatUnread, setChatUnread] = useState(0);
  const [calendarBadge, setCalendarBadge] = useState(0);
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddQuery, setQuickAddQuery] = useState('');
  const [customizing, setCustomizing] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [configState, setConfigState] = useState(() => ({ owner: userKey, value: readUserConfig(userKey) }));
  const [notesState, setNotesState] = useState(() => ({ owner: userKey, value: readUserNotes(userKey) }));

  const searchInputRef = useRef(null);
  const quickAddInputRef = useRef(null);

  const config = configState.owner === userKey ? configState.value : defaultConfig();
  const userNotes = notesState.owner === userKey ? notesState.value : [];

  useEffect(() => {
    if (!canSeeDashboard) setActiveMode('my_view');
  }, [canSeeDashboard]);

  useEffect(() => {
    if (configState.owner !== userKey) setConfigState({ owner: userKey, value: readUserConfig(userKey) });
    if (notesState.owner !== userKey) setNotesState({ owner: userKey, value: readUserNotes(userKey) });
  }, [userKey, configState.owner, notesState.owner]);

  // Keep homepage filter in sync when header search navigates with ?q=
  useEffect(() => {
    const q = String(searchParams.get('q') || '');
    setSearchQuery((prev) => (prev === q ? prev : q));
  }, [searchParams]);

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
    if (!canSeeDashboard) {
      setCampSchedule(null);
      setCampScheduleLoading(false);
      setCampScheduleError('');
      return undefined;
    }
    let current = true;
    setCampScheduleLoading(true);
    setCampScheduleError('');
    api('/dashboards/camp-schedule')
      .then((response) => {
        if (!current) return;
        if (!response?.data || typeof response.data !== 'object' || !Array.isArray(response.data.rows)) {
          throw new Error('The camp schedule returned an invalid response.');
        }
        setCampSchedule(response.data);
      })
      .catch((error) => {
        if (current) {
          setCampSchedule(null);
          setCampScheduleError(error?.message || 'Unable to load camp schedule.');
        }
      })
      .finally(() => {
        if (current) setCampScheduleLoading(false);
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
    updateConfig((previous) => {
      const items = Array.isArray(previous.quickAccessItems) ? [...previous.quickAccessItems] : [];
      if (checked) {
        if (items.some((item) => item.type === 'module' && item.id === moduleId)) return previous;
        if (items.length >= QUICK_ACCESS_SLOTS) return previous;
        return { ...previous, quickAccessItems: [...items, makeModuleQuickItem(moduleId)] };
      }
      return {
        ...previous,
        quickAccessItems: items.filter((item) => !(item.type === 'module' && item.id === moduleId)),
      };
    });

  const removeQuickAccessItem = (itemId) =>
    updateConfig((previous) => ({
      ...previous,
      quickAccessItems: (previous.quickAccessItems || []).filter((item) => item.id !== itemId),
    }));

  const addQuickAccessUrl = (rawInput) => {
    const parsed = parseQuickAccessUrlInput(rawInput);
    if (!parsed) return false;
    let added = false;
    updateConfig((previous) => {
      const items = Array.isArray(previous.quickAccessItems) ? [...previous.quickAccessItems] : [];
      if (items.length >= QUICK_ACCESS_SLOTS) return previous;
      if (items.some((item) => item.type === 'url' && item.to === parsed.to)) return previous;
      added = true;
      return { ...previous, quickAccessItems: [...items, makeUrlQuickItem(parsed)] };
    });
    return added;
  };

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
        .filter(Boolean)
        .slice(0, QUICK_ACCESS_SLOTS),
    [config.pinnedModules, authorizedModuleIds, moduleById],
  );

  const quickAccessTiles = useMemo(() => {
    const items = Array.isArray(config.quickAccessItems) ? config.quickAccessItems : [];
    return items
      .map((item) => {
        if (item.type === 'url') {
          return {
            key: item.id,
            kind: 'url',
            id: item.id,
            title: item.title,
            to: item.to,
            icon: <LinkShortcutIcon />,
          };
        }
        if (!authorizedModuleIds.has(item.id)) return null;
        const module = moduleById.get(item.id);
        if (!module) return null;
        return {
          key: item.id,
          kind: 'module',
          id: item.id,
          title: module.title,
          to: module.to,
          icon: module.icon,
        };
      })
      .filter(Boolean)
      .slice(0, QUICK_ACCESS_SLOTS);
  }, [config.quickAccessItems, authorizedModuleIds, moduleById]);

  const availableQuickPins = useMemo(
    () => modules.filter((module) => !config.pinnedModules.includes(module.id)),
    [modules, config.pinnedModules],
  );

  const quickAddMatches = useMemo(() => {
    const q = quickAddQuery.trim().toLowerCase();
    if (!q) return availableQuickPins;
    return availableQuickPins.filter((module) => {
      const hay = `${module.title} ${module.blurb || ''} ${(module.keywords || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [availableQuickPins, quickAddQuery]);

  const quickAddUrlCandidate = useMemo(
    () => parseQuickAccessUrlInput(quickAddQuery),
    [quickAddQuery],
  );

  const emptyQuickSlots = Math.max(0, QUICK_ACCESS_SLOTS - quickAccessTiles.length);

  const openQuickAddSearch = () => {
    if (emptyQuickSlots <= 0) return;
    setQuickAddQuery('');
    setQuickAddOpen(true);
    window.setTimeout(() => quickAddInputRef.current?.focus(), 0);
  };

  const closeQuickAddSearch = () => {
    setQuickAddOpen(false);
    setQuickAddQuery('');
  };

  const addQuickPin = (moduleId) => {
    setPinned(moduleId, true);
    closeQuickAddSearch();
  };

  const tryAddQuickUrl = () => {
    if (!quickAddUrlCandidate) return false;
    const ok = addQuickAccessUrl(quickAddQuery);
    if (ok) closeQuickAddSearch();
    return ok;
  };

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

  const scheduleRows = useMemo(() => {
    const bySlot = new Map((campSchedule?.rows || []).map((row) => [row.campSlot, row]));
    return CAMP_SCHEDULE_SLOT_UI.map((meta) => {
      const counts = bySlot.get(meta.campSlot) || EMPTY_SCHEDULE_COUNTS;
    return {
        ...meta,
        today: Number(counts.today) || 0,
        tomorrow: Number(counts.tomorrow) || 0,
        dayAfter: Number(counts.dayAfter) || 0,
        restOfMonth: Number(counts.restOfMonth ?? counts.mtd) || 0,
      };
    });
  }, [campSchedule]);

  const scheduleTotals = useMemo(() => {
    const totals = campSchedule?.totals || EMPTY_SCHEDULE_COUNTS;
    return {
      today: Number(totals.today) || 0,
      tomorrow: Number(totals.tomorrow) || 0,
      dayAfter: Number(totals.dayAfter) || 0,
      restOfMonth: Number(totals.restOfMonth ?? totals.mtd) || 0,
    };
  }, [campSchedule]);

  const query = searchQuery.trim().toLowerCase();
  const searchActions = authorizedActions.filter((action) =>
    (action.title + ' ' + action.hint).toLowerCase().includes(query),
  );
  const searchModules = modules.filter((module) =>
    (module.title + ' ' + (module.blurb || '') + ' ' + (module.keywords || []).join(' ')).toLowerCase().includes(query),
  );
  const isSearching = Boolean(query);

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
          {quickAccessTiles.length ? (
            <div className="tylo-home-module-grid">
              {quickAccessTiles.map((tile) => (
                <Link key={tile.key} to={tile.to} className="tylo-home-module-tile">
                  <span className="tylo-home-module-icon">{tile.icon}</span>
                  <span className="tylo-home-module-copy">
                    <strong>{tile.title}</strong>
                    <small>{tile.kind === 'url' ? tile.to : moduleById.get(tile.id)?.blurb || 'Open module'}</small>
                  </span>
                  <span className="tylo-home-arrow" aria-hidden="true">
                    ↗
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="tylo-home-empty">
              <strong>No shortcuts yet</strong>
              <span>Pin modules or add a page URL in Customize View.</span>
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
          {/* Top-left: Welcome greeting + camp quality metrics */}
          <section className="tylo-home-panel tylo-home-greeting-panel" aria-label="Welcome">
            {(() => {
              const welcomeFirst = welcomeHeadingName(user);
              const welcomeDate = new Intl.DateTimeFormat('en-GB', {
                timeZone: TIME_ZONE,
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(new Date());
              return (
                <div className="tylo-home-greeting">
                  <h2 className="tylo-home-greeting-title">
                    {welcomeFirst ? `Welcome ${welcomeFirst}` : 'Welcome'}
                  </h2>
                  <p className="tylo-home-greeting-date">{welcomeDate}</p>
                  </div>
              );
            })()}
            <WelcomeMetrics enabled={canSeeDashboard} />
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
                    <p className="tylo-home-card-subtitle">
                      {campScheduleError
                        ? campScheduleError
                        : campScheduleLoading
                          ? 'Loading Camp One schedule…'
                          : 'Today and upcoming camp schedule'}
                    </p>
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
                      <th scope="col" title="Today">Day 0</th>
                      <th scope="col" title="Tomorrow">Day 1</th>
                      <th scope="col" title="Day after tomorrow">Day 2</th>
                      <th scope="col" title="Day 3 through the last day of the current month">EOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.map((row) => (
                      <tr key={row.campSlot}>
                        <td>
                          <div className="tylo-home-session-cell">
                            <span className={`tylo-home-session-icon ${row.iconClass}`} aria-hidden="true">
                              {row.icon}
                            </span>
                            <span>{row.campSlot}</span>
                          </div>
                      </td>
                        <td className={`tylo-home-sched-num ${row.today === 0 ? 'is-zero' : 'is-nonzero'}`}>{row.today}</td>
                        <td className={`tylo-home-sched-num ${row.tomorrow === 0 ? 'is-zero' : 'is-nonzero'}`}>{row.tomorrow}</td>
                        <td className={`tylo-home-sched-num ${row.dayAfter === 0 ? 'is-zero' : 'is-nonzero'}`}>{row.dayAfter}</td>
                        <td className={`tylo-home-sched-num ${row.restOfMonth === 0 ? 'is-zero' : 'is-nonzero'}`}>{row.restOfMonth}</td>
                    </tr>
                    ))}
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
                      <td className={`tylo-home-total-num ${scheduleTotals.today === 0 ? 'is-zero' : 'is-nonzero'}`}>{scheduleTotals.today}</td>
                      <td className={`tylo-home-total-num ${scheduleTotals.tomorrow === 0 ? 'is-zero' : 'is-nonzero'}`}>{scheduleTotals.tomorrow}</td>
                      <td className={`tylo-home-total-num ${scheduleTotals.dayAfter === 0 ? 'is-zero' : 'is-nonzero'}`}>{scheduleTotals.dayAfter}</td>
                      <td className={`tylo-home-total-num ${scheduleTotals.restOfMonth === 0 ? 'is-zero' : 'is-nonzero'}`}>{scheduleTotals.restOfMonth}</td>
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
          <CampPipelinePanel enabled={canSeeDashboard} user={user} />

          {/* Bottom-right: Quick Access */}
          <section
            className={
              'tylo-home-panel tylo-home-quick-panel'
              + (pinPickerOpen ? ' is-customizing' : '')
              + (quickAddOpen ? ' is-adding' : '')
            }
            aria-label="Quick access"
          >
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
                  <p className="tylo-home-card-subtitle">Jump to modules, workflows, or page links</p>
                      </div>
                      </div>
              <button
                type="button"
                className="tylo-home-customize-shortcuts-btn"
                onClick={() => {
                  setPinPickerOpen((value) => !value);
                  closeQuickAddSearch();
                }}
                aria-expanded={pinPickerOpen}
                aria-label="Customize pins / shortcuts"
              >
                {pinPickerOpen ? 'Done' : 'Customize'}
              </button>
                  </div>

            {pinPickerOpen && quickAddOpen ? (
              <div className="tylo-home-quick-add-search" aria-label="Add shortcut">
                <label className="tylo-home-quick-add-search-field">
                  <span className="sr-only">Search modules or paste a page URL</span>
                  <input
                    ref={quickAddInputRef}
                    type="search"
                    value={quickAddQuery}
                    onChange={(event) => setQuickAddQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        closeQuickAddSearch();
                        return;
                      }
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      if (quickAddMatches[0]) {
                        addQuickPin(quickAddMatches[0].id);
                        return;
                      }
                      tryAddQuickUrl();
                    }}
                    placeholder="Module name or page URL…"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="tylo-home-quick-add-search-clear"
                    onClick={closeQuickAddSearch}
                    aria-label="Close add shortcut"
                    title="Close"
                  >
                    ×
                  </button>
                </label>
                {quickAddMatches.length || quickAddUrlCandidate ? (
                  <ul className="tylo-home-quick-add-search-results" role="listbox" aria-label="Matching shortcuts">
                    {quickAddMatches.map((module) => (
                      <li key={module.id}>
                        <button
                          type="button"
                          role="option"
                          className="tylo-home-quick-add-search-option"
                          onClick={() => addQuickPin(module.id)}
                        >
                          {module.title}
                        </button>
                      </li>
                    ))}
                    {quickAddUrlCandidate ? (
                      <li key={`url-${quickAddUrlCandidate.to}`}>
                        <button
                          type="button"
                          role="option"
                          className="tylo-home-quick-add-search-option tylo-home-quick-add-search-option--url"
                          onClick={tryAddQuickUrl}
                        >
                          Add page · {quickAddUrlCandidate.title}
                          <small>{quickAddUrlCandidate.to}</small>
                        </button>
                      </li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="tylo-home-quick-add-search-empty">
                    {quickAddQuery.trim()
                      ? 'No matching modules. Try a path like /camps or Label | /path.'
                      : availableQuickPins.length
                        ? 'Search a module, or paste a page URL.'
                        : 'Paste a page URL (e.g. /camps or Label | /path).'}
                  </p>
                )}
              </div>
            ) : null}

            {!quickAddOpen ? (
              <div className="tylo-home-quick-tiles-grid">
                {quickAccessTiles.map((tile) => {
                  const tileBody = (
                    <>
                      <span className="tylo-home-subtile-icon" aria-hidden="true">{tile.icon}</span>
                      <strong className="tylo-home-subtile-title">{tile.title}</strong>
                    </>
                  );
                  if (pinPickerOpen) {
                    return (
                      <div key={tile.key} className="tylo-home-quick-subtile is-editing">
                        <button
                          type="button"
                          className="tylo-home-quick-tile-remove"
                          aria-label={`Remove ${tile.title}`}
                          title={`Remove ${tile.title}`}
                          onClick={() => removeQuickAccessItem(tile.id)}
                        >
                          ×
                        </button>
                        {tileBody}
          </div>
                    );
                  }
                  return (
                    <Link key={tile.key} to={tile.to} className="tylo-home-quick-subtile">
                      {tileBody}
                    </Link>
                  );
                })}
                {pinPickerOpen
                  ? Array.from({ length: emptyQuickSlots }, (_, index) => (
                      <button
                        key={`empty-slot-${index}`}
                        type="button"
                        className="tylo-home-quick-subtile tylo-home-quick-subtile--empty"
                        aria-label="Add shortcut"
                        title="Add shortcut"
                        onClick={openQuickAddSearch}
                      >
                        <span className="tylo-home-quick-tile-add" aria-hidden="true">+</span>
                      </button>
                    ))
                  : null}
                {!pinPickerOpen && !quickAccessTiles.length ? (
                  <div className="tylo-home-quick-empty-hint">
                    <strong>No shortcuts yet</strong>
                    <span>Use Customize to pin modules or add a page URL.</span>
        </div>
                ) : null}
              </div>
            ) : null}
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
        timeZone: TIME_ZONE,
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
