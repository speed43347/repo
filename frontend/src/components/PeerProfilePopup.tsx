import { useEffect, useRef } from 'react';
import type { User } from '../types';
import Avatar from './Avatar';
import { formatLastSeen } from '../utils/time';

interface Props {
  user: User;
  isOnline: boolean;
  onClose: () => void;
  onAvatarClick: () => void;
  anchorRef?: React.RefObject<HTMLElement>;
}

export default function PeerProfilePopup({ user, isOnline, onClose, onAvatarClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const name = user.display_name || user.username;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      ref={ref}
      className="anim-spring"
      style={{
        position: 'absolute', top: '100%', left: 0, zIndex: 100,
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 16,
        width: 240,
        boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
        marginTop: 8,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Avatar
          username={user.username}
          displayName={user.display_name}
          color={user.avatar_color}
          avatarUrl={user.avatar_url}
          size={52}
          online={isOnline}
          onClick={onAvatarClick}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--t2)' }}>@{user.username}</div>
          <div style={{ fontSize: 12, marginTop: 2, color: isOnline ? '#22c55e' : 'var(--t3)' }}>
            {isOnline ? 'online' : formatLastSeen(user.last_seen)}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

      <div style={{ fontSize: 12, color: 'var(--t2)' }}>
        Joined {new Date(user.created_at).toLocaleDateString([], { year: 'numeric', month: 'long' })}
      </div>
    </div>
  );
}
