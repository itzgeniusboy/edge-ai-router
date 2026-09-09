import React from 'react';
import { Info, CheckCircle2, AlertTriangle, XCircle, Bot } from 'lucide-react';
import type { AppNotification } from '../utils/notify';

const ICON = {
  info: <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />,
  success: <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
  warn: <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />,
  error: <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />,
  agent: <Bot className="w-4 h-4 text-violet-400 flex-shrink-0" />,
};

export const Toasts: React.FC<{ items: AppNotification[] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-3 sm:right-4 z-[70] space-y-2 w-[320px] max-w-[90vw] font-mono">
      {items.slice(0, 3).map((n) => (
        <div
          key={n.id}
          className="flex items-start gap-2 bg-neutral-900 border border-neutral-700 shadow-2xl px-3 py-2.5 animate-in fade-in"
        >
          <div className="pt-0.5">{ICON[n.kind]}</div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-neutral-100 leading-snug">{n.title}</div>
            <div className="text-[11px] text-neutral-400 font-sans leading-snug break-words">{n.message}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
