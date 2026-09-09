import React, { useState } from 'react';
import { Shield, Key, User, Lock, Bot, X, Eye, EyeOff } from 'lucide-react';
import { getUsers, saveUsers, sha256Hex, isValidGeminiKey, setSession } from '../utils/auth';

interface OperatorLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (username: string, geminiKey: string) => void;
  currentUsername?: string;
  currentGeminiKey?: string;
}

export const OperatorLoginModal: React.FC<OperatorLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  currentUsername = '',
  currentGeminiKey = '',
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [username, setUsername] = useState(currentUsername || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [geminiKey, setGeminiKey] = useState(currentGeminiKey || '');
  const [showPassword, setShowPassword] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const u = username.trim();
    // Paste me se key dhoondh ke nikaalo: quotes/spaces/Bearer-/extra words ho tab bhi chalega
    const cleaned = geminiKey.replace(/[\s'"`]+/g, '').trim();
    const found = cleaned.match(/AIza[0-9A-Za-z\-_]{20,}/);
    const k = found ? found[0] : cleaned;
    const peek = cleaned.length > 0 ? `'${cleaned.slice(0, 6)}...'` : '(khali)';
    if (u.length < 3) { setError('Username minimum 3 characters'); return; }
    if (password.length < 4) { setError('Password minimum 4 characters'); return; }
    if (password !== confirm) { setError('Password confirm match nahi ho raha'); return; }
    if (!cleaned) { setError('Gemini API key dalo (aistudio.google.com → Get API Key)'); return; }
    if (!found) { setError(`Ye Gemini key nahi lag rahi — tumne ${peek} dala (${cleaned.length} chars). aistudio.google.com se AIza... wali full key copy karo.`); return; }
    if (!isValidGeminiKey(k)) { setError(`Key adhuri lag rahi hai (${k.length} chars, ~39 hone chahiye) — dobara full copy-paste karo.`); return; }
    setBusy(true);
    try {
      const users = getUsers();
      if (users.some((x) => x.username.toLowerCase() === u.toLowerCase())) {
        setError('Ye username already hai, login karo ya dusra lo');
        return;
      }
      const passHash = await sha256Hex(`er:${u.toLowerCase()}:${password}`);
      users.push({ username: u, passHash, geminiKey: k, createdAt: Date.now() });
      saveUsers(users);
      setSession(u);
      localStorage.setItem('er_gemini_key', k);
      onLoginSuccess(u, k);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const u = username.trim();
    if (!u || !password) { setError('Username + password dalo'); return; }
    setBusy(true);
    try {
      const users = getUsers();
      const found = users.find((x) => x.username.toLowerCase() === u.toLowerCase());
      if (!found) { setError('Account nahi mila, pehle Create Account karo'); return; }
      const passHash = await sha256Hex(`er:${found.username.toLowerCase()}:${password}`);
      if (passHash !== found.passHash) { setError('Wrong password'); return; }
      setSession(found.username);
      localStorage.setItem('er_operator_username', found.username);
      localStorage.setItem('er_gemini_key', found.geminiKey);
      onLoginSuccess(found.username, found.geminiKey);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 shadow-2xl p-4 sm:p-6 space-y-5 font-mono text-neutral-100 max-h-[92vh] overflow-y-auto" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between border-b border-neutral-800 pb-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest">SINGLE GATEWAY // PER-USER KEY</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-white">EDGE ROUTER ACCESS</h2>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button type="button" onClick={() => { setMode('signup'); setError(''); }} className={`py-2 uppercase font-bold border ${mode === 'signup' ? 'bg-white text-black border-white' : 'border-neutral-700 text-neutral-300'}`}>Create Account</button>
          <button type="button" onClick={() => { setMode('login'); setError(''); }} className={`py-2 uppercase font-bold border ${mode === 'login' ? 'bg-white text-black border-white' : 'border-neutral-700 text-neutral-300'}`}>Login</button>
        </div>

        <div className="p-3 bg-neutral-950 border border-neutral-800 text-xs font-sans text-neutral-300 leading-relaxed">
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-[11px] uppercase font-semibold"><Bot className="w-3.5 h-3.5" /><span>Kaise chalega?</span></div>
          <p className="mt-1">1 endpoint: <strong>/api/v1/chat/completions</strong> • Key har user ki alag (tumhari Gemini key). Signup me <strong>username + password + Gemini key</strong> mandatory hai.</p>
        </div>

        {error && <div className="p-2.5 bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs font-sans">{error}</div>}

        <form onSubmit={mode === 'signup' ? handleSignup : handleLogin} className="space-y-4 text-xs font-mono">
          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-400 uppercase flex items-center gap-1.5"><User className="w-3.5 h-3.5" /><span>Username</span></label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. ravi123" className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:border-emerald-500 focus:outline-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-400 uppercase flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /><span>Password</span></label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 4 chars" className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 pr-9 text-neutral-100 placeholder-neutral-600 focus:border-emerald-500 focus:outline-none" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white">{showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
            </div>
          </div>
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-[11px] text-neutral-400 uppercase">Confirm Password</label>
              <input type={showPassword ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="repeat password" className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:border-emerald-500 focus:outline-none" />
            </div>
          )}
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-[11px] text-neutral-400 uppercase flex items-center gap-1.5"><Key className="w-3.5 h-3.5 text-emerald-400" /><span>Gemini API Key *</span></label>
              <div className="relative">
                <input type={showKey ? 'text' : 'password'} value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIzaSy... (aistudio.google.com)" className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 pr-9 text-neutral-100 placeholder-neutral-600 focus:border-emerald-500 focus:outline-none text-xs" />
                <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white">{showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
              </div>
              <p className="text-[10px] text-neutral-500 font-sans">aistudio.google.com → Get API Key → yaha paste karo. Ye key sirf tumhare browser me rahegi.</p>
            </div>
          )}
          <button type="submit" disabled={busy} className="w-full py-2.5 bg-neutral-100 hover:bg-white disabled:opacity-50 text-neutral-950 font-bold uppercase tracking-wider flex items-center justify-center gap-2">
            <Bot className="w-4 h-4 text-emerald-600" /><span>{busy ? 'WAIT...' : mode === 'signup' ? 'CREATE & LOGIN' : 'LOGIN'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
