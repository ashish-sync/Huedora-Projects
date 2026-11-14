import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  FileInput,
  FileOutput,
  LayoutDashboard,
  Link2,
  LogOut,
  Pencil,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Users,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import Input from '../../components/ui/Input.jsx';
import { apiUrl } from '../../shared/config.js';
import { clientOneApi, setClientOneApiMode } from './clientOneApi.js';
import {
  ClientOneDashboardCharts,
  ClientOneHeroKpis,
} from './ClientOneDashboardCharts.jsx';
import ClientOneDrillDownView from './ClientOneDrillDownView.jsx';
import { DEFAULT_FEATURES, visibleNav } from './clientOneNav.js';
import { clearClientOneSession, readClientOneSession } from './clientOneSession.js';
import './clientOne.css';

const NAV_ICONS = {
  dashboard: LayoutDashboard,
  tracker: Calendar,
  invoices: FileInput,
  mis: BarChart3,
  'request-link': Users,
  'purchase-orders': FileOutput,
};

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: ymd(from), to: ymd(to) };
}

function monthRange(anchor = new Date()) {
  const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { from: ymd(from), to: ymd(to), anchor };
}

function formatStatus(value) {
  const raw = String(value || '').replace(/_/g, ' ').trim();
  if (!raw) return '—';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function PinGate({ accessId, onSuccess }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e?.preventDefault?.();
    if (!pin.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const session = await clientOneApi.login({ pin: pin.trim(), accessId });
      onSuccess(session);
    } catch (err) {
      setError(err?.message || 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="client-one">
      <div className="client-one-shell">
        <header className="client-one-topbar page-header">
          <div className="client-one-identity">
            <p className="section-label">Client portal</p>
            <h1>Client One</h1>
            <p className="page-desc">Sign in with your 6-digit PIN to view authorised programme data.</p>
          </div>
        </header>
        <form className="client-one-card client-one-pin-card" onSubmit={submit} aria-label="Client One sign-in">
          <h2 className="client-one-section-title">Sign in</h2>
          <p className="meta-text">Enter the PIN issued for this access link.</p>
          <Input
            label="PIN"
            containerClassName="client-one-pin-field"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D+/g, '').slice(0, 6))}
            placeholder="••••••"
            maxLength={6}
            required
          />
          {accessId ? (
            <p className="meta-text client-one-pin-message">
              Access link: <code className="mono-sm">{accessId}</code>
            </p>
          ) : null}
          {error ? <p className="error-text client-one-pin-message">{error}</p> : null}
          <div className="client-one-pin-actions">
            <Button type="submit" disabled={busy || pin.length !== 6}>
              {busy ? 'Checking…' : 'Continue'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmptyState({ children }) {
  return <p className="client-one-empty">{children}</p>;
}

export default function ClientOneApp({
  mode = 'external',
  onExitPreview = null,
} = {}) {
  const isPreview = mode === 'preview';
  const { accessId: routeAccessId = '' } = useParams();
  const navigate = useNavigate();
  const initialSession = useMemo(() => readClientOneSession(isPreview ? 'preview' : 'external'), [isPreview]);
  const [session, setSession] = useState(initialSession);
  const [tab, setTab] = useState('dashboard');
  const [range, setRange] = useState(defaultRange);
  const [calMonth, setCalMonth] = useState(() => monthRange());
  const [dashboard, setDashboard] = useState(null);
  const [camps, setCamps] = useState([]);
  const [hcwRows, setHcwRows] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [annexures, setAnnexures] = useState([]);
  const [mis, setMis] = useState(null);
  const [requestLink, setRequestLink] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rotateOpen, setRotateOpen] = useState(false);
  const [pinEditorOpen, setPinEditorOpen] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState('');
  const [copied, setCopied] = useState('');
  const [dashFocus, setDashFocus] = useState('camps');
  const [drillDown, setDrillDown] = useState(null);
  const [draftRange, setDraftRange] = useState(defaultRange);
  const [brandImageFailed, setBrandImageFailed] = useState(false);
  const [managePortalOpen, setManagePortalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const managePortalRef = useRef(null);

  const features = session?.features || session?.client?.features || DEFAULT_FEATURES;
  const navItems = useMemo(() => visibleNav(features), [features]);

  useEffect(() => {
    setClientOneApiMode(isPreview ? 'preview' : 'external');
  }, [isPreview]);

  useEffect(() => {
    if (!managePortalOpen) return undefined;
    const onPointerDown = (event) => {
      if (!managePortalRef.current?.contains(event.target)) {
        setManagePortalOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setManagePortalOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [managePortalOpen]);

  useEffect(() => {
    if (!navItems.some((item) => item.id === tab) && navItems[0]) {
      setTab(navItems[0].id);
    }
  }, [navItems, tab]);

  useEffect(() => {
    if (!session?.token) return undefined;
    let cancelled = false;
    setBusy(true);
    setError('');

    const loaders = [];
    if (tab === 'dashboard' || tab === 'tracker') {
      loaders.push(
        clientOneApi.dashboard({ from: range.from, to: range.to }).then((dash) => {
          if (!cancelled) setDashboard(dash);
        }),
      );
      const campPromise = clientOneApi.camps?.({ from: range.from, to: range.to, page: 1, limit: 500 });
      if (campPromise?.then) {
        loaders.push(
          campPromise.then((list) => {
            if (!cancelled && list?.data) setCamps(list.data);
          }).catch(() => null),
        );
      }
    }
    if (tab === 'hcw') {
      loaders.push(
        clientOneApi.hcw({ from: range.from, to: range.to }).then((rows) => {
          if (!cancelled) setHcwRows(rows || []);
        }),
      );
    }
    if (tab === 'calendar') {
      loaders.push(
        clientOneApi.calendar({ from: calMonth.from, to: calMonth.to }).then((data) => {
          if (!cancelled) setCalendar(data);
        }),
      );
    }
    if (tab === 'invoices') {
      loaders.push(
        clientOneApi.invoices().then((rows) => {
          if (!cancelled) setInvoices(rows || []);
        }),
      );
    }
    if (tab === 'annexures') {
      loaders.push(
        clientOneApi.annexures().then((rows) => {
          if (!cancelled) setAnnexures(rows || []);
        }),
      );
    }
    if (tab === 'mis') {
      loaders.push(
        clientOneApi.mis({ from: range.from, to: range.to }).then((data) => {
          if (!cancelled) setMis(data);
        }),
      );
    }
    if (tab === 'request-link') {
      loaders.push(
        clientOneApi.campRequestLink().then((data) => {
          if (!cancelled) setRequestLink(data);
        }),
      );
    }
    if (tab === 'purchase-orders') {
      loaders.push(
        clientOneApi.purchaseOrders().then((rows) => {
          if (!cancelled) setPurchaseOrders(rows || []);
        }),
      );
    }

    Promise.all(loaders)
      .catch((err) => {
        if (cancelled) return;
        if (err?.status === 401) {
          clearClientOneSession(isPreview ? 'preview' : 'external');
          setSession(null);
          return;
        }
        setError(err?.message || 'Could not load Client One data');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => { cancelled = true; };
  }, [session?.token, tab, range.from, range.to, calMonth.from, calMonth.to, isPreview]);

  const ensureCampsLoaded = () => {
    if (!camps.length && session?.token) {
      const p = clientOneApi.camps?.({ from: range.from, to: range.to, page: 1, limit: 500 });
      if (p?.then) {
        p.then((res) => {
          if (Array.isArray(res?.data)) setCamps(res.data);
        }).catch(() => null);
      }
    }
  };

  useEffect(() => {
    if (!selectedId || !session?.token || (tab !== 'tracker' && tab !== 'dashboard')) {
      if (tab !== 'tracker' && tab !== 'dashboard') setDetail(null);
      return undefined;
    }
    let cancelled = false;
    clientOneApi.camp(selectedId)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not load camp');
      });
    return () => { cancelled = true; };
  }, [selectedId, session?.token, tab]);

  const calDays = useMemo(() => {
    const start = new Date(`${calMonth.from}T12:00:00`);
    const year = start.getFullYear();
    const month = start.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      const key = ymd(new Date(year, month, d));
      cells.push({ day: d, key, events: calendar?.byDate?.[key] || [] });
    }
    return cells;
  }, [calMonth.from, calendar]);

  const client = dashboard?.client || session?.client || {};
  const kpis = dashboard?.kpis || mis?.kpis || {};
  const brandTitle = String(client.displayName || client.name || '').trim() || 'Client One';
  // Method = Client Master → Program Configuration → Method (stored as campName).
  const brandMethod = String(client.method || client.campName || '').trim();
  const brandImageUrl = client.portalBrandImageUrl
    ? apiUrl(client.portalBrandImageUrl)
    : '';
  const showBrandImage = Boolean(brandImageUrl) && !brandImageFailed;

  useEffect(() => {
    setBrandImageFailed(false);
  }, [brandImageUrl]);

  if (!session?.token) {
    if (isPreview) {
      return (
        <div className="client-one">
          <div className="client-one-shell">
            <div className="client-one-card">
              <p className="error-text">Preview session expired. Return to the Client One hub and open the programme again.</p>
              <Button type="button" variant="secondary" onClick={() => onExitPreview?.()}>
                Back to hub
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <PinGate
        accessId={routeAccessId}
        onSuccess={(next) => {
          setSession(next);
          if (routeAccessId && next?.client?.accessId && routeAccessId !== next.client.accessId) {
            navigate(`/o/${next.client.accessId}`, { replace: true });
          }
        }}
      />
    );
  }

  function submitDateRange() {
    const next = { from: draftRange.from, to: draftRange.to };
    setRange(next);
    setDraftRange(next);
  }

  function clearDateRange() {
    const next = defaultRange();
    setDraftRange(next);
    setRange(next);
  }

  function signOut() {
    clientOneApi.logout();
    setSession(null);
    if (isPreview) {
      onExitPreview?.();
      return;
    }
    navigate('/client-one', { replace: true });
  }

  async function copyText(label, value) {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else window.prompt(`Copy ${label}`, value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      setError(`Could not copy ${label}`);
    }
  }

  function sharePortalLink() {
    const accessId = client.accessId || session?.client?.accessId || '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = accessId ? `${origin}/o/${accessId}` : `${origin}/client-one`;
    copyText('link', url);
  }

  async function submitPinUpdate(e) {
    e?.preventDefault?.();
    const currentPin = currentPinInput.replace(/\D+/g, '').slice(0, 6);
    const pin = newPinInput.replace(/\D+/g, '').slice(0, 6);
    const confirm = confirmPinInput.replace(/\D+/g, '').slice(0, 6);
    if (currentPin.length !== 6 || pin.length !== 6) {
      setPinMessage('Enter current and new 6-digit PINs.');
      return;
    }
    if (pin !== confirm) {
      setPinMessage('New PIN and confirmation do not match.');
      return;
    }
    setPinBusy(true);
    setPinMessage('');
    try {
      const data = await clientOneApi.updatePin({ currentPin, pin });
      setPinMessage(`PIN updated. New PIN: ${data.pin}`);
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
    } catch (err) {
      setPinMessage(err?.message || 'Could not update PIN');
    } finally {
      setPinBusy(false);
    }
  }

  function shiftMonth(delta) {
    const base = calMonth.anchor || new Date(`${calMonth.from}T12:00:00`);
    const next = new Date(base.getFullYear(), base.getMonth() + delta, 1);
    setCalMonth(monthRange(next));
  }

  const dateControls = (
    <div className="client-one-date-filter" role="group" aria-label="Filter by date range">
      <label className="client-one-date-field">
        <span className="client-one-date-field__label">From</span>
        <input
          type="date"
          className="client-one-date-field__input"
          value={draftRange.from}
          onChange={(e) => setDraftRange((r) => ({ ...r, from: e.target.value }))}
        />
      </label>
      <span className="client-one-date-filter__sep" aria-hidden="true">–</span>
      <label className="client-one-date-field">
        <span className="client-one-date-field__label">To</span>
        <input
          type="date"
          className="client-one-date-field__input"
          value={draftRange.to}
          onChange={(e) => setDraftRange((r) => ({ ...r, to: e.target.value }))}
        />
      </label>
      <div className="client-one-date-filter__actions">
        <Button type="button" size="compact" onClick={submitDateRange}>
          <Check size={12} aria-hidden="true" />
          Apply
        </Button>
        <Button type="button" variant="secondary" size="compact" onClick={clearDateRange}>
          <RefreshCw size={12} aria-hidden="true" />
          Clear
        </Button>
      </div>
    </div>
  );

  return (
    <div
      className={[
        'client-one',
        'client-one--app',
        isPreview ? 'client-one--preview' : '',
        tab === 'dashboard' ? 'client-one--overview' : '',
        sidebarCollapsed ? 'client-one--sidebar-collapsed' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="client-one-layout">
        <aside className="client-one-sidebar" aria-label="Client One navigation">
          <div className="client-one-sidebar__brand">
            {showBrandImage ? (
              <img
                className="client-one-sidebar__logo"
                src={brandImageUrl}
                alt=""
                width={36}
                height={36}
                onError={() => setBrandImageFailed(true)}
              />
            ) : (
              <span className="client-one-sidebar__logo-fallback" aria-hidden="true">
                {brandTitle.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="client-one-sidebar__brand-text">
              <div className="client-one-sidebar__title-line">
                <h1 className="client-one-sidebar__name">{brandTitle}</h1>
                {isPreview ? <span className="client-one-brand__chip">Preview</span> : null}
              </div>
              {brandMethod ? (
                <p className="client-one-sidebar__meta" title="Method">{brandMethod}</p>
              ) : null}
            </div>
          </div>

          <nav className="client-one-sidebar__nav" aria-label="Client One sections">
            {navItems.map((item) => {
              const NavIcon = NAV_ICONS[item.id] || LayoutDashboard;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`client-one-sidebar__link${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  title={item.label}
                  onClick={() => setTab(item.id)}
                >
                  <NavIcon size={16} strokeWidth={1.75} className="client-one-sidebar__icon" aria-hidden="true" />
                  <span className="client-one-sidebar__label">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="client-one-sidebar__footer">
            <div className="client-one-sidebar__programme">
              <span className="client-one-sidebar__programme-name">
                {brandMethod ? `${brandMethod} Programme` : 'Client One'}
              </span>
              <span className="client-one-sidebar__live">
                <span className="client-one-sidebar__live-dot" aria-hidden="true" />
                Live
              </span>
            </div>
            <button
              type="button"
              className="client-one-sidebar__collapse"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-pressed={sidebarCollapsed}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              <span className="client-one-sidebar__label">
                {sidebarCollapsed ? 'Expand' : 'Collapse'}
              </span>
            </button>
          </div>
        </aside>

        <div className="client-one-workspace">
          {isPreview ? (
            <div className="client-one-preview-banner" role="status">
              <div>
                <strong>Internal preview</strong>
                <span> Staff session — not the external client PIN portal.</span>
              </div>
              <Button type="button" variant="secondary" size="compact" onClick={signOut}>
                Exit preview
              </Button>
            </div>
          ) : null}

          <header className="client-one-workspace__topbar">
            <div className="client-one-workspace__topbar-note">
              {isPreview ? 'Internal staff preview' : 'Client portal'}
            </div>
            <div className="client-one-header__utility">
              {!isPreview ? (
                <div className="client-one-manage-portal" ref={managePortalRef}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    aria-haspopup="menu"
                    aria-expanded={managePortalOpen}
                    onClick={() => setManagePortalOpen((open) => !open)}
                  >
                    <Settings2 size={14} aria-hidden="true" />
                    Manage Portal
                    <ChevronDown size={13} aria-hidden="true" />
                  </Button>
                  {managePortalOpen ? (
                    <div className="client-one-manage-portal__menu" role="menu" aria-label="Manage Portal">
                      <button
                        type="button"
                        role="menuitem"
                        className="client-one-manage-portal__item"
                        onClick={() => {
                          sharePortalLink();
                          setManagePortalOpen(false);
                        }}
                      >
                        <Link2 size={14} aria-hidden="true" />
                        {copied === 'link' ? 'Link copied' : 'Share Link'}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="client-one-manage-portal__item"
                        onClick={() => {
                          setPinEditorOpen(true);
                          setPinMessage('');
                          setManagePortalOpen(false);
                        }}
                      >
                        <Pencil size={14} aria-hidden="true" />
                        Update PIN
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <Button type="button" variant="secondary" size="compact" onClick={signOut}>
                <LogOut size={14} aria-hidden="true" />
                {isPreview ? 'Exit preview' : 'Sign out'}
              </Button>
            </div>
          </header>

          {tab !== 'dashboard' ? (
            <div className="client-one-workspace__toolbar">
              {dateControls}
            </div>
          ) : null}

          <div className="client-one-workspace__body">
        {!isPreview && pinEditorOpen ? (
          <section className="client-one-card client-one-pin-editor" aria-label="Update Client One PIN">
            <div className="client-one-panel-head">
              <h2 className="client-one-section-title">Update PIN</h2>
            </div>
            <p className="meta-text">Enter your current 6-digit PIN, then choose a new one. The new PIN is shown once after save.</p>
            <form className="client-one-pin-editor-form" onSubmit={submitPinUpdate}>
              <Input
                label="Current PIN"
                inputMode="numeric"
                maxLength={6}
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D+/g, '').slice(0, 6))}
                autoComplete="current-password"
                required
              />
              <Input
                label="New PIN"
                inputMode="numeric"
                maxLength={6}
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value.replace(/\D+/g, '').slice(0, 6))}
                autoComplete="new-password"
                required
              />
              <Input
                label="Confirm new PIN"
                inputMode="numeric"
                maxLength={6}
                value={confirmPinInput}
                onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D+/g, '').slice(0, 6))}
                autoComplete="new-password"
                required
              />
              <div className="client-one-pin-actions">
                <Button type="submit" disabled={pinBusy}>
                  {pinBusy ? 'Saving…' : 'Save PIN'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setPinEditorOpen(false);
                    setPinMessage('');
                    setCurrentPinInput('');
                    setNewPinInput('');
                    setConfirmPinInput('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
            {pinMessage ? <p className="meta-text client-one-pin-message">{pinMessage}</p> : null}
          </section>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}

        {tab === 'dashboard' ? (
          <section
            className={`client-one-dashboard-wrap${busy ? ' is-loading' : ''}`}
            aria-busy={busy}
          >
            {drillDown ? (
              <>
                <ClientOneDrillDownView
                  drillDown={drillDown}
                  camps={camps}
                  range={range}
                  client={client}
                  onBack={() => {
                    setDrillDown(null);
                    setSelectedId('');
                    setDetail(null);
                  }}
                  onSelectCamp={(id) => setSelectedId(id)}
                  selectedCampId={selectedId}
                />
                {detail ? (
                  <div className="client-one-detail">
                    <div className="client-one-detail__head">
                      <h3>{detail.campId || 'Camp detail'}</h3>
                      <button
                        type="button"
                        className="btn secondary btn-compact"
                        onClick={() => {
                          setSelectedId('');
                          setDetail(null);
                        }}
                      >
                        Close
                      </button>
                    </div>
                    <dl className="client-one-facts">
                      <div><dt>Status</dt><dd>{formatStatus(detail.status)}</dd></div>
                      <div><dt>Schedule</dt><dd>{[detail.campDate, detail.startTime, detail.endTime].filter(Boolean).join(' · ') || '—'}</dd></div>
                      <div><dt>Assignment</dt><dd>{formatStatus(detail.assignmentStatus)}</dd></div>
                      <div><dt>Execution</dt><dd>{formatStatus(detail.executionStatus || detail.effectiveExecutionStatus)}</dd></div>
                      <div><dt>HCW</dt><dd>{detail.hcwName || 'Unassigned'}{detail.hcwContact ? ` · ${detail.hcwContact}` : ''}</dd></div>
                      <div><dt>Category</dt><dd>{detail.hcwCategory || '—'}</dd></div>
                      <div><dt>Address</dt><dd>{detail.campAddress || [detail.city, detail.state, detail.pincode].filter(Boolean).join(', ') || '—'}</dd></div>
                      <div><dt>In / Out</dt><dd>{[detail.inTime, detail.outTime].filter(Boolean).join(' → ') || '—'}</dd></div>
                      <div><dt>Chargeable</dt><dd>{formatStatus(detail.chargeableStatus)}</dd></div>
                      <div><dt>Punctuality</dt><dd>{formatStatus(detail.punctuality)}</dd></div>
                      <div><dt>Attire</dt><dd>{formatStatus(detail.attire)}</dd></div>
                      <div><dt>Patients</dt><dd>{detail.actualPatients ?? '—'}</dd></div>
                    </dl>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <header className="c1-overview-head">
                  <div className="c1-overview-head__titles">
                    <span className="c1-overview-head__eyebrow">OPERATIONS</span>
                    <h2 className="c1-overview-head__title">Operations Dashboard</h2>
                    <p className="c1-overview-head__subtitle">
                      Health Camp Operations · {brandMethod ? `${brandMethod} Programme` : 'BMD Programme'}
                    </p>
                  </div>
                  {dateControls}
                </header>
                <ClientOneHeroKpis
                  kpis={kpis}
                  focus={dashFocus}
                  onFocusChange={setDashFocus}
                  onDrillDown={(payload) => {
                    setDrillDown(payload);
                    ensureCampsLoaded();
                  }}
                />
                <ClientOneDashboardCharts
                  charts={dashboard?.charts || {}}
                  leaderboards={dashboard?.leaderboards || {}}
                  focus={dashFocus}
                  onDrillDown={(payload) => {
                    setDrillDown(payload);
                    ensureCampsLoaded();
                  }}
                />
              </>
            )}
          </section>
        ) : null}

        {tab === 'tracker' ? (
          <section className="client-one-card" aria-busy={busy}>
            <div className="client-one-panel-head">
              <h2 className="client-one-section-title">Camp Register</h2>
            </div>
            <div className="table-wrap">
              <table className="client-one-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Camp</th>
                    <th>Status</th>
                    <th>Assignment</th>
                    <th>Execution</th>
                    <th>HCW</th>
                    <th>Location</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {camps.map((row) => (
                    <tr key={row._id} className={selectedId === row._id ? 'is-selected' : ''}>
                      <td>{row.campDate || '—'}</td>
                      <td>{row.campId || '—'}</td>
                      <td>{formatStatus(row.status)}</td>
                      <td>{formatStatus(row.assignmentStatus)}</td>
                      <td>{formatStatus(row.executionStatus || row.effectiveExecutionStatus)}</td>
                      <td>
                        {row.hcwName || 'Unassigned'}
                        {row.hcwContact ? <div className="meta-text">{row.hcwContact}</div> : null}
                      </td>
                      <td>{[row.city, row.state].filter(Boolean).join(', ') || '—'}</td>
                      <td>
                        <button type="button" className="linkish" onClick={() => setSelectedId(row._id)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!camps.length && !busy ? (
                    <tr><td colSpan={8}>No camps in this period.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {detail ? (
              <div className="client-one-detail">
                <div className="client-one-detail__head">
                  <h3>{detail.campId || 'Camp detail'}</h3>
                  <button type="button" className="btn secondary btn-compact" onClick={() => { setSelectedId(''); setDetail(null); }}>
                    Close
                  </button>
                </div>
                <dl className="client-one-facts">
                  <div><dt>Status</dt><dd>{formatStatus(detail.status)}</dd></div>
                  <div><dt>Schedule</dt><dd>{[detail.campDate, detail.startTime, detail.endTime].filter(Boolean).join(' · ') || '—'}</dd></div>
                  <div><dt>Assignment</dt><dd>{formatStatus(detail.assignmentStatus)}</dd></div>
                  <div><dt>Execution</dt><dd>{formatStatus(detail.executionStatus || detail.effectiveExecutionStatus)}</dd></div>
                  <div><dt>HCW</dt><dd>{detail.hcwName || 'Unassigned'}{detail.hcwContact ? ` · ${detail.hcwContact}` : ''}</dd></div>
                  <div><dt>Category</dt><dd>{detail.hcwCategory || '—'}</dd></div>
                  <div><dt>Address</dt><dd>{detail.campAddress || [detail.city, detail.state, detail.pincode].filter(Boolean).join(', ') || '—'}</dd></div>
                  <div><dt>In / Out</dt><dd>{[detail.inTime, detail.outTime].filter(Boolean).join(' → ') || '—'}</dd></div>
                  <div><dt>Chargeable</dt><dd>{formatStatus(detail.chargeableStatus)}</dd></div>
                  <div><dt>Punctuality</dt><dd>{formatStatus(detail.punctuality)}</dd></div>
                  <div><dt>Attire</dt><dd>{formatStatus(detail.attire)}</dd></div>
                  <div><dt>Patients</dt><dd>{detail.actualPatients ?? '—'}</dd></div>
                </dl>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === 'hcw' ? (
          <section className="client-one-card" aria-busy={busy}>
            <div className="table-wrap">
              <table className="client-one-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Camp</th>
                    <th>HCW</th>
                    <th>Contact</th>
                    <th>Category</th>
                    <th>Assignment</th>
                  </tr>
                </thead>
                <tbody>
                  {hcwRows.map((row) => (
                    <tr key={`${row._id}-${row.hcwName}`}>
                      <td>{row.campDate || '—'}</td>
                      <td>{row.campId || '—'}</td>
                      <td>{row.hcwName || 'Unassigned'}</td>
                      <td>{row.hcwContact || '—'}</td>
                      <td>{row.hcwCategory || '—'}</td>
                      <td>{formatStatus(row.assignmentStatus)}</td>
                    </tr>
                  ))}
                  {!hcwRows.length && !busy ? (
                    <tr><td colSpan={6}>No HCW assignments in this period.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === 'calendar' ? (
          <section className="client-one-card" aria-busy={busy}>
            <div className="client-one-toolbar">
              <Button type="button" variant="secondary" onClick={() => shiftMonth(-1)}>Previous</Button>
              <strong className="client-one-month-label">
                {new Date(`${calMonth.from}T12:00:00`).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
              </strong>
              <Button type="button" variant="secondary" onClick={() => shiftMonth(1)}>Next</Button>
              <div className="client-one-legend">
                <span className="is-upcoming">Upcoming</span>
                <span className="is-completed">Completed</span>
                <span className="is-cancelled">Cancelled</span>
              </div>
            </div>
            <div className="client-one-cal-grid" role="grid" aria-label="Camp calendar">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="client-one-cal-head">{d}</div>
              ))}
              {calDays.map((cell, idx) => (
                <div key={cell ? cell.key : `pad-${idx}`} className={`client-one-cal-cell${cell ? '' : ' is-pad'}`}>
                  {cell ? (
                    <>
                      <div className="client-one-cal-day">{cell.day}</div>
                      <div className="client-one-cal-events">
                        {cell.events.slice(0, 3).map((ev) => (
                          <button
                            key={ev._id}
                            type="button"
                            className={`client-one-cal-chip is-${ev.bucket}`}
                            title={`${ev.campId || 'Camp'} · ${formatStatus(ev.status)}`}
                            onClick={() => { setTab('tracker'); setSelectedId(ev._id); }}
                          >
                            {ev.campId || formatStatus(ev.status)}
                          </button>
                        ))}
                        {cell.events.length > 3 ? (
                          <span className="meta-text">+{cell.events.length - 3} more</span>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === 'invoices' ? (
          <section className="client-one-card" aria-busy={busy}>
            <div className="client-one-panel-head">
              <h2 className="client-one-section-title">Incoming Docs</h2>
            </div>
            <div className="table-wrap">
              <table className="client-one-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Date</th>
                    <th>Period</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((row) => (
                    <tr key={row._id}>
                      <td>{row.documentNumber || '—'}</td>
                      <td>{row.documentDate || '—'}</td>
                      <td>{row.servicePeriod || row.projectName || '—'}</td>
                      <td>{formatStatus(row.status)}</td>
                      <td>{row.grandTotal == null ? '—' : Number(row.grandTotal).toLocaleString('en-IN')}</td>
                      <td>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => clientOneApi.downloadInvoicePdf(row._id, `${row.documentNumber || 'invoice'}.pdf`).catch((err) => setError(err.message))}
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!invoices.length && !busy ? (
                    <tr><td colSpan={6}>No issued invoices for this programme yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === 'annexures' ? (
          <section className="client-one-card" aria-busy={busy}>
            <div className="table-wrap">
              <table className="client-one-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {annexures.map((row) => (
                    <tr key={row.id}>
                      <td>{row.fileName}</td>
                      <td>{row.label || row.kind}</td>
                      <td>{row.uploadedAt || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => clientOneApi.downloadAnnexure(row.id, row.fileName).catch((err) => setError(err.message))}
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!annexures.length && !busy ? (
                    <tr><td colSpan={4}>No annexures available yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === 'mis' ? (
          <section className="client-one-card" aria-busy={busy}>
            <div className="client-one-panel-head">
              <h2 className="client-one-section-title">Reports & Analytics</h2>
              <Button
                type="button"
                variant="secondary"
                size="compact"
                onClick={() => clientOneApi.exportMis(range).catch((err) => setError(err.message))}
              >
                Download CSV
              </Button>
            </div>
            <div className="client-one-kpis client-one-kpis--four" role="list">
              {[
                ['Total', mis?.kpis?.total],
                ['Executed', mis?.kpis?.executed],
                ['Cancelled', mis?.kpis?.cancelled],
                ['Completion %', mis?.kpis?.executionCompletionPct == null ? '—' : `${mis.kpis.executionCompletionPct}%`],
              ].map(([label, value]) => (
                <div key={label} className="client-one-kpi" role="listitem">
                  <span>{label}</span>
                  <strong>{value ?? 0}</strong>
                </div>
              ))}
            </div>
            {!mis?.camps?.length && !busy ? <EmptyState>No MIS rows for this period.</EmptyState> : null}
          </section>
        ) : null}

        {tab === 'request-link' ? (
          <section className="client-one-card" aria-busy={busy}>
            <div className="client-one-panel-head">
              <h2 className="client-one-section-title">User Base</h2>
            </div>
            <p className="meta-text">
              Share this link so authorised users can submit camp requests for
              {' '}
              {client.programName || 'this programme'}
              {client.campName ? ` · ${client.campName}` : ''}.
            </p>
            {requestLink?.url ? (
              <div className="client-one-link-box">
                <code>{requestLink.url}</code>
                <div className="client-one-pin-actions">
                  <Button type="button" variant="secondary" size="compact" onClick={() => copyText('link', requestLink.url)}>
                    {copied === 'link' ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button type="button" variant="secondary" size="compact" onClick={() => setRotateOpen(true)}>
                    Rotate link
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState>{busy ? 'Loading…' : 'No request link is available yet.'}</EmptyState>
            )}
          </section>
        ) : null}

        {tab === 'purchase-orders' ? (
          <section className="client-one-card" aria-busy={busy}>
            <div className="client-one-panel-head">
              <h2 className="client-one-section-title">Outgoing Docs</h2>
              <div className="client-one-toolbar">
                <label className="client-one-upload">
                  <span>Upload PO</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/*"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      e.target.value = '';
                      if (!files.length) return;
                      setBusy(true);
                      try {
                        const rows = await clientOneApi.uploadPurchaseOrders(files);
                        setPurchaseOrders(rows || []);
                      } catch (err) {
                        setError(err?.message || 'Upload failed');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="table-wrap">
              <table className="client-one-table">
                <thead>
                  <tr>
                    <th>PO number</th>
                    <th>Issue</th>
                    <th>Expiry</th>
                    <th>Files</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td>{po.poNumber || '—'}</td>
                      <td>{po.poIssueDate || '—'}</td>
                      <td>{po.poExpiryDate || '—'}</td>
                      <td>{po.fileCount || 0}</td>
                      <td>
                        <div className="client-one-file-links">
                          {(po.files || []).map((file) => (
                            <button
                              key={file.id}
                              type="button"
                              className="linkish"
                              onClick={() => clientOneApi.downloadPoFile(po.id, file.id, file.fileName).catch((err) => setError(err.message))}
                            >
                              {file.fileName}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!purchaseOrders.length && !busy ? (
                    <tr><td colSpan={5}>No purchase orders uploaded yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={rotateOpen}
        title="Rotate camp request link?"
        message="The previous public link stops working immediately. Share the new link with your teams."
        confirmLabel="Rotate link"
        danger
        onCancel={() => setRotateOpen(false)}
        onConfirm={async () => {
          setRotateOpen(false);
          setBusy(true);
          try {
            const data = await clientOneApi.rotateCampRequestLink();
            setRequestLink(data);
          } catch (err) {
            setError(err?.message || 'Could not rotate link');
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
