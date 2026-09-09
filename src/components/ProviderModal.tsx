import React, { useState } from 'react';
import { X, Plus, Layers, Check } from 'lucide-react';
import { Provider } from '../types/router';

interface ProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProvider: (provider: Provider) => void;
}

export const ProviderModal: React.FC<ProviderModalProps> = ({
  isOpen,
  onClose,
  onAddProvider,
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState<'LLM & Multimodal' | 'Speech & Audio' | 'Embedding & Search' | 'Custom API'>('LLM & Multimodal');
  const [defaultBaseUrl, setDefaultBaseUrl] = useState('https://api.myprovider.com/v1');
  const [modelsInput, setModelsInput] = useState('model-default, model-fast');
  const [dailyTokenQuota, setDailyTokenQuota] = useState('');

  if (!isOpen) return null;

  const applyPreset = (preset: {
    name: string;
    slug: string;
    category: 'LLM & Multimodal' | 'Speech & Audio' | 'Embedding & Search' | 'Custom API';
    baseUrl: string;
    models: string;
    quota: string;
  }) => {
    setName(preset.name);
    setSlug(preset.slug);
    setCategory(preset.category);
    setDefaultBaseUrl(preset.baseUrl);
    setModelsInput(preset.models);
    setDailyTokenQuota(preset.quota);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const generatedSlug = slug.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const modelsList = modelsInput
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    const newProvider: Provider = {
      id: `prov-${Date.now()}`,
      name: name.trim(),
      slug: generatedSlug,
      category,
      defaultBaseUrl: defaultBaseUrl.trim(),
      models: modelsList.length > 0 ? modelsList : ['custom-model-v1'],
      dailyTokenQuota: dailyTokenQuota.trim() || undefined,
      isCustom: true,
    };

    onAddProvider(newProvider);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 shadow-2xl p-4 sm:p-6 space-y-5 sm:space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 sm:pb-4 gap-2">
          <div className="space-y-1 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 truncate block">
              CROSS-PLATFORM INTEGRATION
            </span>
            <h2 className="text-sm sm:text-base font-bold font-mono uppercase tracking-wide text-white truncate">
              REGISTER NEW API PROVIDER
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 bg-neutral-900 transition-colors flex-shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5 font-mono text-xs">
          <label className="block text-[10px] uppercase tracking-wider text-neutral-400">
            Quick Presets / Auto-fill:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              {
                name: 'Novita AI',
                slug: 'novita',
                category: 'LLM & Multimodal' as const,
                baseUrl: 'https://api.novita.ai/v3/openai',
                models: 'meta-llama/llama-3.3-70b-instruct, deepseek/deepseek-r1',
                quota: 'Fast Inference • Free Credits',
              },
              {
                name: 'Hyperbolic AI',
                slug: 'hyperbolic',
                category: 'LLM & Multimodal' as const,
                baseUrl: 'https://api.hyperbolic.xyz/v1',
                models: 'meta-llama/Llama-3.3-70B-Instruct, Qwen/Qwen2.5-Coder-32B-Instruct',
                quota: 'Decentralized High GPU Throughput',
              },
              {
                name: 'Chutes AI',
                slug: 'chutes',
                category: 'LLM & Multimodal' as const,
                baseUrl: 'https://chutes.ai/v1',
                models: 'deepseek-ai/DeepSeek-V3, Qwen/Qwen2.5-Coder-32B-Instruct',
                quota: 'Generous Free Community Tier',
              },
              {
                name: 'Perplexity AI',
                slug: 'perplexity',
                category: 'LLM & Multimodal' as const,
                baseUrl: 'https://api.perplexity.ai',
                models: 'sonar-pro, sonar, sonar-reasoning',
                quota: 'Live Web Search Grounded',
              },
              {
                name: 'GLHF AI',
                slug: 'glhf',
                category: 'LLM & Multimodal' as const,
                baseUrl: 'https://glhf.chat/api/openai/v1',
                models: 'hf:meta-llama/Llama-3.3-70B-Instruct, hf:Qwen/Qwen2.5-72B-Instruct',
                quota: 'Free Daily Community Inference',
              },
            ].map((preset) => (
              <button
                key={preset.slug}
                type="button"
                onClick={() => applyPreset(preset)}
                className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] text-neutral-300 hover:text-white transition-colors"
              >
                + {preset.name}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
          <div className="space-y-1.5">
            <label className="block uppercase tracking-wider text-neutral-300">
              Provider Display Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                }
              }}
              placeholder="e.g. Together AI, Fireworks AI, AWS Bedrock"
              className="w-full bg-neutral-900 border border-neutral-800 p-2.5 text-white focus:border-neutral-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block uppercase tracking-wider text-neutral-300">
              Provider Slug / System Identifier
            </label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. together-ai"
              className="w-full bg-neutral-900 border border-neutral-800 p-2.5 text-white focus:border-neutral-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block uppercase tracking-wider text-neutral-300">
              Provider Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-neutral-900 border border-neutral-800 p-2.5 text-white focus:border-neutral-500 focus:outline-none"
            >
              <option value="LLM & Multimodal">LLM & Multimodal</option>
              <option value="Embedding & Search">Embedding & Search</option>
              <option value="Speech & Audio">Speech & Audio</option>
              <option value="Custom API">Custom API</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block uppercase tracking-wider text-neutral-300">
              Default Endpoint Base URL
            </label>
            <input
              type="text"
              required
              value={defaultBaseUrl}
              onChange={(e) => setDefaultBaseUrl(e.target.value)}
              placeholder="https://api.together.xyz/v1"
              className="w-full bg-neutral-900 border border-neutral-800 p-2.5 text-white focus:border-neutral-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block uppercase tracking-wider text-neutral-300">
              Supported Models / Sub-routes (Comma separated)
            </label>
            <input
              type="text"
              value={modelsInput}
              onChange={(e) => setModelsInput(e.target.value)}
              placeholder="model-a, model-b, model-c"
              className="w-full bg-neutral-900 border border-neutral-800 p-2.5 text-white focus:border-neutral-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block uppercase tracking-wider text-neutral-300">
              Daily Token Quota / Free Tier Note (Optional)
            </label>
            <input
              type="text"
              value={dailyTokenQuota}
              onChange={(e) => setDailyTokenQuota(e.target.value)}
              placeholder="e.g. 1M Free Tokens/Day, 1,500 RPD, 100k TPM"
              className="w-full bg-neutral-900 border border-neutral-800 p-2.5 text-white focus:border-neutral-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 sm:gap-3 pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 border border-neutral-800 uppercase tracking-wider transition-colors min-h-[44px] flex items-center justify-center"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2.5 bg-neutral-100 hover:bg-white text-neutral-950 font-bold uppercase tracking-wider shadow-sm transition-colors min-h-[44px] flex items-center justify-center"
            >
              ADD PROVIDER
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
