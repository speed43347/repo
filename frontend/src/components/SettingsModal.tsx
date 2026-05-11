import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { IconX, IconSun, IconMoon } from './icons';

interface Props { onClose: () => void; }

const ACCENTS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

export default function SettingsModal({ onClose }: Props) {
  const { theme, setTheme } = useTheme();
  const [notif, setNotif] = useState(true);
  const [compact, setCompact] = useState(false);
  const [accent, setAccent] = useState(() => {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6366f1';
  });

  const applyAccent = (c: string) => {
    setAccent(c);
    document.documentElement.style.setProperty('--accent', c);
    localStorage.setItem('accent', c);
  };

  return (
    <div
      className="anim-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)',
        padding: '20px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="anim-spring"
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          width: '100%',
          maxWidth: 480,
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '20px 24px 28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>Settings</div>
          <button
            onClick={onClose}
            className="btn-press"
            style={{
              background: 'var(--bg-3)', border: 'none', color: 'var(--t2)',
              borderRadius: 8, width: 30, height: 30, display: 'flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          ><IconX /></button>
        </div>

        {/* Theme */}
        <Section label="Appearance">
          <div style={{ display: 'flex', gap: 10 }}>
            {(['dark', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className="btn-press"
                style={{
                  flex: 1, padding: '10px 0',
                  background: theme === t ? 'var(--accent)' : 'var(--bg-2)',
                  color: theme === t ? '#fff' : 'var(--t2)',
                  border: `1px solid ${theme === t ? 'transparent' : 'var(--border)'}`,
                  borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {t === 'dark' ? <IconMoon /> : <IconSun />}
                {t === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
        </Section>

        {/* Accent */}
        <Section label="Accent Color">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {ACCENTS.map(c => (
              <button
                key={c}
                onClick={() => applyAccent(c)}
                style={{
                  width: 32, height: 32, borderRadius: '50%', background: c, border: 'none',
                  cursor: 'pointer', outline: accent === c ? `3px solid ${c}` : 'none',
                  outlineOffset: 2, transition: 'transform 0.15s, outline 0.15s',
                  transform: accent === c ? 'scale(1.15)' : 'scale(1)',
                }}
                className="btn-press"
              />
            ))}
          </div>
        </Section>

        {/* Toggles */}
        <Section label="Preferences">
          <Toggle label="Notifications" value={notif} onChange={setNotif} />
          <Toggle label="Compact messages" value={compact} onChange={setCompact} />
        </Section>

        {/* About */}
        <Section label="About">
          <div style={{
            padding: '12px 14px', background: 'var(--bg-2)',
            borderRadius: 12, fontSize: 13, color: 'var(--t2)',
          }}>
            <div style={{ fontWeight: 700, color: 'var(--t1)', marginBottom: 4, fontSize: 15 }}>Repa</div>
            <div>Version 1.0.0 · Built with FastAPI + React</div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 14, color: 'var(--t1)' }}>{label}</span>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 40, height: 22, borderRadius: 11, position: 'relative',
          background: value ? 'var(--accent)' : 'var(--bg-3)',
          cursor: 'pointer', transition: 'background 0.2s',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: value ? 21 : 3,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
    </div>
  );
}
