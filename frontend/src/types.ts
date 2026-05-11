export interface User {
  id: number;
  username: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  avatar_color: string;
  is_online: boolean;
  last_seen: string | null;
  created_at: string;
}

export interface Message {
  id: number;
  content: string | null;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file';
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  duration: number | null;
  sender_id: number;
  receiver_id: number;
  created_at: string;
  is_read: boolean;
  sender: User;
}

export interface Channel {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  avatar_url: string | null;
  avatar_color: string;
  created_at: string;
  subscriber_count: number;
  is_subscribed: boolean;
}

export interface Post {
  id: number;
  channel_id: number;
  content: string | null;
  file_url: string | null;
  file_type: string | null;
  file_name: string | null;
  file_size: number | null;
  views: number;
  reposts: number;
  created_at: string;
  author: User;
  comment_count: number;
}

export interface PostComment {
  id: number;
  post_id: number;
  content: string;
  created_at: string;
  author: User;
}

export interface Group {
  id: number;
  name: string;
  owner_id: number;
  avatar_url: string | null;
  avatar_color: string;
  created_at: string;
  member_count: number;
  members: User[];
}

export interface GroupMessage {
  id: number;
  group_id: number;
  content: string | null;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file';
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  duration: number | null;
  sender_id: number;
  created_at: string;
  sender: User;
}

export type Theme = 'dark' | 'light';
