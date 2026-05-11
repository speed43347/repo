import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';
import { IconEye, IconEyeOff } from '../components/icons';
import repaLogo from '../assets/repa-logo.png';

type Mode = 'login' | 'register';

export default function AuthPage() {
  const { login } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const logoFilter = theme === 'dark' ? 'brightness(0) invert(1)' : 'brightness(0)';

  const [mode, setMode] = useState<Mode>('login');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        const { data } = await api.post('/auth/register', { display_name: displayName, username, email, password });
        login(data.access_token, data.user);
      } else {
        const { data } = await api.post('/auth/login', { username, password });
        login(data.access_token, data.user);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-0)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div className="anim-spring" style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '36px 32px 28px',
        width: '100%',
        maxWidth: 380,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <img src={repaLogo} alt="Repa" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'contain', flexShrink: 0, filter: logoFilter }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)', letterSpacing: -0.5, lineHeight: 1 }}>Repa</div>
            <div style={{ fontSize: 12, color: 'var(--t2)' }}>Messenger</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-2)', borderRadius: 12, padding: 3, marginBottom: 24, gap: 3 }}>
          {(['login', 'register'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className="btn-press"
              style={{
                flex: 1, padding: '9px 0', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: mode === m ? 'var(--bg-1)' : 'transparent',
                color: mode === m ? 'var(--t1)' : 'var(--t2)',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {m === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          {error && (
            <div className="anim-slide-up" style={{ fontSize: 13, color: '#ef4444', background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '9px 12px', marginBottom: 14 }}>
              {error}
            </div>
          )}

          {mode === 'register' && (
            <Field label="Display Name">
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" required />
            </Field>
          )}

          <Field label={mode === 'register' ? '@Username' : 'Username'}>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder={mode === 'register' ? 'your_handle' : 'username'} autoComplete="username" required />
          </Field>

          {mode === 'register' && (
            <Field label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
            </Field>
          )}

          <Field label="Password">
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'min 6 characters' : '••••••••'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                required
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', display: 'flex', padding: 2 }}
              >
                {showPw ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="btn-press"
            style={{
              width: '100%', padding: '12px 0', marginTop: 6,
              background: 'var(--accent)', color: '#fff', border: 'none',
              borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Loading...
              </span>
            ) : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'contents' }}>
        {/* inject styles for child input */}
      </div>
      <FieldInputWrapper>{children}</FieldInputWrapper>
    </div>
  );
}

function FieldInputWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        .field-wrap input {
          width: 100%; padding: 10px 13px;
          background: var(--bg-2); border: 1px solid var(--border);
          border-radius: 10px; color: var(--t1); font-size: 14px;
          outline: none; font-family: inherit; box-sizing: border-box;
          transition: border-color 0.15s;
        }
        .field-wrap input:focus { border-color: var(--accent); }
      `}</style>
      <div className="field-wrap">{children}</div>
    </div>
  );
}
