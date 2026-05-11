import { useRef, useState } from 'react';
import { IconX } from './icons';
import api from '../api';
import type { Channel } from '../types';

interface Props {
  onClose: () => void;
  onCreate: (c: Channel) => void;
}

export default function CreateChannelModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      if (desc.trim()) fd.append('description', desc.trim());
      const { data } = await api.post('/channels/', fd);
      onCreate(data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="anim-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="anim-spring" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 18, padding: '22px 24px 24px', width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>Create Channel</div>
          <button onClick={onClose} className="btn-press" style={{ background: 'var(--bg-3)', border: 'none', color: 'var(--t2)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><IconX /></button>
        </div>
        {error && <div style={{ fontSize: 13, color: '#ef4444', background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>{error}</div>}
        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginBottom: 5 }}>Channel Name</div>
            <input
              value={name} onChange={e => setName(e.target.value)} placeholder="My Channel" required
              style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', color: 'var(--t1)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginBottom: 5 }}>Description <span style={{ fontWeight: 400, color: 'var(--t3)' }}>(optional)</span></div>
            <input
              value={desc} onChange={e => setDesc(e.target.value)} placeholder="About this channel…"
              style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', color: 'var(--t1)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit" disabled={loading || !name.trim()} className="btn-press"
            style={{ width: '100%', padding: '11px 0', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Creating…' : 'Create Channel'}
          </button>
        </form>
      </div>
    </div>
  );
}
