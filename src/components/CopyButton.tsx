import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyText } from '../utils/copy';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  title?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  label = 'COPY',
  className = '',
  title = 'Copy to clipboard',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={title}
      className={`flex items-center gap-1 text-[10px] font-mono transition-colors ${
        copied ? 'text-emerald-400' : 'text-neutral-400 hover:text-white'
      } ${className}`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      <span>{copied ? 'COPIED' : label}</span>
    </button>
  );
};
