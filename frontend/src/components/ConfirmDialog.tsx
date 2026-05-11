interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onCancel }: Props) {
  return (
    <div
      className="anim-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="anim-spring"
        style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 18, padding: '24px 24px 20px', width: 320, textAlign: 'center' }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 22, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            className="btn-press"
            style={{ flex: 1, padding: '11px 0', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--t1)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >{cancelLabel}</button>
          <button
            onClick={onConfirm}
            className="btn-press"
            style={{ flex: 1, padding: '11px 0', background: danger ? '#ef4444' : 'var(--accent)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
