import React, { useState } from 'react';
import { Bell, CheckCheck, Trash2, X, Bot, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { AppNotification, NotifyKind } from '../utils/notify';

interface NotificationsBellProps {
  items: AppNotification[];
  onMarkAllRead: () => void;
  onClear: () => void;
  onDismiss: (id: string) => void;
}

const KIND_ICON: Record<NotifyKind, React.ReactNode> = {
  info: <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />,
  success: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />,
  warn: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />,
  error: <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />,
  agent: <Bot className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />,
};

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s pehle`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m pehle`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h pehle`;
  return `${Math.floor(h / 24)}d pehle`;
}

export const NotificationsBell: React.FC<NotificationsBellProps> = ({
  items,
  onMarkAllRead,
  onClear,
  onDismiss,
}) => {
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Notifications — manual + agent actions"
        className="relative flex items-center justify-center w-8 h-8 text-xs font-mono bg-neutral-900 hover:bg-neutral-850 text-neutral-200 border border-neutral-800 hover:border-neutral-600 transition-colors"
      >
        <Bell className="w-3.5 h-3.5" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-emerald-400 text-neutral-950 text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-[60] w-[320px] max-w-[86vw] bg-neutral-900 border border-neutral-700 shadow-2xl font-mono">
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white">Notifications</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={onMarkAllRead} title="Mark all read" className="p-1 text-neutral-400 hover:text-white">
                <CheckCheck className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={onClear} title="Clear all" className="p-1 text-neutral-400 hover:text-rose-300">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => setOpen(false)} title="Close" className="p-1 text-neutral-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {items.length === 0 && (
              <div className="px-3 py-6 text-center text-[11px] text-neutral-500">
                Koi notification nahi — manual ya agent action pe yaha aayega.
              </div>
            )}
            {items.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-2 px-3 py-2 border-b border-neutral-800/60 ${n.read ? 'opacity-60' : 'bg-neutral-900'}`}
              >
                <div className="pt-0.5">{KIND_ICON[n.kind]}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-neutral-100 leading-snug">{n.title}</div>
                  <div className="text-[11px] text-neutral-400 font-sans leading-snug break-words">{n.message}</div>
                  <div className="text-[9px] text-neutral-600 mt-0.5">
                    {n.kind === 'agent' ? 'AGENT • ' : ''}{timeAgo(n.ts)}
                  </div>
                </div>
                <button type="button" onClick={() => onDismiss(n.id)} title="Dismiss" className="p-0.5 text-neutral-600 hover:text-white flex-shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
