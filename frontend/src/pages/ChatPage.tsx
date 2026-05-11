import { useState, useCallback, useEffect } from 'react';
import type { User, Message, Channel, Group, GroupMessage } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import ChannelView from '../components/ChannelView';
import GroupChatWindow from '../components/GroupChatWindow';
import api from '../api';
import { formatMsgTime } from '../utils/time';

export default function ChatPage() {
  const { token, user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<number>>(new Set());
  const [lastSeenMap, setLastSeenMap] = useState<Record<number, string>>({});
  const [typingIds, setTypingIds] = useState<Set<number>>(new Set());
  const [liveTexts, setLiveTexts] = useState<Record<number, string>>({});
  const [lastMessages, setLastMessages] = useState<Record<number, Message>>({});
  const [unread, setUnread] = useState<Record<number, number>>({});
  const [newMessage, setNewMessage] = useState<Message | null>(null);
  const [peerWallpaper, setPeerWallpaper] = useState<{ peerId: number; url: string | null } | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupMessage, setNewGroupMessage] = useState<GroupMessage | null>(null);
  const [groupTyping, setGroupTyping] = useState<Record<number, Record<number, boolean>>>({});
  const [groupLiveTexts, setGroupLiveTexts] = useState<Record<number, Record<number, string>>>({});
  const [lastGroupMessages, setLastGroupMessages] = useState<Record<number, { text: string; time: string }>>({});

  useEffect(() => {
    api.get('/channels/').then(r => setChannels(r.data)).catch(() => {});
    api.get('/groups/').then(r => setGroups(r.data)).catch(() => {});
  }, []);

  const handleWs = useCallback((data: any) => {
    if (data.type === 'message') {
      const msg: Message = data.message;
      const peerId = msg.sender_id === user?.id ? msg.receiver_id : msg.sender_id;
      setLastMessages(prev => ({ ...prev, [peerId]: msg }));
      setNewMessage({ ...msg, _ts: Date.now() } as any);
      if (msg.sender_id !== user?.id) {
        setUnread(prev => {
          if (selectedUser?.id === msg.sender_id) return prev;
          return { ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 };
        });
      }
    } else if (data.type === 'typing') {
      const { user_id, is_typing } = data;
      setTypingIds(prev => { const s = new Set(prev); is_typing ? s.add(user_id) : s.delete(user_id); return s; });
    } else if (data.type === 'live_type') {
      setLiveTexts(prev => ({ ...prev, [data.user_id]: data.text }));
    } else if (data.type === 'online_list') {
      setOnlineIds(new Set(data.user_ids));
    } else if (data.type === 'user_online') {
      setOnlineIds(prev => new Set([...prev, data.user_id]));
    } else if (data.type === 'user_offline') {
      setOnlineIds(prev => { const s = new Set(prev); s.delete(data.user_id); return s; });
      if (data.last_seen) setLastSeenMap(prev => ({ ...prev, [data.user_id]: data.last_seen }));
    } else if (data.type === 'wallpaper_set') {
      setPeerWallpaper({ peerId: data.from_user_id, url: data.url });
    } else if (data.type === 'group_message') {
      const msg: GroupMessage = data.message;
      setNewGroupMessage({ ...msg, _ts: Date.now() } as any);
      setLastGroupMessages(prev => ({
        ...prev,
        [msg.group_id]: {
          text: msg.message_type !== 'text' ? `📎 ${msg.file_name || msg.message_type}` : (msg.content || ''),
          time: formatMsgTime(msg.created_at),
        },
      }));
    } else if (data.type === 'group_typing') {
      setGroupTyping(prev => ({
        ...prev,
        [data.group_id]: { ...(prev[data.group_id] || {}), [data.user_id]: data.is_typing },
      }));
    } else if (data.type === 'group_live_type') {
      setGroupLiveTexts(prev => ({
        ...prev,
        [data.group_id]: { ...(prev[data.group_id] || {}), [data.user_id]: data.text },
      }));
    }
  }, [user?.id, selectedUser?.id]);

  const { send } = useWebSocket(token, handleWs);

  const handleSelect = (u: User) => {
    setSelectedUser(u);
    setSelectedChannel(null);
    setSelectedGroup(null);
    setUnread(prev => ({ ...prev, [u.id]: 0 }));
    setLiveTexts(prev => ({ ...prev, [u.id]: '' }));
    if (user) send({ type: 'read', sender_id: u.id });
  };

  const handleSelectChannel = (ch: Channel) => {
    setSelectedChannel(ch);
    setSelectedUser(null);
    setSelectedGroup(null);
  };

  const handleSelectGroup = (g: Group) => {
    setSelectedGroup(g);
    setSelectedUser(null);
    setSelectedChannel(null);
  };

  const handleGoToChannel = (channelId: number, channelName: string) => {
    const ch = channels.find(c => c.id === channelId);
    if (ch) {
      handleSelectChannel(ch);
    } else {
      api.get(`/channels/${channelId}`).then(r => {
        setChannels(prev => [...prev, r.data]);
        handleSelectChannel(r.data);
      }).catch(() => {});
    }
  };

  const handleSend = (content: string, msgType = 'text', fileUrl?: string, fileName?: string, fileSize?: number, duration?: number) => {
    if (!selectedUser) return;
    send({ type: 'message', content, receiver_id: selectedUser.id, message_type: msgType, file_url: fileUrl, file_name: fileName, file_size: fileSize, duration });
  };

  const handleTyping = (isTyping: boolean) => {
    if (!selectedUser) return;
    send({ type: 'typing', receiver_id: selectedUser.id, is_typing: isTyping });
  };

  const handleLiveType = (text: string) => {
    if (!selectedUser) return;
    send({ type: 'live_type', receiver_id: selectedUser.id, text });
  };

  return (
    <div style={{ height: '100%', display: 'flex', background: 'var(--bg-0)' }}>
      <Sidebar
        selectedId={selectedUser?.id ?? null}
        selectedChannelId={selectedChannel?.id ?? null}
        selectedGroupId={selectedGroup?.id ?? null}
        onSelect={handleSelect}
        onSelectChannel={handleSelectChannel}
        onSelectGroup={handleSelectGroup}
        onlineIds={onlineIds}
        lastSeenMap={lastSeenMap}
        lastMessages={lastMessages}
        unread={unread}
        channels={channels}
        onChannelsChange={setChannels}
        groups={groups}
        onGroupsChange={setGroups}
        lastGroupMessages={lastGroupMessages}
      />

      {selectedChannel ? (
        <ChannelView
          channel={selectedChannel}
          wsSend={send}
          onChannelUpdate={updated => {
            setSelectedChannel(updated);
            setChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
          }}
        />
      ) : selectedGroup ? (
        <GroupChatWindow
          group={selectedGroup}
          newGroupMessage={newGroupMessage}
          wsSend={send}
          groupTyping={groupTyping}
          groupLiveTexts={groupLiveTexts}
        />
      ) : (
        <ChatWindow
          peer={selectedUser}
          isOnline={selectedUser ? onlineIds.has(selectedUser.id) : false}
          isTyping={selectedUser ? typingIds.has(selectedUser.id) : false}
          liveText={selectedUser ? (liveTexts[selectedUser.id] || '') : ''}
          onSend={handleSend}
          onTyping={handleTyping}
          onLiveType={handleLiveType}
          newMessage={newMessage}
          wsSend={send}
          peerWallpaper={peerWallpaper}
          onGoToChannel={handleGoToChannel}
        />
      )}
    </div>
  );
}
