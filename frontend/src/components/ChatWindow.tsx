import { useEffect, useRef, useState, useCallback } from 'react';
import type { User, Message } from '../types';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import AvatarViewer from './AvatarViewer';
import PeerProfilePopup from './PeerProfilePopup';
import { IconSend, IconPaperclip, IconMic, IconStop, IconMoreV, IconWallpaper, IconCheckDouble, IconCheck, IconPlay, IconDownload, IconFile, IconLive, IconX } from './icons';
import { formatLastSeen, formatDate, formatDuration, formatFileSize } from '../utils/time';
import api from '../api';

interface Props {
  peer: User | null;
  isOnline: boolean;
  isTyping: boolean;
  liveText: string;
  onSend: (content: string, type?: string, fileUrl?: string, fileName?: string, fileSize?: number, duration?: number) => void;
  onTyping: (t: boolean) => void;
  onLiveType: (text: string) => void;
  newMessage: Message | null;
  wsSend: (data: object) => void;
  peerWallpaper: { peerId: number; url: string | null } | null;
  onGoToChannel?: (channelId: number, channelName: string) => void;
}

export default function ChatWindow({ peer, isOnline, isTyping, liveText, onSend, onTyping, onLiveType, newMessage, wsSend, peerWallpaper, onGoToChannel }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [liveMode, setLiveMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [showPeerProfile, setShowPeerProfile] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load messages and wallpaper on peer change
  useEffect(() => {
    if (!peer) return;
    setMessages([]);
    setShowMenu(false);
    setShowPeerProfile(false);
    api.get(`/messages/${peer.id}`).then(r => setMessages(r.data));
    api.get(`/wallpaper/${peer.id}`).then(r => setWallpaper(r.data.url
      ? `http://localhost:8000${r.data.url}`
      : null
    ));
  }, [peer?.id]);

  // Real-time wallpaper update from peer
  useEffect(() => {
    if (!peerWallpaper || !peer || peerWallpaper.peerId !== peer.id) return;
    setWallpaper(peerWallpaper.url
      ? `http://localhost:8000${peerWallpaper.url}`
      : null
    );
  }, [peerWallpaper]);

  // New incoming/outgoing message
  useEffect(() => {
    if (!newMessage || !peer) return;
    const relevant =
      (newMessage.sender_id === peer.id && newMessage.receiver_id === user?.id) ||
      (newMessage.sender_id === user?.id && newMessage.receiver_id === peer.id);
    if (relevant) {
      setMessages(prev => {
        if (prev.find(m => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
    }
  }, [newMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, liveText]);

  // Live typing send
  useEffect(() => {
    if (!liveMode || !peer) return;
    onLiveType(text);
  }, [text, liveMode]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (!liveMode) {
      onTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => onTyping(false), 1500);
    }
    // Auto resize
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    ta.style.overflowY = ta.scrollHeight > 120 ? 'auto' : 'hidden';
  };

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || !peer) return;
    onSend(trimmed);
    setText('');
    onTyping(false);
    if (liveMode) onLiveType('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.overflowY = 'hidden';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // File upload
  const uploadFile = async (file: File) => {
    if (!peer) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/messages/upload', fd);
      onSend('', data.message_type, data.file_url, data.file_name, data.file_size);
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await uploadFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!peer) return;
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) await uploadFile(file);
  };

  // Voice recording
  const startRec = async () => {
    if (!peer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recChunks.current = [];
      mr.ondataavailable = e => recChunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recChunks.current, { type: 'audio/webm' });
        const dur = recDuration;
        setRecDuration(0);
        try {
          const fd = new FormData();
          fd.append('file', blob, 'voice.webm');
          const { data } = await api.post('/messages/upload', fd);
          onSend('', 'audio', data.file_url, data.file_name, data.file_size, dur);
        } catch (err) { console.error('Voice upload failed', err); }
      };
      mr.start();
      mediaRecorder.current = mr;
      setRecording(true);
      setRecDuration(0);
      recTimer.current = setInterval(() => setRecDuration(d => d + 1), 1000);
    } catch { alert('Microphone access denied'); }
  };

  const stopRec = () => {
    mediaRecorder.current?.stop();
    if (recTimer.current) clearInterval(recTimer.current);
    setRecording(false);
  };

  const cancelRec = () => {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.onstop = null;
      mediaRecorder.current.stop();
      mediaRecorder.current.stream?.getTracks().forEach(t => t.stop());
    }
    if (recTimer.current) clearInterval(recTimer.current);
    setRecording(false);
    setRecDuration(0);
  };

  // Wallpaper — stored on server, synced to peer via WS
  const handleWallpaper = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !peer) return;
    e.target.value = '';
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post(`/wallpaper/${peer.id}`, fd);
      const fullUrl = `http://localhost:8000${data.url}`;
      setWallpaper(fullUrl);
      setShowMenu(false);
      wsSend({ type: 'wallpaper_set', receiver_id: peer.id, url: data.url });
    } catch (err) {
      console.error('Wallpaper upload failed', err);
    }
  };

  const removeWallpaper = async () => {
    if (!peer) return;
    try {
      await api.delete(`/wallpaper/${peer.id}`);
      setWallpaper(null);
      setShowMenu(false);
      wsSend({ type: 'wallpaper_set', receiver_id: peer.id, url: null });
    } catch (err) {
      console.error('Remove wallpaper failed', err);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const groupByDate = (msgs: Message[]) => {
    const groups: { date: string; items: Message[] }[] = [];
    let last = '';
    for (const m of msgs) {
      const d = new Date(m.created_at).toDateString();
      if (d !== last) { groups.push({ date: m.created_at, items: [] }); last = d; }
      groups[groups.length - 1].items.push(m);
    }
    return groups;
  };

  const iconBtnStyle: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
    background: 'none', border: 'none', color: 'var(--t2)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  if (!peer) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)', color: 'var(--t3)', gap: 14 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t2)', marginBottom: 4 }}>No chat selected</div>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>Pick someone from the list</div>
        </div>
      </div>
    );
  }

  const groups = groupByDate(messages);
  const peerName = peer.display_name || peer.username;
  const hasBubble = !!liveText;

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', minWidth: 0, position: 'relative' }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(99,102,241,0.15)', border: '2px dashed var(--accent)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>Drop files to send</div>
        </div>
      )}

      {/* Header — height 46px matches sidebar Repa header */}
      <div style={{ height: 46, padding: '0 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 10, flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Avatar
            username={peer.username}
            displayName={peer.display_name}
            color={peer.avatar_color}
            avatarUrl={peer.avatar_url}
            size={28}
            online={isOnline}
            onClick={() => setShowAvatarViewer(true)}
          />
          {showPeerProfile && (
            <PeerProfilePopup
              user={peer}
              isOnline={isOnline}
              onClose={() => setShowPeerProfile(false)}
              onAvatarClick={() => { setShowPeerProfile(false); setShowAvatarViewer(true); }}
            />
          )}
        </div>

        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setShowPeerProfile(v => !v)}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{peerName}</div>
          <div style={{ fontSize: 12, color: isTyping || hasBubble ? 'var(--accent)' : isOnline ? '#22c55e' : 'var(--t3)', transition: 'color 0.2s' }}>
            {isTyping ? 'typing...' : hasBubble ? 'live typing...' : isOnline ? 'online' : formatLastSeen(peer.last_seen)}
          </div>
        </div>

        {/* Three-dot menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMenu(v => !v)}
            className="btn-press"
            style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', display: 'flex', padding: 6, borderRadius: 8 }}
          ><IconMoreV /></button>

          {showMenu && (
            <div
              className="anim-ctx"
              style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', minWidth: 180, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 50, marginTop: 4 }}
            >
              <MenuItem icon={<IconWallpaper />} label="Set Wallpaper" onClick={() => wallpaperInputRef.current?.click()} />
              {wallpaper && <MenuItem icon={<IconX />} label="Remove Wallpaper" onClick={removeWallpaper} />}
              <input ref={wallpaperInputRef} type="file" accept="image/*,.gif" style={{ display: 'none' }} onChange={handleWallpaper} />
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1, overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 2,
          backgroundImage: wallpaper ? `url(${wallpaper})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}
        onClick={() => { setShowMenu(false); setShowPeerProfile(false); }}
      >
        {groups.map(group => (
          <div key={group.date}>
            {/* Date label — no lines */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 8px' }}>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: wallpaper ? 'rgba(255,255,255,0.75)' : 'var(--t2)',
                background: wallpaper ? 'rgba(0,0,0,0.38)' : 'var(--bg-2)',
                padding: '3px 11px', borderRadius: 99,
              }}>
                {formatDate(group.date)}
              </span>
            </div>

            {group.items.map((msg, i) => {
              const isMine = msg.sender_id === user?.id;
              const showAv = !isMine && (i === 0 || group.items[i - 1].sender_id !== msg.sender_id);
              return (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isMine={isMine}
                  showAvatar={showAv}
                  peer={peer}
                  wallpaper={!!wallpaper}
                  onImgClick={setLightboxImg}
                  onAvatarClick={() => setShowAvatarViewer(true)}
                  onGoToChannel={onGoToChannel}
                />
              );
            })}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && !hasBubble && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 4 }} className="anim-msg">
            <Avatar username={peer.username} displayName={peer.display_name} color={peer.avatar_color} avatarUrl={peer.avatar_url} size={26} />
            <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: wallpaper ? 'rgba(0,0,0,0.5)' : 'var(--bg-2)', display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--t3)', animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {/* Live typing bubble */}
        {hasBubble && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 4 }} className="anim-msg">
            <Avatar username={peer.username} displayName={peer.display_name} color={peer.avatar_color} avatarUrl={peer.avatar_url} size={26} />
            <div style={{ padding: '8px 12px', borderRadius: '14px 14px 14px 4px', background: wallpaper ? 'rgba(0,0,0,0.5)' : 'var(--bg-2)', maxWidth: '60%', fontSize: 14, color: wallpaper ? '#fff' : 'var(--t1)', lineHeight: 1.45, wordBreak: 'break-word' }}>
              {liveText}
              <span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--accent)', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Voice recording bar */}
      {recording && (
        <div className="anim-slide-up" style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="anim-rec-pulse" style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: 'var(--t1)', flex: 1, fontVariantNumeric: 'tabular-nums' }}>
            Recording {formatDuration(recDuration)}
          </span>
          <button onClick={cancelRec} className="btn-press" style={{ background: 'var(--bg-3)', border: 'none', color: 'var(--t2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={stopRec} className="btn-press" style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Send</button>
        </div>
      )}

      {/* Input area */}
      {!recording && (
        <div style={{ minHeight: 44, padding: '0 11px', borderTop: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 5 }}>
          {/* Paperclip */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-press"
            title="Attach file"
            style={iconBtnStyle}
          ><IconPaperclip /></button>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />

          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Message..."
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '6px 10px', color: 'var(--t1)', fontSize: 13,
              outline: 'none', resize: 'none', maxHeight: 120, lineHeight: 1.45, overflowY: 'hidden',
            }}
          />

          {/* Live typing toggle — only color changes, no bg panel */}
          <button
            onClick={() => setLiveMode(v => !v)}
            className="btn-press"
            title="Live typing"
            style={{ ...iconBtnStyle, color: liveMode ? 'var(--accent)' : 'var(--t2)' }}
          ><IconLive /></button>

          {/* Mic */}
          <button
            onClick={startRec}
            className="btn-press"
            title="Voice message"
            style={iconBtnStyle}
          ><IconMic /></button>

          {/* Send — bg only when active */}
          <button
            onClick={send}
            disabled={!text.trim()}
            className="btn-press"
            style={{
              ...iconBtnStyle,
              background: text.trim() ? 'var(--accent)' : 'none',
              color: text.trim() ? '#fff' : 'var(--t3)',
              cursor: text.trim() ? 'pointer' : 'default',
              transition: 'background 0.15s, color 0.15s',
            }}
          ><IconSend /></button>
        </div>
      )}

      {/* Image lightbox */}
      {lightboxImg && (
        <div
          className="anim-overlay"
          onClick={() => setLightboxImg(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(20px)', cursor: 'zoom-out' }}
        >
          <img src={lightboxImg} style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain' }} className="anim-avatar-zoom" />
          <button onClick={() => setLightboxImg(null)} className="btn-press" style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
            <IconX />
          </button>
        </div>
      )}

      {showAvatarViewer && <AvatarViewer user={peer} onClose={() => setShowAvatarViewer(false)} />}

      <style>{`
        @keyframes dotBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; } 50% { opacity: 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ width: '100%', background: 'none', border: 'none', color: 'var(--t1)', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 500, textAlign: 'left', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
    >
      <span style={{ color: 'var(--t2)', display: 'flex' }}>{icon}</span>
      {label}
    </button>
  );
}

function parseFwd(content: string | null): { channelId: number | null; channelName: string | null; cleanContent: string | null } {
  if (!content?.startsWith('__FWD_CH__:')) return { channelId: null, channelName: null, cleanContent: content };
  const nl = content.indexOf('\n');
  const header = nl >= 0 ? content.slice(0, nl) : content;
  const rest = nl >= 0 ? content.slice(nl + 1) : '';
  const parts = header.split(':');
  const channelId = parseInt(parts[1] || '0');
  const channelName = parts.slice(2).join(':');
  return { channelId: isNaN(channelId) ? null : channelId, channelName: channelName || null, cleanContent: rest || null };
}

function MessageBubble({ msg, isMine, showAvatar, peer, wallpaper, onImgClick, onAvatarClick, onGoToChannel }: {
  msg: Message; isMine: boolean; showAvatar: boolean; peer: User; wallpaper: boolean;
  onImgClick: (url: string) => void; onAvatarClick: () => void;
  onGoToChannel?: (channelId: number, channelName: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const bubbleBg = isMine
    ? (wallpaper ? 'rgba(99,102,241,0.85)' : 'var(--accent)')
    : (wallpaper ? 'rgba(0,0,0,0.55)' : 'var(--bg-2)');

  const textColor = isMine ? '#fff' : (wallpaper ? '#fff' : 'var(--t1)');
  const timeColor = isMine ? 'rgba(255,255,255,0.6)' : (wallpaper ? 'rgba(255,255,255,0.55)' : 'var(--t3)');
  const checkColor = msg.is_read ? (isMine ? 'rgba(255,255,255,0.9)' : 'var(--accent)') : 'rgba(255,255,255,0.5)';
  const br = isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px';
  const fwd = parseFwd(msg.content);

  const timeEl = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, marginTop: 3 }}>
      <span style={{ fontSize: 10.5, color: timeColor, whiteSpace: 'nowrap' }}>{formatTime(msg.created_at)}</span>
      {isMine && <span style={{ color: checkColor, display: 'flex' }}>{msg.is_read ? <IconCheckDouble /> : <IconCheck />}</span>}
    </div>
  );

  const overlayTimeEl = (
    <div style={{ position: 'absolute', bottom: 6, right: 8, display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,0.45)', borderRadius: 10, padding: '1px 6px' }}>
      <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap' }}>{formatTime(msg.created_at)}</span>
      {isMine && <span style={{ color: 'rgba(255,255,255,0.92)', display: 'flex' }}>{msg.is_read ? <IconCheckDouble /> : <IconCheck />}</span>}
    </div>
  );

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <div
      className="anim-msg"
      style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8, marginBottom: 2 }}
    >
      {!isMine && (
        <div style={{ width: 26, flexShrink: 0 }}>
          {showAvatar && (
            <Avatar username={peer.username} displayName={peer.display_name} color={peer.avatar_color} avatarUrl={peer.avatar_url} size={26} onClick={onAvatarClick} />
          )}
        </div>
      )}

      {/* Wrapper shrinks to content via flex-column + non-stretch align */}
      <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
        {/* Image */}
        {msg.message_type === 'image' && msg.file_url && (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={msg.file_url}
              alt="image"
              onClick={() => onImgClick(msg.file_url!)}
              style={{ maxWidth: 240, maxHeight: 180, borderRadius: 12, objectFit: 'cover', cursor: 'zoom-in', display: 'block', border: '1px solid var(--border)' }}
            />
            {overlayTimeEl}
          </div>
        )}

        {/* Video */}
        {msg.message_type === 'video' && msg.file_url && (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <video controls src={msg.file_url} style={{ maxWidth: 240, borderRadius: 12, display: 'block' }} />
            {overlayTimeEl}
          </div>
        )}

        {/* Audio (voice) */}
        {msg.message_type === 'audio' && msg.file_url && (
          <div style={{ padding: '8px 12px 6px', background: bubbleBg, borderRadius: br, minWidth: 180 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={toggleAudio} className="btn-press" style={{ width: 32, height: 32, borderRadius: '50%', background: isMine ? 'rgba(255,255,255,0.25)' : 'var(--bg-3)', border: 'none', color: textColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {playing ? <IconStop /> : <IconPlay />}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ height: 3, background: isMine ? 'rgba(255,255,255,0.3)' : 'var(--bg-4)', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: '100%', background: textColor, borderRadius: 99, opacity: 0.5 }} />
                </div>
                <div style={{ fontSize: 11, color: textColor, opacity: 0.7, marginTop: 3 }}>
                  {formatDuration(msg.duration || 0)}
                </div>
              </div>
              <audio ref={audioRef} src={msg.file_url} onEnded={() => setPlaying(false)} style={{ display: 'none' }} />
            </div>
            {timeEl}
          </div>
        )}

        {/* File */}
        {msg.message_type === 'file' && msg.file_url && (
          <div style={{ padding: '10px 12px 6px', background: bubbleBg, borderRadius: br }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: isMine ? 'rgba(255,255,255,0.2)' : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textColor, flexShrink: 0 }}>
                <IconFile />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.file_name || 'File'}</div>
                {msg.file_size && <div style={{ fontSize: 11, color: textColor, opacity: 0.7 }}>{formatFileSize(msg.file_size)}</div>}
              </div>
              <a href={msg.file_url} download={msg.file_name} style={{ color: textColor, display: 'flex' }} onClick={e => e.stopPropagation()}>
                <IconDownload />
              </a>
            </div>
            {timeEl}
          </div>
        )}

        {/* Text — time right-aligned on its own row at bottom */}
        {msg.message_type === 'text' && msg.content && (
          <div style={{
            padding: fwd.channelId ? '5px 11px 5px 11px' : '7px 11px 5px 11px',
            borderRadius: br,
            background: bubbleBg, color: textColor,
            backdropFilter: wallpaper ? 'blur(10px)' : undefined,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Forwarded-from header */}
            {fwd.channelId && (
              <div
                onClick={() => onGoToChannel?.(fwd.channelId!, fwd.channelName!)}
                style={{
                  padding: '4px 0 6px',
                  borderBottom: `1px solid ${isMine ? 'rgba(255,255,255,0.2)' : 'var(--border)'}`,
                  marginBottom: 6,
                  cursor: onGoToChannel ? 'pointer' : 'default',
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.5)' : 'var(--t3)', lineHeight: 1 }}>Forwarded from</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isMine ? 'rgba(255,255,255,0.9)' : 'var(--accent)', lineHeight: 1.3 }}>{fwd.channelName}</div>
                </div>
              </div>
            )}
            {fwd.cleanContent && (
              <span style={{ fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>{fwd.cleanContent}</span>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, marginTop: 2 }}>
              <span style={{ fontSize: 10.5, color: timeColor, whiteSpace: 'nowrap' }}>{formatTime(msg.created_at)}</span>
              {isMine && <span style={{ color: checkColor, display: 'flex' }}>{msg.is_read ? <IconCheckDouble /> : <IconCheck />}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
