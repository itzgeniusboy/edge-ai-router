import React, { useState } from 'react';
import { Shield, Key, User, Lock, CheckCircle2, Bot, Zap, X, Eye, EyeOff, Info } from 'lucide-react';

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
  const [username, setUsername] = useState(currentUsername || 'operator');
  const [password, setPassword] = useState('edgepass');
  const [geminiKey, setGeminiKey] = useState(currentGeminiKey || '');
  const [showPassword, setShowPassword] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [useServerKey, setUseServerKey] = useState(!currentGeminiKey);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter an operator username');
      return;
    }
    if (!password) {
      setError('Please enter a password');
      return;
    }
    if (!useServerKey && !geminiKey.trim()) {
      setError('Please enter your Gemini API Key or check "Use Server Pre-configured Key"');
      return;
    }

    const keyToUse = useServerKey ? '' : geminiKey.trim();
    onLoginSuccess(username.trim(), keyToUse);
    onClose();
  };

  const handleQuickDemo = () => {
    setUsername('operator');
    setPassword('edgepass');
    setUseServerKey(true);
    onLoginSuccess('operator', '');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-neutral-900 border border-neutral-700 shadow-2xl p-4 sm:p-6 space-y-5 font-mono text-neutral-100 max-h-[92vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-800 pb-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest">
                OPERATOR ACCESS // COPILOT CONTROL
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-white flex items-center gap-2">
              <span>OPERATOR LOGIN</span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800/80 font-normal">
                AUTONOMOUS AI READY
              </span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner for users who don't understand the site */}
        <div className="p-3 bg-neutral-950 border border-neutral-800 space-y-2 text-xs font-sans">
          <div className="flex items-center gap-2 text-emerald-400 font-mono font-semibold text-[11px] uppercase">
            <Bot className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Naye users ke liye / Don't know how it works?</span>
          </div>
          <p className="text-neutral-300 leading-relaxed text-[12px]">
            Agar aapko edge routing, failover ya proxies ki samajh nahi hai, toh chinta mat kijiye! Login karke apni <strong>Gemini Key</strong> daal dijiye — fir <strong>Autonomous AI Copilot</strong> khud puri site ko optimize karega, ping checks run karega, aur providers chalayega!
          </p>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs font-sans">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-400 uppercase flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-neutral-400" />
              <span>Username</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. operator"
              className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 text-neutral-100 placeholder-neutral-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-400 uppercase flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-neutral-400" />
              <span>Password</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (default: edgepass)"
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-2 pr-9 text-neutral-100 placeholder-neutral-600 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-2 pt-1 border-t border-neutral-800">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-neutral-400 uppercase flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                <span>Gemini API Key</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-neutral-400 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={useServerKey}
                  onChange={(e) => setUseServerKey(e.target.checked)}
                  className="rounded-none border-neutral-700 text-emerald-500 focus:ring-0"
                />
                <span>Use Server Pre-configured Key</span>
              </label>
            </div>

            {!useServerKey ? (
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="Paste your Gemini API key (AIzaSy...)"
                  className="w-full bg-neutral-950 border border-neutral-700 px-3 py-2 pr-9 text-neutral-100 placeholder-neutral-600 focus:border-emerald-500 focus:outline-none font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            ) : (
              <div className="bg-neutral-950 p-2.5 border border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Using Server-Side GEMINI_API_KEY environment secret</span>
                </div>
                <span className="text-[9px] text-neutral-500 uppercase">SERVER-MANAGED</span>
              </div>
            )}
            <p className="text-[10px] text-neutral-400 font-sans">
              All Gemini calls are executed server-side via Node Express with your key securely handled.
            </p>
          </div>

          {/* Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-neutral-100 hover:bg-white text-neutral-950 font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
            >
              <Bot className="w-4 h-4 text-emerald-600" />
              <span>LOGIN &amp; ACTIVATE COPILOT</span>
            </button>

            <button
              type="button"
              onClick={handleQuickDemo}
              className="w-full py-2 bg-neutral-950 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>1-Click Demo Login (Auto-fill)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
