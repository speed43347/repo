import { useEffect, useRef, useState, useCallback } from 'react';
import type { Group, GroupMessage, User } from '../types';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { IconSend, IconPaperclip, IconMic, IconStop, IconMoreV, IconCheckDouble, IconCheck, IconPlay, IconDownload, IconFile, IconLive, IconX } from './icons';
import { formatLastSeen, formatDate, formatDuration, formatFileSize } from '../utils/time';
import api from '../api';

interface Props {
  group: Group;
  newGroupMessage: GroupMessage | null;
  wsSend: (data: object) => void;
  groupTyping: Record<number, Record<number, boolean>>; // groupId -> userId -> bool
  groupLiveTexts: Record<number, Record<number, string>>; // groupId -> userId -> text
}

export default function GroupChatWindow({ group, newGroupMessage, wsSend, groupTyping, groupLiveTexts }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [text, setText] = useState('');
  const [liveMode, setLiveMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages([]);
    api.get(`/groups/${group.id}/messages`).then(r => setMessages(r.data));
  }, [group.id]);

  useEffect(() => {
    if (!newGroupMessage || newGroupMessage.group_id !== group.id) return;
    setMessages(prev => {
      if (prev.find(m => m.id === newGroupMessage.id)) return prev;
      return [...prev, newGroupMessage];
    });
  }, [newGroupMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!liveMode) return;
    wsSend({ type: 'group_live_type', group_id: group.id, text });
  }, [text, liveMode]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (!liveMode) {
      wsSend({ type: 'group_typing', group_id: group.id, is_typing: true });
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => wsSend({ type: 'group_typing', group_id: group.id, is_typing: false }), 1500);
    }
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    ta.style.overflowY = ta.scrollHeight > 120 ? 'auto' : 'hidden';
  };

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    wsSend({ type: 'group_message', group_id: group.id, content: trimmed, message_type: 'text' });
    setText('');
    wsSend({ type: 'group_typing', group_id: group.id, is_typing: false });
    if (liveMode) wsSend({ type: 'group_live_type', group_id: group.id, text: '' });
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.overflowY = 'hidden';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const uploadFile = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post(`/groups/${group.id}/upload`, fd);
      wsSend({ type: 'group_message', group_id: group.id, content: '', message_type: data.message_type, file_url: data.file_url, file_name: data.file_name, file_size: data.file_size });
    } catch (err) { console.error('Upload failed', err); }
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
    for (const file of Array.from(e.dataTransfer.files)) await uploadFile(file);
  };

  const startRec = async () => {
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
          const { data } = await api.post(`/groups/${group.id}/upload`, fd);
          wsSend({ type: 'group_message', group_id: group.id, content: '', message_type: 'audio', file_url: data.file_url, file_name: data.file_name, file_size: data.file_size, duration: dur });
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

  const iconBtnStyle: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
    background: 'none', border: 'none', color: 'var(--t2)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  const typingUsers = Object.entries(groupTyping[group.id] || {})
    .filter(([uid, val]) => val && parseInt(uid) !== user?.id)
    .map(([uid]) => group.members.find(m => m.id === parseInt(uid)));

  const liveEntries = Object.entries(groupLiveTexts[group.id] || {})
    .filter(([uid, txt]) => txt && parseInt(uid) !== user?.id);

  // Group messages by date
  const groups_: { date: string; items: GroupMessage[] }[] = [];
  let lastDate = '';
  for (const m of messages) {
    const d = new Date(m.created_at).toDateString();
    if (d !== lastDate) { groups_.push({ date: m.created_at, items: [] }); lastDate = d; }
    groups_[groups_.length - 1].items.push(m);
  }

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

      {/* Header */}
      <div style={{ height: 46, padding: '0 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: group.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
          {group.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{group.name}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>{group.member_count} members</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {groups_.map(grp => (
          <div key={grp.date}>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 8px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', background: 'var(--bg-2)', padding: '3px 11px', borderRadius: 99 }}>
                {formatDate(grp.date)}
              </span>
            </div>
            {grp.items.map((msg, i) => {
              const isMine = msg.sender_id === user?.id;
              const showName = !isMine && (i === 0 || grp.items[i - 1].sender_id !== msg.sender_id);
              return (
                <GroupMessageBubble
                  key={msg.id}
                  msg={msg}
                  isMine={isMine}
                  showSenderName={showName}
                />
              );
            })}
          </div>
        ))}

        {/* Typing */}
        {typingUsers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginTop: 4 }} className="anim-msg">
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>
              {typingUsers.map(u => u?.display_name || u?.username).filter(Boolean).join(', ')} typing...
            </div>
          </div>
        )}

        {/* Live typing */}
        {liveEntries.map(([uid, txt]) => {
          const u = group.members.find(m => m.id === parseInt(uid));
          return (
            <div key={uid} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 4 }} className="anim-msg">
              {u && <Avatar username={u.username} displayName={u.display_name} color={u.avatar_color} avatarUrl={u.avatar_url} size={24} />}
              <div style={{ padding: '8px 12px', borderRadius: '14px 14px 14px 4px', background: 'var(--bg-2)', maxWidth: '60%', fontSize: 14, color: 'var(--t1)', lineHeight: 1.45, wordBreak: 'break-word' }}>
                {txt}
                <span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--accent)', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite' }} />
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Voice recording bar */}
      {recording && (
        <div className="anim-slide-up" style={{ minHeight: 44, padding: '0 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="anim-rec-pulse" style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--t1)', flex: 1, fontVariantNumeric: 'tabular-nums' }}>Recording {formatDuration(recDuration)}</span>
          <button onClick={cancelRec} className="btn-press" style={{ background: 'var(--bg-3)', border: 'none', color: 'var(--t2)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          <button onClick={stopRec} className="btn-press" style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Send</button>
        </div>
      )}

      {/* Input */}
      {!recording && (
        <div style={{ minHeight: 44, padding: '0 11px', borderTop: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <button onClick={() => fileInputRef.current?.click()} className="btn-press" title="Attach file" style={iconBtnStyle}><IconPaperclip /></button>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Message…"
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '6px 10px', color: 'var(--t1)', fontSize: 13,
              outline: 'none', resize: 'none', maxHeight: 120, lineHeight: 1.45, overflowY: 'hidden',
            }}
          />
          <button onClick={() => setLiveMode(v => !v)} className="btn-press" title="Live typing" style={{ ...iconBtnStyle, color: liveMode ? 'var(--accent)' : 'var(--t2)' }}><IconLive /></button>
          <button onClick={startRec} className="btn-press" title="Voice message" style={iconBtnStyle}><IconMic /></button>
          <button
            onClick={send} disabled={!text.trim()} className="btn-press"
            style={{ ...iconBtnStyle, background: text.trim() ? 'var(--accent)' : 'none', color: text.trim() ? '#fff' : 'var(--t3)', cursor: text.trim() ? 'pointer' : 'default', transition: 'background 0.15s, color 0.15s' }}
          ><IconSend /></button>
        </div>
      )}

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}

function GroupMessageBubble({ msg, isMine, showSenderName }: { msg: GroupMessage; isMine: boolean; showSenderName: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const bubbleBg = isMine ? 'var(--accent)' : 'var(--bg-2)';
  const textColor = isMine ? '#fff' : 'var(--t1)';
  const timeColor = isMine ? 'rgba(255,255,255,0.6)' : 'var(--t3)';
  const br = isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px';
  const base = 'http://localhost:8000';
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const timeRow = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, marginTop: 2 }}>
      <span style={{ fontSize: 10.5, color: timeColor, whiteSpace: 'nowrap' }}>{formatTime(msg.created_at)}</span>
    </div>
  );

  return (
    <div className="anim-msg" style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8, marginBottom: 2 }}>
      {!isMine && (
        <div style={{ width: 26, flexShrink: 0 }}>
          {showSenderName && <Avatar username={msg.sender.username} displayName={msg.sender.display_name} color={msg.sender.avatar_color} avatarUrl={msg.sender.avatar_url} size={26} />}
        </div>
      )}
      <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
        {showSenderName && !isMine && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 2, paddingLeft: 2 }}>
            {msg.sender.display_name || msg.sender.username}
          </div>
        )}

        {msg.message_type === 'image' && msg.file_url && (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src={`${base}${msg.file_url}`} style={{ maxWidth: 240, maxHeight: 180, borderRadius: 12, objectFit: 'cover', display: 'block', border: '1px solid var(--border)' }} />
          </div>
        )}
        {msg.message_type === 'video' && msg.file_url && (
          <video controls src={`${base}${msg.file_url}`} style={{ maxWidth: 240, borderRadius: 12, display: 'block' }} />
        )}
        {msg.message_type === 'audio' && msg.file_url && (
          <div style={{ padding: '8px 12px 6px', background: bubbleBg, borderRadius: br, minWidth: 180 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={toggleAudio} className="btn-press" style={{ width: 32, height: 32, borderRadius: '50%', background: isMine ? 'rgba(255,255,255,0.25)' : 'var(--bg-3)', border: 'none', color: textColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {playing ? <IconStop /> : <IconPlay />}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ height: 3, background: isMine ? 'rgba(255,255,255,0.3)' : 'var(--bg-4)', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: '100%', background: textColor, borderRadius: 99, opacity: 0.5 }} />
                </div>
                <div style={{ fontSize: 11, color: textColor, opacity: 0.7, marginTop: 3 }}>{formatDuration(msg.duration || 0)}</div>
              </div>
              <audio ref={audioRef} src={`${base}${msg.file_url}`} onEnded={() => setPlaying(false)} style={{ display: 'none' }} />
            </div>
            {timeRow}
          </div>
        )}
        {msg.message_type === 'file' && msg.file_url && (
          <div style={{ padding: '10px 12px 6px', background: bubbleBg, borderRadius: br }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: isMine ? 'rgba(255,255,255,0.2)' : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textColor, flexShrink: 0 }}><IconFile /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.file_name || 'File'}</div>
                {msg.file_size && <div style={{ fontSize: 11, color: textColor, opacity: 0.7 }}>{formatFileSize(msg.file_size)}</div>}
              </div>
              <a href={`${base}${msg.file_url}`} download={msg.file_name} style={{ color: textColor, display: 'flex' }}><IconDownload /></a>
            </div>
            {timeRow}
          </div>
        )}
        {msg.message_type === 'text' && msg.content && (
          <div style={{ padding: '7px 11px 5px 11px', borderRadius: br, background: bubbleBg, color: textColor, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.content}</span>
            {timeRow}
          </div>
        )}
      </div>
    </div>
  );
}
