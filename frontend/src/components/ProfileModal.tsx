import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { IconX, IconCamera, IconEdit } from './icons';
import api from '../api';

interface Props { onClose: () => void; }

export default function ProfileModal({ onClose }: Props) {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('File too large (max 10MB)'); return; }

    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/users/me/avatar', fd);
      updateUser(data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed');
      setAvatarPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!displayName.trim() || !username.trim() || !email.trim()) {
      setError('Fill all fields'); return;
    }
    setSaving(true);
    setError('');
    try {
      const { data } = await api.patch('/users/me', { display_name: displayName, username, email });
      updateUser(data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = avatarPreview || user?.avatar_url || null;

  return (
    <div
      className="anim-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="anim-spring"
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          width: 380,
          padding: '28px 28px 24px',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'var(--bg-3)', border: 'none', color: 'var(--t2)',
            borderRadius: 8, width: 30, height: 30, display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
          className="btn-press"
        ><IconX /></button>

        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 24 }}>Edit Profile</div>

        {/* Avatar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative' }}>
            <Avatar
              username={user?.username || ''}
              displayName={user?.display_name}
              color={user?.avatar_color || '#6366f1'}
              avatarUrl={avatarSrc}
              size={80}
              onClick={handleAvatarClick}
            />
            <div
              onClick={handleAvatarClick}
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', cursor: 'pointer', opacity: 0,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0'}
            >
              {uploading ? (
                <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              ) : <IconCamera />}
            </div>
            <input ref={fileRef} type="file" accept="image/*,.gif" style={{ display: 'none' }} onChange={handleFile} />
          </div>
        </div>

        {error && (
          <div style={{
            fontSize: 13, color: '#ef4444',
            background: 'rgba(239,68,68,0.1)', borderRadius: 8,
            padding: '8px 12px', marginBottom: 14,
          }}>{error}</div>
        )}

        {[
          { label: 'Display Name', value: displayName, set: setDisplayName, placeholder: 'Your name' },
          { label: 'Username', value: username, set: setUsername, placeholder: '@username' },
          { label: 'Email', value: email, set: setEmail, placeholder: 'you@email.com' },
        ].map(({ label, value, set, placeholder }) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 6 }}>{label}</div>
            <input
              value={value}
              onChange={e => set(e.target.value)}
              placeholder={placeholder}
              style={{
                width: '100%', padding: '9px 12px',
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--t1)', fontSize: 14, outline: 'none',
              }}
            />
          </div>
        ))}

        <button
          onClick={save}
          disabled={saving}
          className="btn-press"
          style={{
            width: '100%', padding: '11px 0', marginTop: 4,
            background: 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >{saving ? 'Saving...' : 'Save Changes'}</button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
