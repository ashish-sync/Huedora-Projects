import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import './calendarTodo.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_COMPACT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const KINDS = [
  { id: 'task', label: 'Task' },
  { id: 'block', label: 'Block calendar' },
  { id: 'availability_request', label: 'Request availability' },
];

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function combineDateAndTime(dateStr, timeStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const [hh, mm] = String(timeStr || '09:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0).toISOString();
}

function formatMonthTitle(date) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(date);
}

function formatTime(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch {
    return '';
  }
}

function kindLabel(kind) {
  return KINDS.find((row) => row.id === kind)?.label || kind;
}

function buildMonthCells(cursor) {
  const first = startOfMonth(cursor);
  const startPad = first.getDay();
  const daysInMonth = endOfMonth(cursor).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const emptyForm = (selectedDate) => ({
  kind: 'task',
  title: '',
  note: '',
  date: toDateInputValue(selectedDate),
  time: '09:00',
  endTime: '10:00',
  peerUserId: '',
});

export default function CalendarTodo({ compact = false, onBadgeChange }) {
  const { user } = useAuth();
  const selfId = String(user?._id || user?.id || '');
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(new Date()));
  const [suggestFor, setSuggestFor] = useState(null);
  const [suggestForm, setSuggestForm] = useState({ date: '', time: '11:00', endTime: '12:00', note: '' });

  const monthCells = useMemo(() => buildMonthCells(cursor), [cursor]);

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const from = startOfMonth(cursor).toISOString();
      const to = endOfMonth(cursor).toISOString();
      const [eventsRes, dirRes, summaryRes] = await Promise.all([
        api(`/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
        api('/calendar/directory'),
        api('/calendar/summary'),
      ]);
      setEvents(Array.isArray(eventsRes?.data) ? eventsRes.data : []);
      setDirectory(Array.isArray(dirRes?.data) ? dirRes.data : []);
      onBadgeChange?.(Number(summaryRes?.data?.badge) || 0);
    } catch (err) {
      const message = String(err?.message || '');
      const looksMissing =
        /not found/i.test(message) ||
        err?.status === 404 ||
        err?.code === 'NOT_FOUND';
      setError(
        looksMissing
          ? 'Calendar service is not available on this server yet. Restart Server or deploy to QA, then Retry.'
          : message || 'Unable to load calendar',
      );
    } finally {
      setLoading(false);
    }
  }, [cursor, onBadgeChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const event of events) {
      const key = toDateInputValue(new Date(event.startAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    }
    return map;
  }, [events]);

  const selectedKey = toDateInputValue(selectedDate);
  const dayEvents = eventsByDay.get(selectedKey) || [];
  const pendingForMe = dayEvents.filter((event) => event.canRespond);
  const today = new Date();

  const openCreate = (date = selectedDate) => {
    setSelectedDate(date);
    setForm(emptyForm(date));
    setFormOpen(true);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const startAt = combineDateAndTime(form.date, form.time);
      const endAt = combineDateAndTime(form.date, form.endTime || form.time);
      await api('/calendar/events', {
        method: 'POST',
        body: {
          kind: form.kind,
          title: form.title.trim(),
          body: form.note.trim(),
          startAt,
          endAt,
          reminderAt: form.kind === 'task' ? startAt : undefined,
          peerUserId: form.kind === 'task' ? undefined : form.peerUserId || undefined,
        },
      });
      setFormOpen(false);
      setForm(emptyForm(selectedDate));
      await refresh();
    } catch (err) {
      setError(err?.message || 'Unable to create event');
    } finally {
      setSaving(false);
    }
  };

  const toggleTaskDone = async (item) => {
    try {
      await api(`/calendar/events/${item.id}`, {
        method: 'PATCH',
        body: { status: item.status === 'done' ? 'open' : 'done' },
      });
      await refresh();
    } catch (err) {
      setError(err?.message || 'Unable to update task');
    }
  };

  const respond = async (item, action, extra = {}) => {
    try {
      await api(`/calendar/events/${item.id}/${action}`, {
        method: 'POST',
        body: extra,
      });
      setSuggestFor(null);
      await refresh();
    } catch (err) {
      setError(err?.message || 'Unable to respond');
    }
  };

  const submitSuggest = async (event) => {
    event.preventDefault();
    if (!suggestFor) return;
    const startAt = combineDateAndTime(suggestForm.date || selectedKey, suggestForm.time);
    const endAt = combineDateAndTime(suggestForm.date || selectedKey, suggestForm.endTime || suggestForm.time);
    await respond(suggestFor, 'suggest', {
      startAt,
      endAt,
      note: suggestForm.note,
    });
  };

  return (
    <div className={'tylo-cal' + (compact ? ' tylo-cal--compact' : '')}>
      <div className="tylo-cal-toolbar">
        <div className="tylo-cal-nav">
          <button type="button" className="tylo-cal-icon-btn" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month">
            ‹
          </button>
          <h3 className="tylo-cal-month">{formatMonthTitle(cursor)}</h3>
          <button type="button" className="tylo-cal-icon-btn" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month">
            ›
          </button>
        </div>
        <div className="tylo-cal-toolbar-actions">
          <button
            type="button"
            className="tylo-cal-text-btn"
            onClick={() => {
              const now = new Date();
              setCursor(startOfMonth(now));
              setSelectedDate(now);
            }}
          >
            Today
          </button>
          <button type="button" className="tylo-cal-primary-btn" onClick={() => openCreate(selectedDate)}>
            + Add
          </button>
        </div>
      </div>

      {error ? (
        <div className="tylo-cal-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={refresh}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="tylo-cal-layout">
        <div className="tylo-cal-grid-wrap">
          <div className="tylo-cal-weekdays">
            {(compact ? WEEKDAYS_COMPACT : WEEKDAYS).map((day, index) => (
              <span key={`${WEEKDAYS[index]}-${index}`} title={WEEKDAYS[index]}>{day}</span>
            ))}
          </div>
          <div className="tylo-cal-grid" role="grid" aria-label={formatMonthTitle(cursor)}>
            {monthCells.map((day, index) => {
              if (!day) return <div key={`pad-${index}`} className="tylo-cal-cell is-empty" />;
              const key = toDateInputValue(day);
              const dayItems = eventsByDay.get(key) || [];
              const isSelected = sameDay(day, selectedDate);
              const isToday = sameDay(day, today);
              return (
                <button
                  key={key}
                  type="button"
                  className={
                    'tylo-cal-cell' +
                    (isSelected ? ' is-selected' : '') +
                    (isToday ? ' is-today' : '') +
                    (dayItems.length ? ' has-events' : '')
                  }
                  onClick={() => setSelectedDate(day)}
                  onDoubleClick={() => openCreate(day)}
                  aria-label={
                    dayItems.length
                      ? `${day.getDate()}, ${dayItems.length} item${dayItems.length === 1 ? '' : 's'}`
                      : String(day.getDate())
                  }
                >
                  <span className="tylo-cal-day-num">{day.getDate()}</span>
                  <span className="tylo-cal-dots" aria-hidden="true">
                    {dayItems.slice(0, 3).map((item) => (
                      <i key={item.id} className={'tylo-cal-dot tylo-cal-dot--' + item.kind} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={'tylo-cal-day-panel' + (compact ? ' tylo-cal-day-panel--dock' : '')}>
          <div className="tylo-cal-day-head">
            <div>
              <h4>
                {new Intl.DateTimeFormat('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                }).format(selectedDate)}
              </h4>
              <p>{dayEvents.length ? `${dayEvents.length} item${dayEvents.length === 1 ? '' : 's'}` : 'No items'}</p>
            </div>
            <button type="button" className="tylo-cal-text-btn" onClick={() => openCreate(selectedDate)}>
              New
            </button>
          </div>

          {loading ? <div className="tylo-cal-empty">Loading…</div> : null}

          {!loading && !dayEvents.length ? (
            <div className="tylo-cal-empty">
              <strong>Free day</strong>
              <span>Add a task, block time, or request availability.</span>
            </div>
          ) : null}

          <ul className="tylo-cal-event-list">
            {dayEvents.map((item) => (
              <li key={item.id} className={'tylo-cal-event tylo-cal-event--' + item.kind + (item.status === 'done' ? ' is-done' : '')}>
                <div className="tylo-cal-event-main">
                  {item.kind === 'task' && item.canEdit ? (
                    <label className="tylo-cal-check">
                      <input
                        type="checkbox"
                        checked={item.status === 'done'}
                        onChange={() => toggleTaskDone(item)}
                      />
                      <span className="sr-only">Mark done</span>
                    </label>
                  ) : (
                    <span className={'tylo-cal-kind-chip tylo-cal-kind-chip--' + item.kind}>{kindLabel(item.kind)}</span>
                  )}
                  <div className="tylo-cal-event-copy">
                    <strong>{item.title}</strong>
                    <small>
                      {formatTime(item.startAt)}
                      {item.endAt && item.endAt !== item.startAt ? ` – ${formatTime(item.endAt)}` : ''}
                      {item.participants?.length
                        ? ` · ${item.participants.map((p) => p.fullName).join(', ')}`
                        : item.owner && item.ownerId !== selfId
                          ? ` · from ${item.owner.fullName}`
                          : ''}
                    </small>
                    {item.body ? <p>{item.body}</p> : null}
                    {item.status && item.kind !== 'task' ? (
                      <em className="tylo-cal-status">Status: {item.status}</em>
                    ) : null}
                    {item.suggestedStartAt ? (
                      <em className="tylo-cal-status">
                        Suggested: {formatTime(item.suggestedStartAt)} – {formatTime(item.suggestedEndAt)}
                      </em>
                    ) : null}
                  </div>
                </div>

                {item.canRespond ? (
                  <div className="tylo-cal-actions">
                    <button type="button" className="tylo-cal-accept" onClick={() => respond(item, 'accept')}>
                      Accept
                    </button>
                    <button type="button" className="tylo-cal-decline" onClick={() => respond(item, 'decline')}>
                      Decline
                    </button>
                    <button
                      type="button"
                      className="tylo-cal-suggest"
                      onClick={() => {
                        setSuggestFor(item);
                        setSuggestForm({
                          date: selectedKey,
                          time: '11:00',
                          endTime: '12:00',
                          note: '',
                        });
                      }}
                    >
                      Suggest alternative
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          {pendingForMe.length ? (
            <p className="tylo-cal-hint">{pendingForMe.length} availability request{pendingForMe.length === 1 ? '' : 's'} waiting for you</p>
          ) : null}
        </div>
      </div>

      {formOpen ? (
        <div className="tylo-cal-modal" role="dialog" aria-modal="true" aria-label="Create calendar item">
          <form className="tylo-cal-modal-card" onSubmit={handleCreate}>
            <div className="tylo-cal-modal-head">
              <h4>New schedule item</h4>
              <button type="button" className="tylo-cal-icon-btn" onClick={() => setFormOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="tylo-cal-kind-tabs" role="tablist">
              {KINDS.map((kind) => (
                <button
                  key={kind.id}
                  type="button"
                  role="tab"
                  aria-selected={form.kind === kind.id}
                  className={form.kind === kind.id ? 'is-active' : ''}
                  onClick={() => setForm((prev) => ({ ...prev, kind: kind.id }))}
                >
                  {kind.label}
                </button>
              ))}
            </div>

            <label className="tylo-cal-field">
              <span>Title</span>
              <input
                required
                maxLength={160}
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="What needs to happen?"
              />
            </label>

            <label className="tylo-cal-field">
              <span>Note</span>
              <textarea
                rows={2}
                maxLength={2000}
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Optional details"
              />
            </label>

            <div className="tylo-cal-field-row">
              <label className="tylo-cal-field">
                <span>Date</span>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </label>
              <label className="tylo-cal-field">
                <span>Start</span>
                <input
                  type="time"
                  required
                  value={form.time}
                  onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))}
                />
              </label>
              <label className="tylo-cal-field">
                <span>End</span>
                <input
                  type="time"
                  required
                  value={form.endTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                />
              </label>
            </div>

            {form.kind !== 'task' ? (
              <label className="tylo-cal-field">
                <span>Colleague</span>
                <select
                  required
                  value={form.peerUserId}
                  onChange={(e) => setForm((prev) => ({ ...prev, peerUserId: e.target.value }))}
                >
                  <option value="">Select colleague…</option>
                  {directory.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName}
                      {person.designation ? ` · ${person.designation}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="tylo-cal-hint">A reminder notification will fire at the start time.</p>
            )}

            <div className="tylo-cal-modal-actions">
              <button type="button" className="tylo-cal-text-btn" onClick={() => setFormOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="tylo-cal-primary-btn" disabled={saving || !form.title.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {suggestFor ? (
        <div className="tylo-cal-modal" role="dialog" aria-modal="true" aria-label="Suggest alternative time">
          <form className="tylo-cal-modal-card" onSubmit={submitSuggest}>
            <div className="tylo-cal-modal-head">
              <h4>Suggest alternative</h4>
              <button type="button" className="tylo-cal-icon-btn" onClick={() => setSuggestFor(null)} aria-label="Close">
                ×
              </button>
            </div>
            <p className="tylo-cal-hint">For “{suggestFor.title}”</p>
            <div className="tylo-cal-field-row">
              <label className="tylo-cal-field">
                <span>Date</span>
                <input
                  type="date"
                  required
                  value={suggestForm.date}
                  onChange={(e) => setSuggestForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </label>
              <label className="tylo-cal-field">
                <span>Start</span>
                <input
                  type="time"
                  required
                  value={suggestForm.time}
                  onChange={(e) => setSuggestForm((prev) => ({ ...prev, time: e.target.value }))}
                />
              </label>
              <label className="tylo-cal-field">
                <span>End</span>
                <input
                  type="time"
                  required
                  value={suggestForm.endTime}
                  onChange={(e) => setSuggestForm((prev) => ({ ...prev, endTime: e.target.value }))}
                />
              </label>
            </div>
            <label className="tylo-cal-field">
              <span>Note</span>
              <textarea
                rows={2}
                value={suggestForm.note}
                onChange={(e) => setSuggestForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Optional message"
              />
            </label>
            <div className="tylo-cal-modal-actions">
              <button type="button" className="tylo-cal-text-btn" onClick={() => setSuggestFor(null)}>
                Cancel
              </button>
              <button type="submit" className="tylo-cal-primary-btn">
                Send suggestion
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
