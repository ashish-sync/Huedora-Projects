import { useCallback, useEffect, useRef, useState } from 'react';
import ModalShell from '../../components/ui/ModalShell.jsx';
import Button from '../../components/ui/Button.jsx';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import { formatTime } from '../../shared/dateFormat.js';
import { playNotificationSound } from '../../shared/notificationSound.js';
import './calendarReminder.css';

const POLL_MS = 30_000;
const TICK_MS = 5_000;
const SNOOZE_MS = 5 * 60 * 1000;
const LEAD_MS = 5 * 60 * 1000;
const LOOKAHEAD_MS = 48 * 60 * 60 * 1000;

function reminderFireAtMs(event) {
  if (event?.reminderAt) {
    const explicit = new Date(event.reminderAt).getTime();
    if (!Number.isNaN(explicit)) return explicit;
  }
  const start = new Date(event?.startAt || 0).getTime();
  if (Number.isNaN(start)) return NaN;
  return start - LEAD_MS;
}

function shownKey(eventId, fireAtMs) {
  return `${eventId}:${fireAtMs}`;
}

function formatWhen(iso) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return formatTime(iso) || '';
  }
}

export default function CalendarReminderWatcher() {
  const { user, loading: authLoading } = useAuth();
  const selfId = String(user?._id || user?.id || '');
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const eventsRef = useRef([]);
  const shownRef = useRef(new Set());
  const activeIdRef = useRef('');

  const pickDue = useCallback(() => {
    if (activeIdRef.current) return;
    const now = Date.now();
    const next = eventsRef.current.find((event) => {
      if (!event?.id || event.kind !== 'task' || event.status !== 'open') return false;
      const fireAt = reminderFireAtMs(event);
      if (Number.isNaN(fireAt) || fireAt > now) return false;
      const start = new Date(event.startAt || 0).getTime();
      /* Stop prompting long after the scheduled start (2h grace). */
      if (!Number.isNaN(start) && now > start + 2 * 60 * 60 * 1000) return false;
      return !shownRef.current.has(shownKey(event.id, fireAt));
    });
    if (!next) return;
    const fireAt = reminderFireAtMs(next);
    shownRef.current.add(shownKey(next.id, fireAt));
    activeIdRef.current = next.id;
    setError('');
    setActive({ ...next, _fireAt: fireAt });
    try {
      playNotificationSound();
    } catch {
      /* ignore */
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    if (!selfId) return;
    try {
      const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const to = new Date(Date.now() + LOOKAHEAD_MS).toISOString();
      const res = await api(
        `/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&kind=task`,
      );
      const rows = Array.isArray(res?.data) ? res.data : [];
      eventsRef.current = rows.filter((row) => row?.kind === 'task' && row?.status === 'open');
      pickDue();
    } catch {
      /* non-blocking */
    }
  }, [selfId, pickDue]);

  useEffect(() => {
    if (authLoading || !selfId) return undefined;
    refreshEvents();
    const poll = window.setInterval(refreshEvents, POLL_MS);
    const tick = window.setInterval(pickDue, TICK_MS);
    const onFocus = () => {
      refreshEvents();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [authLoading, selfId, refreshEvents, pickDue]);

  const clearActive = () => {
    activeIdRef.current = '';
    setActive(null);
    setBusy(false);
    setError('');
    window.setTimeout(pickDue, 0);
  };

  const patchEvent = async (body) => {
    if (!active?.id) return;
    setBusy(true);
    setError('');
    try {
      const res = await api(`/calendar/events/${active.id}`, {
        method: 'PATCH',
        body,
      });
      const updated = res?.data;
      if (updated?.id) {
        eventsRef.current = eventsRef.current
          .map((row) => (row.id === updated.id ? { ...row, ...updated } : row))
          .filter((row) => row.status === 'open');
      } else {
        await refreshEvents();
      }
      clearActive();
    } catch (err) {
      setError(err?.message || 'Unable to update reminder');
      setBusy(false);
    }
  };

  const handleConfirm = () => patchEvent({ status: 'done' });
  const handleRefuse = () => patchEvent({ status: 'cancelled' });
  const handleSnooze = () => {
    const nextReminder = new Date(Date.now() + SNOOZE_MS).toISOString();
    return patchEvent({ reminderAt: nextReminder });
  };

  if (!active) return null;

  return (
    <ModalShell
      open
      title="Upcoming To-Do"
      closeOnOverlayClick={false}
      onClose={() => {}}
      overlayClassName="modal-overlay tylo-cal-reminder-overlay"
      panelClassName="modal-card tylo-cal-reminder-card"
    >
      <div className="tylo-cal-reminder-body">
        <p className="tylo-cal-reminder-eyebrow">Starts in about 5 minutes</p>
        <h3 className="tylo-cal-reminder-title">{active.title}</h3>
        <p className="tylo-cal-reminder-when">{formatWhen(active.startAt)}</p>
        {active.body ? <p className="tylo-cal-reminder-note">{active.body}</p> : null}
        {error ? (
          <p className="tylo-cal-reminder-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="tylo-cal-reminder-actions">
        <Button type="button" variant="secondary" disabled={busy} onClick={handleSnooze}>
          Snooze 5 min
        </Button>
        <Button type="button" variant="danger" disabled={busy} onClick={handleRefuse}>
          Refuse
        </Button>
        <Button type="button" variant="primary" loading={busy} disabled={busy} onClick={handleConfirm}>
          Confirm
        </Button>
      </div>
    </ModalShell>
  );
}
