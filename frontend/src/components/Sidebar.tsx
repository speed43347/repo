import { useState, useEffect, useRef } from 'react';
import type { User, Message, Channel, Group } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Avatar from './Avatar';
import { IconSearch, IconSettings, IconLogout, IconChevronLeft, IconChevronRight } from './icons';
import { formatLastSeen, formatMsgTime } from '../utils/time';
import api from '../api';
import ProfileModal from './ProfileModal';
import SettingsModal from './SettingsModal';
import ConfirmDialog from './ConfirmDialog';
import CreateChannelModal from './CreateChannelModal';
import CreateChatModal from './CreateChatModal';
import CreateGroupModal from './CreateGroupModal';
import repaLogo from '../assets/repa-logo.png';

interface Props {
  selectedId: number | null;
  selectedChannelId: number | null;
  selectedGroupId: number | null;
  onSelect: (user: User) => void;
  onSelectChannel: (channel: Channel) => void;
  onSelectGroup: (group: Group) => void;
  onlineIds: Set<number>;
  lastSeenMap: Record<number, string>;
  lastMessages: Record<number, Message>;
  unread: Record<number, number>;
  channels: Channel[];
  onChannelsChange: (channels: Channel[]) => void;
  groups: Group[];
  onGroupsChange: (groups: Group[]) => void;
  lastGroupMessages: Record<number, { text: string; time: string }>;
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--t2)',
  cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 7, flexShrink: 0,
};

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconChannel = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l19-9-9 19-2-8-8-2z"/>
  </svg>
);

export default function Sidebar({
  selectedId, selectedChannelId, selectedGroupId, onSelect, onSelectChannel, onSelectGroup,
  onlineIds, lastSeenMap, lastMessages, unread,
  channels, onChannelsChange, groups, onGroupsChange, lastGroupMessages,
}: Props) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const plusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/users/').then(r => setUsers(r.data));
  }, []);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) setShowPlusMenu(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const q = query.toLowerCase();
  const filteredUsers = users.filter(u =>
    (u.display_name || u.username).toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
  );
  const filteredChannels = channels.filter(c => c.name.toLowerCase().includes(q));

  const logoFilter = theme === 'dark' ? 'brightness(0) invert(1)' : 'brightness(0)';

  return (
    <>
      <div style={{
        width: collapsed ? 56 : 272,
        minWidth: collapsed ? 56 : 272,
        height: '100%',
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* App header */}
        <div style={{
          height: 46, padding: collapsed ? '0 4px' : '0 6px 0 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 8,
          justifyContent: collapsed ? 'center' : 'flex-start',
          flexShrink: 0,
        }}>
          <img src={repaLogo} alt="Repa" style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'contain', flexShrink: 0, filter: logoFilter }} />
          {!collapsed && <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', letterSpacing: -0.5, flex: 1 }}>Repa</span>}
          <button onClick={() => setCollapsed(v => !v)} className="btn-press" style={iconBtn} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>

        {/* Search + Plus */}
        {!collapsed && (
          <div style={{ padding: '8px 10px 6px', display: 'flex', gap: 6, flexShrink: 0 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 10px' }}>
              <span style={{ color: 'var(--t3)', display: 'flex' }}><IconSearch /></span>
              <input
                placeholder="Search…" value={query} onChange={e => setQuery(e.target.value)}
                style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: 13, flex: 1 }}
              />
            </div>
            {/* Plus button */}
            <div ref={plusRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowPlusMenu(v => !v)}
                className="btn-press"
                style={{ width: 34, height: 34, borderRadius: 10, background: showPlusMenu ? 'var(--accent)' : 'var(--bg-2)', border: '1px solid var(--border)', color: showPlusMenu ? '#fff' : 'var(--t2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              ><IconPlus /></button>
              {showPlusMenu && (
                <div className="anim-ctx" style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 50 }}>
                  <PlusMenuItem icon={<IconChannel />} label="Create Channel" onClick={() => { setShowPlusMenu(false); setShowCreateChannel(true); }} />
                  <PlusMenuItem icon={<IconChannel />} label="New Chat" onClick={() => { setShowPlusMenu(false); setShowCreateChat(true); }} />
                  <PlusMenuItem icon={<IconChannel />} label="New Group" onClick={() => { setShowPlusMenu(false); setShowCreateGroup(true); }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Channels section */}
          {filteredChannels.length > 0 && !collapsed && (
            <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Channels</div>
          )}
          {filteredChannels.map(ch => {
            const isSel = selectedChannelId === ch.id;
            return (
              <div
                key={`ch-${ch.id}`}
                onClick={() => onSelectChannel(ch)}
                title={collapsed ? ch.name : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: collapsed ? 0 : 10, padding: collapsed ? '6px 0' : '8px 12px',
                  cursor: 'pointer',
                  background: isSel ? 'var(--bg-2)' : 'transparent',
                  borderLeft: `2px solid ${isSel ? 'var(--accent)' : 'transparent'}`,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
                onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ width: collapsed ? 34 : 40, height: collapsed ? 34 : 40, borderRadius: collapsed ? 10 : 12, flexShrink: 0, background: ch.avatar_url ? 'transparent' : ch.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                  {ch.avatar_url ? <img src={`http://localhost:8000${ch.avatar_url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ch.name.charAt(0).toUpperCase()}
                </div>
                {!collapsed && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{ch.subscriber_count} subscribers</div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Groups section */}
          {groups.filter(g => g.name.toLowerCase().includes(q)).length > 0 && !collapsed && (
            <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Groups</div>
          )}
          {groups.filter(g => g.name.toLowerCase().includes(q)).map(g => {
            const isSel = selectedGroupId === g.id;
            const lastGM = lastGroupMessages[g.id];
            return (
              <div key={`g-${g.id}`} onClick={() => onSelectGroup(g)}
                title={collapsed ? g.name : undefined}
                style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : 10, padding: collapsed ? '6px 0' : '9px 12px', cursor: 'pointer', background: isSel ? 'var(--bg-2)' : 'transparent', borderLeft: `2px solid ${isSel ? 'var(--accent)' : 'transparent'}`, transition: 'background 0.1s' }}
                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
                onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ width: collapsed ? 34 : 40, height: collapsed ? 34 : 40, borderRadius: collapsed ? 10 : 12, flexShrink: 0, background: g.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                  {g.name.charAt(0).toUpperCase()}
                </div>
                {!collapsed && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                      {lastGM && <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, marginLeft: 4 }}>{lastGM.time}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lastGM ? lastGM.text : <span style={{ color: 'var(--t3)' }}>{g.member_count} members</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Chats section */}
          {filteredUsers.length > 0 && (filteredChannels.length > 0 || groups.length > 0) && !collapsed && (
            <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Chats</div>
          )}
          {filteredUsers.length === 0 && filteredChannels.length === 0 && groups.length === 0 && !collapsed && (
            <div style={{ padding: '20px 14px', fontSize: 13, color: 'var(--t3)', textAlign: 'center' }}>No results</div>
          )}
          {filteredUsers.map((u, idx) => {
            const last = lastMessages[u.id];
            const count = unread[u.id] || 0;
            const isOnline = onlineIds.size > 0 ? onlineIds.has(u.id) : u.is_online;
            const isSel = selectedId === u.id;
            const name = u.display_name || u.username;
            const lastSeenIso = lastSeenMap[u.id] || u.last_seen;
            return (
              <div
                key={u.id} onClick={() => onSelect(u)} className="anim-fade"
                title={collapsed ? name : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: collapsed ? 0 : 10, padding: collapsed ? '6px 0' : '9px 12px',
                  cursor: 'pointer',
                  background: isSel ? 'var(--bg-2)' : 'transparent',
                  borderLeft: `2px solid ${isSel ? 'var(--accent)' : 'transparent'}`,
                  transition: 'background 0.1s ease, border-color 0.1s ease',
                  animationDelay: `${idx * 0.03}s`,
                }}
                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
                onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <Avatar username={u.username} displayName={u.display_name} color={u.avatar_color} avatarUrl={u.avatar_url} size={collapsed ? 34 : 40} online={isOnline} />
                {!collapsed && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      {last && <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, marginLeft: 4 }}>{formatMsgTime(last.created_at)}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {last
                          ? (last.message_type !== 'text' ? `📎 ${last.file_name || last.message_type}` : last.content)
                          : <span style={{ color: 'var(--t3)' }}>{isOnline ? 'online' : formatLastSeen(lastSeenIso)}</span>}
                      </span>
                      {count > 0 && (
                        <div className="anim-badge" style={{ background: 'var(--accent)', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 700, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', marginLeft: 6, flexShrink: 0 }}>{count}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom panel */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: collapsed ? '7px 0' : '0 10px',
          minHeight: collapsed ? undefined : 44,
          background: 'var(--bg-0)',
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center',
          gap: collapsed ? 3 : 6,
          flexShrink: 0,
        }}>
          <div
            onClick={() => setShowProfile(true)}
            title={collapsed ? (user?.display_name || user?.username) : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 7, flex: collapsed ? 0 : 1, cursor: 'pointer', minWidth: 0, borderRadius: 8, padding: collapsed ? '2px' : '2px 4px', transition: 'background 0.15s', justifyContent: collapsed ? 'center' : 'flex-start' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            {user && <Avatar username={user.username} displayName={user.display_name} color={user.avatar_color} avatarUrl={user.avatar_url} size={26} online={true} />}
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.display_name || user?.username}</div>
                <div style={{ fontSize: 10, color: 'var(--t2)' }}>@{user?.username}</div>
              </div>
            )}
          </div>
          <button onClick={() => setShowLogoutConfirm(true)} className="btn-press" style={iconBtn} title="Log out"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          ><IconLogout /></button>
          <button onClick={() => setShowSettings(true)} className="btn-press" style={iconBtn} title="Settings"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--t1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--t2)'; }}
          ><IconSettings /></button>
        </div>
      </div>

      {showCreateChat && <CreateChatModal onClose={() => setShowCreateChat(false)} onSelect={u => { onSelect(u); setShowCreateChat(false); }} onlineIds={onlineIds} />}
      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} onlineIds={onlineIds} onCreate={async (gid) => { const r = await api.get(`/groups/${gid}`); onGroupsChange([r.data, ...groups]); onSelectGroup(r.data); }} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => setShowCreateChannel(false)}
          onCreate={ch => onChannelsChange([ch, ...channels])}
        />
      )}
      {showLogoutConfirm && (
        <ConfirmDialog title="Sign out" message="Are you sure you want to sign out of Repa?" confirmLabel="Sign out" cancelLabel="Cancel" danger onConfirm={logout} onCancel={() => setShowLogoutConfirm(false)} />
      )}
    </>
  );
}

function PlusMenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ width: '100%', background: 'none', border: 'none', color: 'var(--t1)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13, fontWeight: 500, textAlign: 'left' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
    >
      <span style={{ color: 'var(--t2)', display: 'flex' }}>{icon}</span>{label}
    </button>
  );
}
