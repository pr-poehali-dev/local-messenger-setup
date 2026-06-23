import urls from '../../backend/func2url.json';

const API = urls as Record<string, string>;

export interface User {
  id: number;
  login: string;
  display_name: string;
  role: string;
  status: string;
  bio: string;
}

export interface AdminUser extends User {
  created_at: string;
  last_seen: string | null;
}

export interface AuditEntry {
  id: number;
  admin: string;
  action: string;
  target: string;
  type: string;
  time: string;
}

export interface Conversation {
  id: number;
  title: string;
  is_group: boolean;
  last: string;
  time: string;
  other_user_id: number | null;
}

export interface Message {
  id: number;
  sender_id: number;
  sender_name: string;
  body: string;
  time: string;
  me: boolean;
}

function authHeaders(): Record<string, string> {
  const uid = localStorage.getItem('userId');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (uid) headers['X-User-Id'] = uid;
  return headers;
}

export async function login(loginName: string, password: string) {
  const res = await fetch(API.auth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', login: loginName, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка входа');
  return data as { token: string; user: User };
}

export async function fetchUsers() {
  const res = await fetch(API.users, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
  return data as { users: AdminUser[]; audit: AuditEntry[] };
}

export async function createAccount(payload: {
  login: string;
  display_name: string;
  password: string;
  role: string;
}) {
  const res = await fetch(API.users, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'create', ...payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка создания');
  return data;
}

export async function setUserStatus(userId: number, status: string) {
  const res = await fetch(API.users, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'set_status', user_id: userId, status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function changePassword(newPassword: string) {
  const res = await fetch(API.users, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'change_password', new_password: newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function updateProfile(display_name: string, bio: string) {
  const res = await fetch(API.users, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'update_profile', display_name, bio }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function fetchConversations() {
  const res = await fetch(API.messages, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data.conversations as Conversation[];
}

export async function fetchMessages(conversationId: number) {
  const res = await fetch(`${API.messages}?conversation_id=${conversationId}`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data.messages as Message[];
}

export async function sendMessage(conversationId: number, body: string) {
  const res = await fetch(API.messages, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'send', conversation_id: conversationId, body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

export async function searchUsers(q: string): Promise<{ id: number; login: string; name: string }[]> {
  const res = await fetch(API.messages, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'search_users', q }),
  });
  const data = await res.json();
  return data.users || [];
}

export async function createDialog(targetLogin: string) {
  const res = await fetch(API.messages, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'create_dialog', target_login: targetLogin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data as { id: number; title: string; ok: boolean; already_exists?: boolean };
}

export interface IncomingSignal {
  id: number;
  sender_id: number;
  type: string;
  payload: { mode?: string };
}

export async function pollSignals(conversationId: number, since: number): Promise<IncomingSignal[]> {
  const res = await fetch(`${API.signaling}?conversation_id=${conversationId}&since=${since}`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  return data.signals || [];
}