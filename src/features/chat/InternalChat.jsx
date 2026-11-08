import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import './internalChat.css';

function firstName(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts[0] || 'Colleague';
}

function formatTime(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function formatDayLabel(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(date, today)) return 'Today';
    if (sameDay(date, yesterday)) return 'Yesterday';
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return '';
  }
}

export default function InternalChat({ compact = false, onUnreadChange }) {
  const { user } = useAuth();
  const selfId = String(user?._id || user?.id || '');
  const [directory, setDirectory] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const threadEndRef = useRef(null);
  const composerRef = useRef(null);
  const searchInputRef = useRef(null);
  const pollRef = useRef(null);

  const activeConversation = useMemo(
    () => conversations.find((row) => row.id === activeId) || null,
    [conversations, activeId],
  );

  const searchQuery = search.trim().toLowerCase();
  const showPeople = Boolean(searchQuery) || conversations.length === 0;

  function focusPeopleSearch() {
    setMobileShowThread(false);
    searchInputRef.current?.focus();
  }

  const filteredDirectory = useMemo(() => {
    const openPeerIds = new Set(
      conversations.map((row) => row.peer?.id).filter(Boolean),
    );
    return directory
      .filter((person) => !openPeerIds.has(person.id))
      .filter((person) => {
        if (!searchQuery) return true;
        return `${person.fullName} ${person.designation} ${person.email}`.toLowerCase().includes(searchQuery);
      });
  }, [directory, conversations, searchQuery]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    return conversations.filter((row) => {
      const hay = `${row.peer?.fullName || ''} ${row.lastMessagePreview || ''}`.toLowerCase();
      return hay.includes(searchQuery);
    });
  }, [conversations, searchQuery]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, row) => sum + (Number(row.unreadCount) || 0), 0),
    [conversations],
  );

  useEffect(() => {
    onUnreadChange?.(unreadTotal);
  }, [unreadTotal, onUnreadChange]);

  const refreshLists = useCallback(async () => {
    setError('');
    try {
      const [dirRes, convRes] = await Promise.all([
        api('/chat/directory'),
        api('/chat/conversations'),
      ]);
      setDirectory(Array.isArray(dirRes?.data) ? dirRes.data : []);
      setConversations(Array.isArray(convRes?.data) ? convRes.data : []);
    } catch (err) {
      setError(err?.message || 'Unable to load messages');
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadThread = useCallback(async (conversationId, { silent = false } = {}) => {
    if (!conversationId) return;
    if (!silent) setLoadingThread(true);
    try {
      const res = await api(`/chat/conversations/${conversationId}/messages?page=1&limit=80`);
      setMessages(Array.isArray(res?.data) ? res.data : []);
      await api(`/chat/conversations/${conversationId}/read`, { method: 'POST' });
      setConversations((prev) =>
        prev.map((row) => (row.id === conversationId ? { ...row, unreadCount: 0 } : row)),
      );
    } catch (err) {
      if (!silent) setError(err?.message || 'Unable to load conversation');
    } finally {
      if (!silent) setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    refreshLists();
  }, [refreshLists]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return undefined;
    }
    loadThread(activeId);
    if (import.meta.env.MODE === 'test') return undefined;
    pollRef.current = window.setInterval(() => {
      loadThread(activeId, { silent: true });
      refreshLists();
    }, 8000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [activeId, loadThread, refreshLists]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages, activeId]);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const raw = el.scrollHeight;
    const next = Math.min(Math.max(raw, 32), 72);
    el.style.height = `${next}px`;
    el.style.overflowY = raw > 72 ? 'auto' : 'hidden';
  }, [draft]);

  const openConversation = async (conversation) => {
    setActiveId(conversation.id);
    setMobileShowThread(true);
  };

  const startChatWith = async (person) => {
    setError('');
    try {
      const res = await api('/chat/conversations', {
        method: 'POST',
        body: { peerUserId: person.id },
      });
      const conversation = res?.data;
      if (!conversation?.id) throw new Error('Could not start chat');
      setConversations((prev) => {
        const others = prev.filter((row) => row.id !== conversation.id);
        return [conversation, ...others];
      });
      setActiveId(conversation.id);
      setMobileShowThread(true);
      setSearch('');
    } catch (err) {
      setError(err?.message || 'Unable to start chat');
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await api(`/chat/conversations/${activeId}/messages`, {
        method: 'POST',
        body: { body: text },
      });
      const message = res?.data;
      if (message) {
        setMessages((prev) => [...prev, message]);
        setConversations((prev) => {
          const next = prev.map((row) =>
            row.id === activeId
              ? {
                  ...row,
                  lastMessageAt: message.createdAt,
                  lastMessagePreview: message.body,
                  lastSenderId: message.senderId,
                  unreadCount: 0,
                }
              : row,
          );
          next.sort((a, b) => String(b.lastMessageAt || '').localeCompare(String(a.lastMessageAt || '')));
          return next;
        });
      }
      setDraft('');
    } catch (err) {
      setError(err?.message || 'Unable to send message');
    } finally {
      setSending(false);
    }
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend(event);
    }
  };

  const peerFirst = firstName(activeConversation?.peer?.fullName);

  return (
    <div
      className={'tylo-chat' + (compact ? ' tylo-chat--compact' : '') + (mobileShowThread ? ' is-thread-open' : '')}
      data-unread={unreadTotal}
    >
      <aside className="tylo-chat-sidebar" aria-label="Conversations">
        <div className="tylo-chat-toolbar">
          <label className="tylo-chat-search">
            <span className="sr-only">Search people or chats</span>
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people"
              autoComplete="off"
            />
          </label>
        </div>

        {error ? (
          <div className="tylo-chat-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={refreshLists}>
              Retry
            </button>
          </div>
        ) : null}

        <div className="tylo-chat-lists">
          {loadingList ? (
            <div className="tylo-chat-empty">Loading…</div>
          ) : (
            <>
              <section className="tylo-chat-section" aria-label="Recent chats">
                <div className="tylo-chat-section-head">
                  <h4>Chats</h4>
                  {unreadTotal > 0 ? <span className="tylo-chat-unread-pill">{unreadTotal}</span> : null}
                </div>
                {filteredConversations.length ? (
                  <ul className="tylo-chat-people">
                    {filteredConversations.map((row) => {
                      const name = firstName(row.peer?.fullName);
                      const unread = Number(row.unreadCount) || 0;
                      return (
                        <li key={row.id}>
                          <button
                            type="button"
                            className={
                              'tylo-chat-person'
                              + (row.id === activeId ? ' is-active' : '')
                              + (unread ? ' has-unread' : '')
                            }
                            onClick={() => openConversation(row)}
                          >
                            <span className="tylo-chat-person-copy">
                              <strong>{name}</strong>
                              <small>{row.lastMessagePreview || 'No messages yet'}</small>
                            </span>
                            <span className="tylo-chat-person-meta">
                              <time dateTime={row.lastMessageAt || undefined}>{formatTime(row.lastMessageAt)}</time>
                              {unread > 0 ? <span className="tylo-chat-badge">{unread > 99 ? '99+' : unread}</span> : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="tylo-chat-empty">
                    {searchQuery ? 'No matching chats.' : 'No chats yet. Search for a colleague.'}
                  </div>
                )}
              </section>

              {showPeople ? (
                <section className="tylo-chat-section" aria-label="People">
                  <div className="tylo-chat-section-head">
                    <h4>People</h4>
                  </div>
                  {filteredDirectory.length ? (
                    <ul className="tylo-chat-people">
                      {filteredDirectory.map((person) => (
                        <li key={person.id}>
                          <button
                            type="button"
                            className="tylo-chat-person"
                            onClick={() => startChatWith(person)}
                          >
                            <span className="tylo-chat-person-copy">
                              <strong>{firstName(person.fullName)}</strong>
                              <small>Start chat</small>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="tylo-chat-empty">No matching colleagues.</div>
                  )}
                </section>
              ) : null}
            </>
          )}
        </div>
      </aside>

      <section className="tylo-chat-thread" aria-label="Conversation">
        {activeConversation ? (
          <>
            <header className="tylo-chat-thread-head">
              <button
                type="button"
                className="tylo-chat-back"
                onClick={() => setMobileShowThread(false)}
                aria-label="Back to chats"
              >
                ←
              </button>
              <div className="tylo-chat-thread-identity">
                <strong title={peerFirst}>{peerFirst}</strong>
              </div>
            </header>

            <div className="tylo-chat-thread-body" role="log" aria-live="polite">
              {loadingThread ? <div className="tylo-chat-empty">Loading messages…</div> : null}
              {!loadingThread && !messages.length ? (
                <div className="tylo-chat-thread-prompt">
                  <strong>Message {peerFirst}</strong>
                  <span>Say hello to start the conversation.</span>
                </div>
              ) : null}
              {messages.map((message, index) => {
                const mine = String(message.senderId) === selfId;
                const day = formatDayLabel(message.createdAt);
                const prevDay = index > 0 ? formatDayLabel(messages[index - 1].createdAt) : '';
                const showDay = day && day !== prevDay;
                return (
                  <div key={message.id}>
                    {showDay ? <div className="tylo-chat-day-chip">{day}</div> : null}
                    <div className={'tylo-chat-bubble-row' + (mine ? ' is-mine' : '')}>
                      <div className={'tylo-chat-bubble' + (mine ? ' is-mine' : '')}>
                        <p>{message.body}</p>
                        <time>{formatTime(message.createdAt)}</time>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={threadEndRef} />
            </div>

            <form className="tylo-chat-composer" onSubmit={handleSend}>
              <textarea
                ref={composerRef}
                rows={1}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Type a message"
                maxLength={4000}
                aria-label="Type a message"
                disabled={sending}
              />
              <button
                type="submit"
                className="tylo-chat-send"
                disabled={!draft.trim() || sending}
                aria-label="Send"
                title="Send"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M3.4 20.4 21 12 3.4 3.6 3 10.2 15 12 3 13.8z" />
                </svg>
              </button>
            </form>
          </>
        ) : (
          <div className="tylo-chat-thread-empty">
            <div className="tylo-chat-thread-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H7l-4 2.2.9-4.1A8.5 8.5 0 1 1 21 12z" />
              </svg>
            </div>
            <strong>Select a chat</strong>
            <span>Choose a conversation or search for a colleague.</span>
            <button
              type="button"
              className="tylo-chat-empty-cta"
              onClick={focusPeopleSearch}
            >
              Find people
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
