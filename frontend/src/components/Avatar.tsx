interface Props {
  username: string;
  displayName?: string | null;
  color: string;
  avatarUrl?: string | null;
  size?: number;
  online?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function Avatar({ username, displayName, color, avatarUrl, size = 36, online, onClick, className }: Props) {
  const label = (displayName || username).charAt(0).toUpperCase();
  const fontSize = Math.round(size * 0.4);
  const dotSize = Math.round(size * 0.28);

  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }} className={className}>
      <div
        onClick={onClick}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: avatarUrl ? 'transparent' : color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize,
          fontWeight: 700,
          userSelect: 'none',
          cursor: onClick ? 'pointer' : 'default',
          overflow: 'hidden',
          transition: 'transform 0.15s ease, opacity 0.15s ease',
        }}
        onMouseEnter={onClick ? (e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; } : undefined}
        onMouseLeave={onClick ? (e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; } : undefined}
        onMouseDown={onClick ? (e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.92)'; } : undefined}
        onMouseUp={onClick ? (e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; } : undefined}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          label
        )}
      </div>
      {online !== undefined && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: online ? '#22c55e' : 'var(--t3)',
          border: `${Math.max(1, Math.round(dotSize * 0.25))}px solid var(--bg-1)`,
          transition: 'background 0.3s ease',
        }} />
      )}
    </div>
  );
}
