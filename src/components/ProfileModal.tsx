import React, { useState } from 'react';
import { User, Lock, Key, X, Eye, EyeOff, LogOut, Save } from 'lucide-react';
import { updateAccount } from '../utils/auth';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  currentGeminiKey: string;
  onUpdated: (username: string, geminiKey: string) => void;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  username,
  currentGeminiKey,
  onUpdated,
  onLogout,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState(username);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newGeminiKey, setNewGeminiKey] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setCurrentPassword('');
    setNewUsername(username);
    setNewPassword('');
    setConfirmPassword('');
    setNewGeminiKey('');
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!currentPassword) {
      setError('Pehle current password dalo (security ke liye zaroori)');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError('Naya password confirm se match nahi ho raha');
      return;
    }
    if (!newUsername.trim() && !newPassword && !newGeminiKey.trim()) {
      setError('Kuch to badlo — naya username, password ya Gemini key');
      return;
    }
    setBusy(true);
    try {
      const res = await updateAccount({
        currentUsername: username,
        currentPassword,
        newUsername: newUsername.trim() || undefined,
        newPassword: newPassword || undefined,
        newGeminiKey: newGeminiKey.trim() || undefined,
      });
      if (!res.ok || !res.user) {
        setError(res.error || 'Update fail ho gaya');
        return;
      }
      onUpdated(res.user.username, res.user.geminiKey);
      setSuccess('Profile update ho gaya ✓');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNewGeminiKey('');
      setNewUsername(res.user.username);
      setTimeout(() => onClose(), 900);
    } finally {
      setBusy(false);
    }
  };

  const maskedKey = currentGeminiKey
    ? `${currentGeminiKey.slice(0, 8)}•••••••• (${currentGeminiKey.length} chars)`
    : 'set nahi hai';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 shadow-2xl p-4 sm:p-6 space-y-5 font-mono text-neutral-100 max-h-[92vh] overflow-y-auto" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between border-b border-neutral-800 pb-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest">ACCOUNT SETTINGS</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-white">PROFILE: {username}</h2>
          </div>
          <button onClick={() => { resetForm(); onClose(); }} className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-neutral-950 border border-neutral-800 text-xs font-sans text-neutral-300">
          Saved Gemini key: <code className="text-emerald-300 font-mono">{maskedKey}</code>
        </div>

        {error && <div className="p-2.5 bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs font-sans">{error}</div>}
        {success && <div className="p-2.5 bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs font-sans">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-400 uppercase flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" /><span>Current Password *</span>
            </label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="security ke liye zaroori"
                className="w-full bg-neutral-950 border border-amber-800/60 px-3 py-2 pr-9 text-neutral-100 placeholder-neutral-600 focus:border-emerald-500 focus:outline-none"
              />
              <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white">
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-400 uppercase flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /><span>Naya Username (optional)</span>
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder={username}
              className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-neutral-400 uppercase">Naya Password (optional)</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="min 4 chars"
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-neutral-400 uppercase">Confirm Naya Password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="repeat karo"
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-400 uppercase flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-400" /><span>Nayi Gemini Key (optional)</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={newGeminiKey}
                onChange={(e) => setNewGeminiKey(e.target.value)}
                placeholder="Copy key se paste karo"
                className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 pr-9 text-neutral-100 placeholder-neutral-600 focus:border-emerald-500 focus:outline-none text-xs"
              />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white">
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={busy} className="w-full py-2.5 bg-neutral-100 hover:bg-white disabled:opacity-50 text-neutral-950 font-bold uppercase tracking-wider flex items-center justify-center gap-2">
            <Save className="w-4 h-4 text-emerald-600" /><span>{busy ? 'SAVE HO RAHA...' : 'SAVE CHANGES'}</span>
          </button>

          <button
            type="button"
            onClick={() => { resetForm(); onLogout(); }}
            className="w-full py-2 bg-neutral-950 hover:bg-rose-950/50 text-neutral-300 hover:text-rose-300 border border-neutral-800 hover:border-rose-800/60 text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /><span>Logout</span>
          </button>
        </form>
      </div>
    </div>
  );
};
