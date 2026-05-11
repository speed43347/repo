import { useEffect, useState } from 'react';
import type { User } from '../types';
import Avatar from './Avatar';
import { IconSearch, IconX } from './icons';
import api from '../api';

interface Props {
  onClose: () => void;
  onSelect: (user: User) => void;
  onlineIds: Set<number>;
}

export default function CreateChatModal({ onClose, onSelect, onlineIds }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/users/').then(r => setUsers(r.data));
  }, []);

  const filtered = users.filter(u =>
    (u.display_name || u.username).toLowerCase().includes(query.toLowerCase()) ||
    u.username.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="anim-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="anim-spring" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 18, width: '100%', maxWidth: 360, overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>New Chat</div>
          <button onClick={onClose} className="btn-press" style={{ background: 'var(--bg-3)', border: 'none', color: 'var(--t2)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><IconX /></button>
        </div>

        <div style={{ padding: '0 12px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 11px' }}>
            <span style={{ color: 'var(--t3)', display: 'flex' }}><IconSearch /></span>
            <input
              placeholder="Search contacts…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: 13, flex: 1 }}
            />
          </div>
        </div>

        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '20px 16px', fontSize: 13, color: 'var(--t3)', textAlign: 'center' }}>No contacts found</div>
          )}
          {filtered.map(u => {
            const isOnline = onlineIds.has(u.id);
            const name = u.display_name || u.username;
            return (
              <div
                key={u.id}
                onClick={() => { onSelect(u); onClose(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <Avatar username={u.username} displayName={u.display_name} color={u.avatar_color} avatarUrl={u.avatar_url} size={36} online={isOnline} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>@{u.username}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
