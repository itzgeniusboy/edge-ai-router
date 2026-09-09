import React, { useState, useEffect } from 'react';
import { X, Server, Globe, Key, Sliders, Shield, AlertCircle } from 'lucide-react';
import { Endpoint, Provider, RegionCode, EndpointStatus } from '../types/router';

interface EndpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProvider: Provider;
  endpointToEdit?: Endpoint | null;
  onSaveEndpoint: (endpoint: Endpoint) => void;
}

const REGION_OPTIONS: { code: RegionCode; label: string }[] = [
  { code: 'ap-south-1', label: 'Mumbai, India (AP-South)' },
  { code: 'ap-south-2', label: 'Hyderabad, India (AP-South-2)' },
  { code: 'us-east-1', label: 'N. Virginia (US-East)' },
  { code: 'us-west-2', label: 'Oregon (US-West)' },
  { code: 'eu-central-1', label: 'Frankfurt (EU-Central)' },
  { code: 'eu-west-1', label: 'Dublin (EU-West)' },
  { code: 'ap-southeast-1', label: 'Singapore (AP-SE)' },
  { code: 'ap-northeast-1', label: 'Tokyo (AP-NE)' },
  { code: 'sa-east-1', label: 'São Paulo (SA-East)' },
  { code: 'global-anycast', label: 'Global 300+ Edge Anycast' },
];

export const EndpointModal: React.FC<EndpointModalProps> = ({
  isOpen,
  onClose,
  activeProvider,
  endpointToEdit,
  onSaveEndpoint,
}) => {
  const [name, setName] = useState('');
  const [region, setRegion] = useState<RegionCode>('us-east-1');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [weight, setWeight] = useState(50);
  const [priorityTier, setPriorityTier] = useState(1);
  const [rateLimitRpm, setRateLimitRpm] = useState(10000);
  const [status, setStatus] = useState<EndpointStatus>('healthy');

  useEffect(() => {
    if (endpointToEdit) {
      setName(endpointToEdit.name);
      setRegion(endpointToEdit.region);
      setApiKey(endpointToEdit.apiKey);
      setBaseUrl(endpointToEdit.baseUrl);
      setWeight(endpointToEdit.weight);
      setPriorityTier(endpointToEdit.priorityTier);
      setRateLimitRpm(endpointToEdit.rateLimitRpm);
      setStatus(endpointToEdit.status);
    } else {
      setName(`${activeProvider.name} ${region.toUpperCase()} Cluster`);
      setRegion('us-east-1');
      setApiKey('');
      setBaseUrl(activeProvider.defaultBaseUrl);
      setWeight(50);
      setPriorityTier(1);
      setRateLimitRpm(10000);
      setStatus('healthy');
    }
  }, [endpointToEdit, activeProvider, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const regionObj = REGION_OPTIONS.find((r) => r.code === region);

    const endpoint: Endpoint = {
      id: endpointToEdit ? endpointToEdit.id : `ep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      providerId: activeProvider.id,
      name: name.trim() || `${activeProvider.name} ${region}`,
      region,
      regionLabel: regionObj ? regionObj.label : region,
      apiKey: apiKey.trim() || `sk-${region}-demo-key`,
      baseUrl: baseUrl.trim() || activeProvider.defaultBaseUrl,
      weight: Number(weight),
      priorityTier: Number(priorityTier),
      status,
      latencyMs:
        region === 'global-anycast'
          ? 12
          : region.startsWith('ap-south')
          ? Math.floor(Math.random() * 12) + 16
          : region.startsWith('us-')
          ? Math.floor(Math.random() * 20) + 20
          : region.startsWith('eu-')
          ? Math.floor(Math.random() * 25) + 65
          : Math.floor(Math.random() * 40) + 110,
      uptimePercentage: 99.98,
      rateLimitRpm: Number(rateLimitRpm),
      rateLimitRemaining: Number(rateLimitRpm) - 50,
      totalRouted: endpointToEdit ? endpointToEdit.totalRouted : 0,
      errorsCount: 0,
      enabled: endpointToEdit ? endpointToEdit.enabled : true,
      lastChecked: Date.now(),
    };

    onSaveEndpoint(endpoint);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-neutral-950 border border-neutral-800 shadow-2xl p-4 sm:p-6 space-y-5 sm:space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 sm:pb-4 gap-2">
          <div className="space-y-1 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 truncate block">
              PROVIDER: {activeProvider.name}
            </span>
            <h2 className="text-sm sm:text-base font-bold font-mono uppercase tracking-wide text-white truncate">
              {endpointToEdit ? 'EDIT REGIONAL NODE' : 'ADD NEW REGIONAL NODE'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 bg-neutral-900 transition-colors flex-shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 font-mono text-xs">
          {/* Node Name */}
          <div className="space-y-1.5">
            <label className="block uppercase tracking-wider text-neutral-300">
              Node Identifier / Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. US-East Primary Cluster"
              className="w-full bg-neutral-900 border border-neutral-800 p-2.5 text-white focus:border-neutral-500 focus:outline-none"
            />
          </div>

          {/* Region Selection */}
          <div className="space-y-1.5">
            <label className="block uppercase tracking-wider text-neutral-300">
              Deployment Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as RegionCode)}
              className="w-full bg-neutral-900 border border-neutral-800 p-2.5 text-white focus:border-neutral-500 focus:outline-none"
            >
              {REGION_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.code} — {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="block uppercase tracking-wider text-neutral-300">
              API Base URL / Gateway Endpoint
            </label>
            <input
              type="text"
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.provider.com/v1"
              className="w-full bg-neutral-900 border border-neutral-800 p-2.5 text-white focus:border-neutral-500 focus:outline-none"
            />
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="block uppercase tracking-wider text-neutral-300">
              Regional API Secret Key / Token
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-••••••••••••••••"
              className="w-full bg-neutral-900 border border-neutral-800 p-2.5 text-white focus:border-neutral-500 focus:outline-none"
            />
            <p className="text-[10px] text-neutral-500 font-sans">
              Encrypted locally in browser edge store. Zero server overhead or transmission.
            </p>
          </div>

          {/* Priority Tier & Load Balancing Weight */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Priority Tier */}
            <div className="space-y-1.5">
              <label className="block uppercase tracking-wider text-neutral-300">
                Redundancy Priority Tier
              </label>
              <select
                value={priorityTier}
                onChange={(e) => setPriorityTier(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-800 p-2.5 text-white focus:border-neutral-500 focus:outline-none"
              >
                <option value={1}>Tier 1 (Primary Active Pool)</option>
                <option value={2}>Tier 2 (Secondary Failover)</option>
                <option value={3}>Tier 3 (Disaster Recovery)</option>
              </select>
            </div>

            {/* Weight */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="block uppercase tracking-wider text-neutral-300">
                  Weight ({weight}%)
                </label>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full accent-neutral-200 mt-2"
              />
            </div>
          </div>

          {/* RPM Quota & Health Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block uppercase tracking-wider text-neutral-300">
                Max Capacity (RPM)
              </label>
              <input
                type="number"
                value={rateLimitRpm}
                onChange={(e) => setRateLimitRpm(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-800 p-2.5 text-white focus:border-neutral-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block uppercase tracking-wider text-neutral-300">
                Initial Health Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EndpointStatus)}
                className="w-full bg-neutral-900 border border-neutral-800 p-2.5 text-white focus:border-neutral-500 focus:outline-none"
              >
                <option value="healthy">Healthy</option>
                <option value="degraded">Degraded</option>
                <option value="rate-limited">Rate-Limited</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>

          {/* Buttons */}
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
              {endpointToEdit ? 'SAVE CHANGES' : 'CREATE REGIONAL NODE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
