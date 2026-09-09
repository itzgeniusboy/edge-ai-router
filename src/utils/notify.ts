// Tiny in-app notification bus (manual actions + agent actions alike).
// App.tsx subscribes and keeps the list (persisted, capped).

export type NotifyKind = "info" | "success" | "warn" | "error" | "agent";

export interface AppNotification {
  id: string;
  ts: number;
  kind: NotifyKind;
  title: string;
  message: string;
  read: boolean;
}

type Listener = (n: AppNotification) => void;
const listeners = new Set<Listener>();

export function subscribeNotifications(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notify(kind: NotifyKind, title: string, message: string) {
  const n: AppNotification = {
    id: `nt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    kind,
    title,
    message,
    read: false,
  };
  // persist for reveal after reload (cap 50)
  try {
    const raw = localStorage.getItem("er_notifications");
    const arr: AppNotification[] = raw ? JSON.parse(raw) : [];
    arr.unshift(n);
    localStorage.setItem("er_notifications", JSON.stringify(arr.slice(0, 50)));
  } catch { /* ignore */ }
  listeners.forEach((fn) => {
    try {
      fn(n);
    } catch { /* ignore */ }
  });
}

export function loadNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem("er_notifications");
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveNotifications(list: AppNotification[]) {
  try {
    localStorage.setItem("er_notifications", JSON.stringify(list.slice(0, 50)));
  } catch { /* ignore */ }
}
