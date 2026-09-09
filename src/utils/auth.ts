export interface StoredUser {
  username: string;
  passHash: string;
  geminiKey: string;
  createdAt: number;
}

const USERS_KEY = 'er_users';
const SESSION_KEY = 'er_session_user';

export function getUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function sha256Hex(text: string): Promise<string> {
  try {
    if (crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* fall through */ }
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
}

export function isValidGeminiKey(key: string): boolean {
  return /^AIza[0-9A-Za-z\-_]{20,}$/.test(key.trim());
}

export function getSessionUsername(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSession(username: string) {
  localStorage.setItem(SESSION_KEY, username);
  localStorage.setItem('er_operator_username', username);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser(): StoredUser | null {
  const u = getSessionUsername();
  if (!u) return null;
  return getUsers().find((x) => x.username === u) || null;
}

export function getActiveGeminiKey(): string {
  const cur = getCurrentUser();
  if (cur?.geminiKey) return cur.geminiKey;
  try {
    return localStorage.getItem('er_gemini_key') || '';
  } catch {
    return '';
  }
}
