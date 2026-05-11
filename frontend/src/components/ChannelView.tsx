import { useEffect, useRef, useState } from 'react';
import type { Channel, Post, PostComment, User } from '../types';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { IconPaperclip, IconSend, IconX, IconFile, IconDownload, IconSearch, IconMic, IconStop, IconPlay } from './icons';
import { formatFileSize, formatDate, formatDuration } from '../utils/time';
import api from '../api';

interface Props {
  channel: Channel;
  onChannelUpdate: (c: Channel) => void;
  wsSend: (data: object) => void;
}

const IconEye = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconRepost = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
);
const IconComment = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}
function groupByDate(posts: Post[]) {
  const groups: { date: string; items: Post[] }[] = [];
  let last = '';
  for (const p of posts) {
    const d = new Date(p.created_at).toDateString();
    if (d !== last) { groups.push({ date: p.created_at, items: [] }); last = d; }
    groups[groups.length - 1].items.push(p);
  }
  return groups;
}

export default function ChannelView({ channel, onChannelUpdate, wsSend }: Props) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postText, setPostText] = useState('');
  const [postFile, setPostFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const isOwner = user?.id === channel.owner_id;

  useEffect(() => {
    setLoading(true);
    api.get(`/channels/${channel.id}/posts`)
      .then(r => { setPosts(r.data); })
      .finally(() => setLoading(false));
  }, [channel.id]);

  // Scroll to bottom when posts load or new post added
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts, loading]);

  const handleSubscribe = async () => {
    if (channel.is_subscribed && channel.owner_id !== user?.id) {
      await api.delete(`/channels/${channel.id}/subscribe`);
    } else {
      await api.post(`/channels/${channel.id}/subscribe`);
    }
    const r = await api.get(`/channels/${channel.id}`);
    onChannelUpdate(r.data);
  };

  const handleRepost = async (postId: number) => {
    await api.post(`/channels/${channel.id}/posts/${postId}/repost`);
  };

  const submitPost = async () => {
    if (!postText.trim() && !postFile) return;
    setPosting(true);
    try {
      const fd = new FormData();
      if (postText.trim()) fd.append('content', postText.trim());
      if (postFile) fd.append('file', postFile);
      const { data } = await api.post(`/channels/${channel.id}/posts`, fd);
      setPosts(prev => [...prev, data]);
      setPostText('');
      setPostFile(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.overflowY = 'hidden';
      }
    } finally {
      setPosting(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPostText(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    ta.style.overflowY = ta.scrollHeight > 120 ? 'auto' : 'hidden';
  };

  // Voice recording
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
          if (dur > 0) fd.append('content', `🎤 Voice message (${formatDuration(dur)})`);
          const { data } = await api.post(`/channels/${channel.id}/posts`, fd);
          setPosts(prev => [...prev, data]);
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

  const groups = groupByDate(posts);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', minWidth: 0 }}>

      {/* Header */}
      <div style={{ height: 46, padding: '0 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: channel.avatar_url ? 'transparent' : channel.avatar_color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', fontSize: 13, fontWeight: 700, color: '#fff',
        }}>
          {channel.avatar_url
            ? <img src={`http://localhost:8000${channel.avatar_url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : channel.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{channel.name}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>{fmt(channel.subscriber_count)} subscribers</div>
        </div>
        {!isOwner && (
          <button onClick={handleSubscribe} className="btn-press" style={{
            background: channel.is_subscribed ? 'var(--bg-3)' : 'var(--accent)',
            color: channel.is_subscribed ? 'var(--t2)' : '#fff',
            border: 'none', borderRadius: 8, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {channel.is_subscribed ? 'Unsubscribe' : 'Subscribe'}
          </button>
        )}
      </div>

      {/* Posts */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading && <div style={{ color: 'var(--t3)', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading…</div>}
        {!loading && posts.length === 0 && (
          <div style={{ color: 'var(--t3)', fontSize: 13, textAlign: 'center', padding: 40 }}>
            {isOwner ? 'No posts yet. Create the first one!' : 'No posts yet.'}
          </div>
        )}

        {groups.map(group => (
          <div key={group.date}>
            {/* Date label */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 8px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', background: 'var(--bg-2)', padding: '3px 11px', borderRadius: 99 }}>
                {formatDate(group.date)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.items.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  channel={channel}
                  isOwner={isOwner}
                  onRepost={handleRepost}
                  wsSend={wsSend}
                />
              ))}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Voice recording bar */}
      {recording && (
        <div className="anim-slide-up" style={{ minHeight: 44, padding: '0 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="anim-rec-pulse" style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--t1)', flex: 1, fontVariantNumeric: 'tabular-nums' }}>
            Recording {formatDuration(recDuration)}
          </span>
          <button onClick={cancelRec} className="btn-press" style={{ background: 'var(--bg-3)', border: 'none', color: 'var(--t2)', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          <button onClick={stopRec} className="btn-press" style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: 8, padding: '5px 13px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Send</button>
        </div>
      )}

      {/* Compose — owner only, same structure as chat input */}
      {isOwner && !recording && (
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-1)', flexShrink: 0 }}>
          {postFile && (
            <div style={{ padding: '6px 11px 0', display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--bg-2)', borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--t2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{postFile.name}</span>
                <button onClick={() => setPostFile(null)} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', display: 'flex', padding: 0 }}><IconX /></button>
              </div>
            </div>
          )}
          <div style={{ minHeight: 44, padding: '0 11px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <button onClick={() => fileInputRef.current?.click()} className="btn-press" title="Attach file" style={iconBtnStyle}>
              <IconPaperclip />
            </button>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => { setPostFile(e.target.files?.[0] || null); e.target.value = ''; }} />
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Write a post…"
              value={postText}
              onChange={handleInput}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitPost(); } }}
              style={{
                flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '6px 10px', color: 'var(--t1)', fontSize: 13,
                outline: 'none', resize: 'none', maxHeight: 120, lineHeight: 1.45, overflowY: 'hidden',
                fontFamily: 'inherit',
              }}
            />
            <button onClick={startRec} className="btn-press" title="Voice message" style={iconBtnStyle}><IconMic /></button>
            <button
              onClick={submitPost} disabled={posting || (!postText.trim() && !postFile)} className="btn-press"
              style={{ ...iconBtnStyle, background: (postText.trim() || postFile) ? 'var(--accent)' : 'none', color: (postText.trim() || postFile) ? '#fff' : 'var(--t3)', cursor: (postText.trim() || postFile) ? 'pointer' : 'default', transition: 'background 0.15s, color 0.15s' }}
            ><IconSend /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function PostCard({ post, channel, isOwner, onRepost, wsSend }: {
  post: Post; channel: Channel; isOwner: boolean;
  onRepost: (id: number) => void;
  wsSend: (data: object) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [localPost, setLocalPost] = useState(post);
  const [showForward, setShowForward] = useState(false);
  const [contacts, setContacts] = useState<User[]>([]);
  const [fwQuery, setFwQuery] = useState('');
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => { setLocalPost(post); }, [post]);

  const toggleComments = async () => {
    if (!showComments && comments.length === 0) {
      setLoadingComments(true);
      const { data } = await api.get(`/channels/${channel.id}/posts/${post.id}/comments`);
      setComments(data);
      setLoadingComments(false);
    }
    setShowComments(v => !v);
  };

  const sendComment = async () => {
    if (!commentText.trim()) return;
    const fd = new FormData();
    fd.append('content', commentText.trim());
    const { data } = await api.post(`/channels/${channel.id}/posts/${post.id}/comments`, fd);
    setComments(prev => [...prev, data]);
    setCommentText('');
    setLocalPost(prev => ({ ...prev, comment_count: prev.comment_count + 1 }));
  };

  const openForward = async () => {
    if (contacts.length === 0) {
      const { data } = await api.get('/users/');
      setContacts(data);
    }
    setFwQuery('');
    setShowForward(true);
  };

  const forwardTo = async (u: User) => {
    setShowForward(false);
    // Format: __FWD_CH__:channelId:channelName\ncontent
    const fwdHeader = `__FWD_CH__:${channel.id}:${channel.name}`;
    const content = localPost.content ? `${fwdHeader}\n${localPost.content}` : fwdHeader;
    wsSend({
      type: 'message',
      receiver_id: u.id,
      content,
      message_type: localPost.file_type === 'image' ? 'image'
        : localPost.file_type === 'video' ? 'video'
        : localPost.file_url ? 'file' : 'text',
      file_url: localPost.file_url,
      file_name: localPost.file_name,
      file_size: localPost.file_size,
    });
    onRepost(localPost.id);
    setLocalPost(p => ({ ...p, reposts: p.reposts + 1 }));
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const base = 'http://localhost:8000';
  const filteredContacts = contacts.filter(u =>
    (u.display_name || u.username).toLowerCase().includes(fwQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{ maxWidth: '70%', minWidth: 120, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>

        {/* Content */}
        {localPost.content && (
          <div style={{ padding: '10px 14px 6px', fontSize: 14, lineHeight: 1.55, color: 'var(--t1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {localPost.content}
          </div>
        )}

        {/* Image */}
        {localPost.file_url && localPost.file_type === 'image' && (
          <img src={`${base}${localPost.file_url}`} style={{ width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block' }} />
        )}
        {/* Video */}
        {localPost.file_url && localPost.file_type === 'video' && (
          <video controls src={`${base}${localPost.file_url}`} style={{ width: '100%', maxHeight: 360, display: 'block' }} />
        )}
        {/* Audio */}
        {localPost.file_url && localPost.file_type === 'audio' && (
          <div style={{ margin: localPost.content ? '0 14px 8px' : '10px 14px 8px', padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={toggleAudio} className="btn-press" style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {playing ? <IconStop /> : <IconPlay />}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ height: 3, background: 'var(--bg-4)', borderRadius: 99 }}>
                <div style={{ height: '100%', width: '100%', background: 'var(--accent)', borderRadius: 99, opacity: 0.5 }} />
              </div>
            </div>
            <audio ref={audioRef} src={`${base}${localPost.file_url}`} onEnded={() => setPlaying(false)} style={{ display: 'none' }} />
          </div>
        )}
        {/* File */}
        {localPost.file_url && localPost.file_type === 'file' && (
          <div style={{ margin: localPost.content ? '0 14px 8px' : '10px 14px 8px', padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t2)', flexShrink: 0 }}><IconFile /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{localPost.file_name}</div>
              {localPost.file_size && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{formatFileSize(localPost.file_size)}</div>}
            </div>
            <a href={`${base}${localPost.file_url}`} download={localPost.file_name} style={{ color: 'var(--t2)', display: 'flex' }}><IconDownload /></a>
          </div>
        )}

        {/* Stats bar: views · repost · comments ─── time */}
        <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--t3)' }}>
            <IconEye />{fmt(localPost.views)}
          </span>
          <button onClick={openForward} className="btn-press"
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--t2)', padding: 0 }}>
            <IconRepost />{fmt(localPost.reposts)}
          </button>
          <button onClick={toggleComments} className="btn-press"
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: showComments ? 'var(--accent)' : 'var(--t2)', padding: 0 }}>
            <IconComment />{localPost.comment_count}
          </button>
          {/* Time pushed to right */}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t3)', whiteSpace: 'nowrap' }}>
            {fmtTime(localPost.created_at)}
          </span>
        </div>

        {/* Comments */}
        {showComments && (
          <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-0)' }}>
            <div style={{ maxHeight: 240, overflowY: 'auto', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loadingComments && <div style={{ fontSize: 12, color: 'var(--t3)' }}>Loading…</div>}
              {comments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 8 }}>
                  <Avatar username={c.author.username} displayName={c.author.display_name} color={c.author.avatar_color} avatarUrl={c.author.avatar_url} size={22} />
                  <div style={{ background: 'var(--bg-2)', borderRadius: '10px 10px 10px 2px', padding: '6px 10px', maxWidth: '85%' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>{c.author.display_name || c.author.username}</div>
                    <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.4 }}>{c.content}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3 }}>{fmtTime(c.created_at)}</div>
                  </div>
                </div>
              ))}
              {!loadingComments && comments.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', padding: 8 }}>No comments yet</div>
              )}
            </div>
            <div style={{ padding: '6px 14px 10px', display: 'flex', gap: 6 }}>
              <input placeholder="Comment…" value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendComment(); }}
                style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', color: 'var(--t1)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              />
              <button onClick={sendComment} disabled={!commentText.trim()} className="btn-press"
                style={{ width: 28, height: 28, borderRadius: 7, background: commentText.trim() ? 'var(--accent)' : 'var(--bg-3)', color: commentText.trim() ? '#fff' : 'var(--t3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconSend />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Forward dialog */}
      {showForward && (
        <div className="anim-overlay" onClick={() => setShowForward(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
          <div className="anim-spring" onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 18, width: '100%', maxWidth: 320, overflow: 'hidden' }}>
            <div style={{ padding: '14px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Forward to…</div>
              <button onClick={() => setShowForward(false)} className="btn-press"
                style={{ background: 'var(--bg-3)', border: 'none', color: 'var(--t2)', borderRadius: 7, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <IconX />
              </button>
            </div>
            <div style={{ padding: '0 10px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 10px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input autoFocus placeholder="Search…" value={fwQuery} onChange={e => setFwQuery(e.target.value)}
                  style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: 13, flex: 1 }} />
              </div>
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {filteredContacts.length === 0 && <div style={{ padding: 16, fontSize: 13, color: 'var(--t3)', textAlign: 'center' }}>No contacts</div>}
              {filteredContacts.map(u => (
                <div key={u.id} onClick={() => forwardTo(u)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <Avatar username={u.username} displayName={u.display_name} color={u.avatar_color} avatarUrl={u.avatar_url} size={32} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{u.display_name || u.username}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
