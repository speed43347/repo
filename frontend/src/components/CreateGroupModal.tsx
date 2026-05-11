import { useEffect, useState } from 'react';
import type { User } from '../types';
import Avatar from './Avatar';
import { IconX } from './icons';
import api from '../api';

interface Props {
  onClose: () => void;
  onCreate: (groupId: number) => void;
  onlineIds: Set<number>;
}

export default function CreateGroupModal({ onClose, onCreate, onlineIds }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/users/').then(r => setUsers(r.data));
  }, []);

  const toggle = (id: number) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const submit = async () => {
    if (!name.trim() || selected.size === 0) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('member_ids', Array.from(selected).join(','));
      const { data } = await api.post('/groups/', fd);
      onCreate(data.id);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="anim-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="anim-spring" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 18, width: '100%', maxWidth: 380, overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>New Group</div>
          <button onClick={onClose} className="btn-press" style={{ background: 'var(--bg-3)', border: 'none', color: 'var(--t2)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><IconX /></button>
        </div>

        <div style={{ padding: '0 14px 10px' }}>
          <input
            autoFocus
            placeholder="Group name…"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', color: 'var(--t1)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ padding: '0 14px 6px', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Add members ({selected.size} selected)
        </div>

        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          {users.map(u => {
            const isSel = selected.has(u.id);
            return (
              <div key={u.id} onClick={() => toggle(u.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', transition: 'background 0.1s', background: isSel ? 'rgba(99,102,241,0.08)' : 'transparent' }}
                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
                onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Avatar username={u.username} displayName={u.display_name} color={u.avatar_color} avatarUrl={u.avatar_url} size={36} online={onlineIds.has(u.id)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{u.display_name || u.username}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>@{u.username}</div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: isSel ? 'var(--accent)' : 'transparent',
                  border: `2px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s', flexShrink: 0,
                }}>
                  {isSel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '10px 14px 14px' }}>
          <button
            onClick={submit}
            disabled={loading || !name.trim() || selected.size === 0}
            className="btn-press"
            style={{ width: '100%', padding: '11px 0', background: (name.trim() && selected.size > 0) ? 'var(--accent)' : 'var(--bg-3)', color: (name.trim() && selected.size > 0) ? '#fff' : 'var(--t3)', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}
          >
            {loading ? 'Creating…' : `Create Group (${selected.size + 1} members)`}
          </button>
        </div>
      </div>
    </div>
  );
}
