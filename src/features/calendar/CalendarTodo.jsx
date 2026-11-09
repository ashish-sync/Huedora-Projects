import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import { formatTime, TIME_ZONE } from '../../shared/dateFormat.js';
import './calendarTodo.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_COMPACT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

function addOneHour(timeStr) {
  const [hh, mm] = String(timeStr || '09:00').split(':').map(Number);
  const total = ((hh || 0) * 60 + (mm || 0) + 60) % (24 * 60);
  const nextH = String(Math.floor(total / 60)).padStart(2, '0');
  const nextM = String(total % 60).padStart(2, '0');
  return `${nextH}:${nextM}`;
}

function formatMonthTitle(date) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: TIME_ZONE, month: 'long', year: 'numeric' }).format(date);
}

function formatDayHeading(date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function personLabel(person) {
  if (!person) return '';
  return person.fullName || person.name || 'Colleague';
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
  title: '',
  note: '',
  date: toDateInputValue(selectedDate),
  time: '09:00',
  peerUserId: '',
});

function ChevronLeft() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M10 3 5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 3 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon({ spinning }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? 'tylo-cal-spin' : ''}
      aria-hidden="true"
    >
      <path d="M13.5 8A5.5 5.5 0 1 1 12 4.1L13.5 2.5" />
      <path d="M13.5 6V2.5H10" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M8 3v10M3 8h10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  const weekdayLabels = compact ? WEEKDAYS_COMPACT : WEEKDAYS;

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
    for (const list of map.values()) {
      list.sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
    }
    return map;
  }, [events]);

  const selectedKey = toDateInputValue(selectedDate);
  const dayEvents = eventsByDay.get(selectedKey) || [];
  const pendingForMe = dayEvents.filter((event) => event.canRespond);
  const today = new Date();

  const openCreate = (date = selectedDate) => {
    setSelectedDate(date);
    setCursor(startOfMonth(date));
    setForm(emptyForm(date));
    setFormOpen(true);
  };

  const handleDayClick = (day) => {
    setSelectedDate(day);
    if (compact) openCreate(day);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const startAt = combineDateAndTime(form.date, form.time);
      const endAt = combineDateAndTime(form.date, addOneHour(form.time));
      await api('/calendar/events', {
        method: 'POST',
        body: {
          kind: 'task',
          title: form.title.trim(),
          body: form.note.trim(),
          startAt,
          endAt,
          reminderAt: startAt,
          peerUserId: form.peerUserId || undefined,
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

  const goPrevMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNextMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setCursor(startOfMonth(now));
    setSelectedDate(now);
  };

  return (
    <div className={'tylo-cal' + (compact ? ' tylo-cal--compact' : '')}>
      <div className="tylo-cal-toolbar">
        <div className="tylo-cal-nav">
          <button type="button" className="tylo-cal-nav-btn" onClick={goPrevMonth} aria-label="Previous month">
            <ChevronLeft />
          </button>
          <h3 className="tylo-cal-month">{formatMonthTitle(cursor)}</h3>
          <button type="button" className="tylo-cal-nav-btn" onClick={goNextMonth} aria-label="Next month">
            <ChevronRight />
          </button>
        </div>
        <div className="tylo-cal-toolbar-actions">
          <button
            type="button"
            className="tylo-cal-icon-btn tylo-cal-refresh-btn"
            onClick={refresh}
            disabled={loading}
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshIcon spinning={loading} />
          </button>
          <button
            type="button"
            className="tylo-cal-primary-btn tylo-cal-add-btn"
            onClick={() => openCreate(selectedDate)}
            title="Add item"
            aria-label="Add"
          >
            <PlusIcon />
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
            {weekdayLabels.map((day, index) => (
              <span key={`${WEEKDAYS[index]}-${index}`} title={WEEKDAYS[index]}>
                {day}
              </span>
            ))}
          </div>
          <div className="tylo-cal-grid" role="grid" aria-label={formatMonthTitle(cursor)}>
            {monthCells.map((day, index) => {
              if (!day) return <div key={`pad-${index}`} className="tylo-cal-cell is-empty" />;
              const key = toDateInputValue(day);
              const dayItems = eventsByDay.get(key) || [];
              const isSelected = sameDay(day, selectedDate);
              const isToday = sameDay(day, today);
              const visibleItems = dayItems.slice(0, compact ? 2 : 3);
              const overflow = dayItems.length - visibleItems.length;
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
                  onClick={() => handleDayClick(day)}
                  aria-label={
                    dayItems.length
                      ? `${formatDayHeading(day)}, ${dayItems.length} item${dayItems.length === 1 ? '' : 's'}`
                      : formatDayHeading(day)
                  }
                >
                  <span className="tylo-cal-day-num">{day.getDate()}</span>
                  <span className="tylo-cal-cell-events" aria-hidden="true">
                    {visibleItems.map((item) => (
                      <span
                        key={item.id}
                        className={'tylo-cal-chip tylo-cal-chip--' + (item.kind || 'task') + (item.status === 'done' ? ' is-done' : '')}
                        title={item.title}
                      >
                        {formatTime(item.startAt) ? `${formatTime(item.startAt)} ` : ''}
                        {item.title}
                      </span>
                    ))}
                    {overflow > 0 ? <span className="tylo-cal-chip-more">+{overflow}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {!compact ? (
          <div className="tylo-cal-day-panel">
            <div className="tylo-cal-day-head">
              <div>
                <h4>{formatDayHeading(selectedDate)}</h4>
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
                <span>Click a date or Add to create an entry.</span>
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
                    ) : null}
                    <div className="tylo-cal-event-copy">
                      <strong>{item.title}</strong>
                      <small>
                        {formatTime(item.startAt)}
                        {item.participants?.length
                          ? ` · ${item.participants.map((p) => personLabel(p)).join(', ')}`
                          : item.owner && item.ownerId !== selfId
                            ? ` · from ${personLabel(item.owner)}`
                            : ''}
                      </small>
                      {item.body ? <p>{item.body}</p> : null}
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
        ) : null}
      </div>

      {formOpen ? (
        <div className="tylo-cal-modal" role="dialog" aria-modal="true" aria-label="Create calendar item">
          <form className="tylo-cal-modal-card" onSubmit={handleCreate}>
            <div className="tylo-cal-modal-head">
              <div>
                <h4>Add entry</h4>
                <p className="tylo-cal-modal-date">{formatDayHeading(new Date(`${form.date}T12:00:00`))}</p>
              </div>
              <button type="button" className="tylo-cal-nav-btn" onClick={() => setFormOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            <label className="tylo-cal-field">
              <span>Title</span>
              <input
                required
                maxLength={160}
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="What needs to happen?"
                autoFocus
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

            <div className="tylo-cal-field-row tylo-cal-field-row--two">
              <label className="tylo-cal-field">
                <span>Time</span>
                <input
                  type="time"
                  required
                  value={form.time}
                  onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))}
                />
              </label>
              <label className="tylo-cal-field">
                <span>Colleague</span>
                <select
                  value={form.peerUserId}
                  onChange={(e) => setForm((prev) => ({ ...prev, peerUserId: e.target.value }))}
                >
                  <option value="">Optional</option>
                  {directory.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName}
                      {person.designation ? ` · ${person.designation}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

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
              <button type="button" className="tylo-cal-nav-btn" onClick={() => setSuggestFor(null)} aria-label="Close">
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
