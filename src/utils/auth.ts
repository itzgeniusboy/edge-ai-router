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
  const k = key.trim();
  // Legacy format: AIza... (~39 chars) | New AI Studio format: AQ.Ab... (~70 chars)
  return /^(AIza[0-9A-Za-z\-_]{20,}|AQ\.[A-Za-z0-9\-_.]{40,})$/.test(k);
}

export function extractGeminiKey(text: string): string | null {
  const cleaned = text.replace(/[\s'"`]+/g, '').trim();
  const m = cleaned.match(/AIza[0-9A-Za-z\-_]{20,}|AQ\.[A-Za-z0-9\-_.]{40,}/);
  return m ? m[0] : null;
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

export interface UpdateAccountInput {
  currentUsername: string;
  currentPassword: string;
  newUsername?: string;
  newPassword?: string;
  newGeminiKey?: string;
}

// Update username / password / Gemini key. Current password is always required.
// Returns the updated user on success.
export async function updateAccount(input: UpdateAccountInput): Promise<{ ok: boolean; error?: string; user?: StoredUser }> {
  const users = getUsers();
  const idx = users.findIndex((x) => x.username.toLowerCase() === input.currentUsername.toLowerCase());
  if (idx === -1) return { ok: false, error: 'Account nahi mila, dobara login karo' };
  const found = users[idx];

  const curHash = await sha256Hex(`er:${found.username.toLowerCase()}:${input.currentPassword}`);
  if (curHash !== found.passHash) return { ok: false, error: 'Current password galat hai' };

  let finalUsername = found.username;
  const newU = (input.newUsername || '').trim();
  if (newU && newU.toLowerCase() !== found.username.toLowerCase()) {
    if (newU.length < 3) return { ok: false, error: 'Naya username minimum 3 characters' };
    if (users.some((x, i) => i !== idx && x.username.toLowerCase() === newU.toLowerCase())) {
      return { ok: false, error: 'Ye username already hai, dusra lo' };
    }
    finalUsername = newU;
  }

  let finalHash = found.passHash;
  if (input.newPassword) {
    if (input.newPassword.length < 4) return { ok: false, error: 'Naya password minimum 4 characters' };
    finalHash = await sha256Hex(`er:${finalUsername.toLowerCase()}:${input.newPassword}`);
  }

  let finalKey = found.geminiKey;
  const rawKey = (input.newGeminiKey || '').trim();
  if (rawKey) {
    const extracted = extractGeminiKey(rawKey) || rawKey.replace(/[\s'"`]+/g, '').trim();
    if (!isValidGeminiKey(extracted)) {
      return { ok: false, error: 'Nayi Gemini key sahi nahi lag rahi — AI Studio se Copy key karke full paste karo' };
    }
    finalKey = extracted;
  }

  const updated: StoredUser = { ...found, username: finalUsername, passHash: finalHash, geminiKey: finalKey };
  users[idx] = updated;
  saveUsers(users);
  setSession(finalUsername);
  try {
    localStorage.setItem('er_gemini_key', finalKey);
  } catch { /* ignore */ }
  return { ok: true, user: updated };
}

// Keep the stored user record in sync when key changes elsewhere (e.g. Copilot action).
export function syncUserGeminiKey(username: string, geminiKey: string) {
  try {
    const users = getUsers();
    const idx = users.findIndex((x) => x.username.toLowerCase() === username.toLowerCase());
    if (idx === -1) return;
    users[idx] = { ...users[idx], geminiKey };
    saveUsers(users);
    localStorage.setItem('er_gemini_key', geminiKey);
  } catch { /* ignore */ }
}
