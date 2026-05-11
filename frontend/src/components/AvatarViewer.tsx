import { useEffect, useState } from 'react';
import type { User } from '../types';
import Avatar from './Avatar';
import { IconX } from './icons';

interface Props {
  user: User;
  onClose: () => void;
}

export default function AvatarViewer({ user, onClose }: Props) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, []);

  const name = user.display_name || user.username;

  return (
    <div
      className="anim-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(20px)',
        cursor: 'pointer',
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="btn-press"
        style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(255,255,255,0.12)', border: 'none',
          borderRadius: '50%', width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', cursor: 'pointer',
        }}
      ><IconX /></button>

      {/* Expand / Crop toggle */}
      {user.avatar_url && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          className="btn-press"
          title={expanded ? 'Crop to circle' : 'Show full photo'}
          style={{
            position: 'absolute', top: 20, left: 20,
            background: 'rgba(255,255,255,0.12)', border: 'none',
            borderRadius: 10, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 7,
            color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          {expanded ? (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
              </svg>
              Circle
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
              Full photo
            </>
          )}
        </button>
      )}

      {/* Photo */}
      <div
        className="anim-avatar-zoom"
        style={{ cursor: 'default' }}
        onClick={e => e.stopPropagation()}
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={name}
            style={{
              width: expanded ? 'min(80vw, 520px)' : 260,
              height: expanded ? 'auto' : 260,
              borderRadius: expanded ? 16 : '50%',
              objectFit: expanded ? 'contain' : 'cover',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
              transition: 'width 0.35s cubic-bezier(0.34,1.4,0.64,1), height 0.35s cubic-bezier(0.34,1.4,0.64,1), border-radius 0.35s cubic-bezier(0.34,1.4,0.64,1)',
              display: 'block',
            }}
          />
        ) : (
          <Avatar
            username={user.username}
            displayName={user.display_name}
            color={user.avatar_color}
            size={260}
          />
        )}
      </div>

      <div style={{ marginTop: 20, textAlign: 'center', cursor: 'default' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{name}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>@{user.username}</div>
      </div>
    </div>
  );
}
