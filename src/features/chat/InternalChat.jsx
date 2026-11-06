import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import './internalChat.css';

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
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
  const pollRef = useRef(null);

  const activeConversation = useMemo(
    () => conversations.find((row) => row.id === activeId) || null,
    [conversations, activeId],
  );

  const filteredDirectory = useMemo(() => {
    const q = search.trim().toLowerCase();
    const openPeerIds = new Set(
      conversations.map((row) => row.peer?.id).filter(Boolean),
    );
    return directory
      .filter((person) => !openPeerIds.has(person.id))
      .filter((person) => {
        if (!q) return true;
        return `${person.fullName} ${person.designation} ${person.email}`.toLowerCase().includes(q);
      });
  }, [directory, conversations, search]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((row) => {
      const hay = `${row.peer?.fullName || ''} ${row.lastMessagePreview || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, search]);

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

  const peerName = activeConversation?.peer?.fullName || 'Colleague';
  const peerDesignation = activeConversation?.peer?.designation || '';

  return (
    <div
      className={'tylo-chat' + (compact ? ' tylo-chat--compact' : '') + (mobileShowThread ? ' is-thread-open' : '')}
      data-unread={unreadTotal}
    >
      <aside className="tylo-chat-sidebar" aria-label="Conversations">
        <div className="tylo-chat-sidebar-head">
          <div>
            <h3 className="tylo-chat-title">Messages</h3>
            <p className="tylo-chat-subtitle">Chat with TYLO ONE colleagues</p>
          </div>
          {unreadTotal > 0 ? <span className="tylo-chat-unread-pill">{unreadTotal}</span> : null}
        </div>

        <label className="tylo-chat-search">
          <span className="sr-only">Search colleagues or chats</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people or chats…"
          />
        </label>

        {error ? (
          <div className="tylo-chat-error" role="alert">
            {error}
            <button type="button" onClick={refreshLists}>
              Retry
            </button>
          </div>
        ) : null}

        <div className="tylo-chat-lists">
          {loadingList ? (
            <div className="tylo-chat-empty">Loading conversations…</div>
          ) : (
            <>
              <section className="tylo-chat-section" aria-label="Recent chats">
                <h4>Chats</h4>
                {filteredConversations.length ? (
                  <ul className="tylo-chat-people">
                    {filteredConversations.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          className={
                            'tylo-chat-person' + (row.id === activeId ? ' is-active' : '') + (row.unreadCount ? ' has-unread' : '')
                          }
                          onClick={() => openConversation(row)}
                        >
                          <span className="tylo-chat-avatar" aria-hidden="true">
                            {initials(row.peer?.fullName)}
                          </span>
                          <span className="tylo-chat-person-copy">
                            <strong>{row.peer?.fullName || 'Colleague'}</strong>
                            <small>{row.lastMessagePreview || 'No messages yet'}</small>
                          </span>
                          <span className="tylo-chat-person-meta">
                            <time>{formatTime(row.lastMessageAt)}</time>
                            {row.unreadCount > 0 ? <span className="tylo-chat-badge">{row.unreadCount}</span> : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="tylo-chat-empty">No chats yet. Start one below.</div>
                )}
              </section>

              <section className="tylo-chat-section" aria-label="Directory">
                <h4>People</h4>
                {filteredDirectory.length ? (
                  <ul className="tylo-chat-people">
                    {filteredDirectory.map((person) => (
                      <li key={person.id}>
                        <button type="button" className="tylo-chat-person" onClick={() => startChatWith(person)}>
                          <span className="tylo-chat-avatar" aria-hidden="true">
                            {initials(person.fullName)}
                          </span>
                          <span className="tylo-chat-person-copy">
                            <strong>{person.fullName}</strong>
                            <small>{person.designation || person.email || 'Colleague'}</small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="tylo-chat-empty">No matching colleagues.</div>
                )}
              </section>
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
              <span className="tylo-chat-avatar tylo-chat-avatar--lg" aria-hidden="true">
                {initials(peerName)}
              </span>
              <div className="tylo-chat-thread-identity">
                <strong>{peerName}</strong>
                <small>{peerDesignation || 'TYLO ONE'}</small>
              </div>
            </header>

            <div className="tylo-chat-thread-body" role="log" aria-live="polite">
              {loadingThread ? <div className="tylo-chat-empty">Loading messages…</div> : null}
              {!loadingThread && !messages.length ? (
                <div className="tylo-chat-empty">Say hello — start the conversation.</div>
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
              <input
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type a message"
                maxLength={4000}
                aria-label="Type a message"
                disabled={sending}
              />
              <button type="submit" className="tylo-chat-send" disabled={!draft.trim() || sending}>
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="tylo-chat-thread-empty">
            <strong>Select a colleague to start chatting</strong>
            <span>Messages stay inside TYLO ONE — private to your team.</span>
          </div>
        )}
      </section>
    </div>
  );
}
