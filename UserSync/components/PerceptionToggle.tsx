import React, { useEffect, useState } from 'react';
import { Cpu, Eye, RefreshCw, Zap } from 'lucide-react';

/**
 * CPU / ZeroGPU deployment toggle (spec.md §4.5). Controls whether the engine
 * escalates to the OmniParser station (GPU path) for canvas/Figma surfaces.
 * CPU tier stays fully functional: DOM serializer + optical CVD/blur.
 */

interface Capabilities {
  perception_mode: string;
  visual_perception_enabled: boolean;
  perception_tier: string;
  omniparser_configured: boolean;
}

const PerceptionToggle: React.FC = () => {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = () =>
    fetch('/api/account/capabilities')
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => body?.data && setCaps(body.data))
      .catch(() => undefined);

  useEffect(() => {
    load();
  }, []);

  const setMode = async (mode: 'cpu' | 'zerogpu' | 'auto') => {
    setBusy(true);
    setNote('');
    try {
      const response = await fetch('/api/account/capabilities/perception', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (response.status === 401) {
        setNote('Sign in with Hugging Face to change the deployment tier.');
      } else if (response.ok) {
        await load();
      } else {
        setNote(`Failed (${response.status})`);
      }
    } catch {
      setNote('API unreachable.');
    } finally {
      setBusy(false);
    }
  };

  const tier = caps?.perception_tier;

  return (
    <div className="space-y-4 pt-4">
      <h3 className="flex items-center gap-2 border-b border-gray-900 pb-2 text-xs font-bold uppercase tracking-wider text-teal-400">
        <Eye size={14} /> Perception tier — CPU / ZeroGPU deployment
      </h3>
      <p className="text-[11px] leading-relaxed text-gray-500">
        CPU tier runs the DOM serializer with optical color-blindness and acuity preprocessing —
        fully functional, no GPU. ZeroGPU tier additionally escalates to the OmniParser station for
        canvas and Figma-prototype surfaces the DOM can't describe.
      </p>

      <div className="grid grid-cols-3 gap-2">
        {([
          { id: 'cpu', label: 'CPU only', icon: Cpu, desc: 'DOM + optical filter' },
          { id: 'zerogpu', label: 'ZeroGPU', icon: Zap, desc: 'OmniParser visual escalation' },
          { id: 'auto', label: 'Auto', icon: Eye, desc: 'ZeroGPU if parser URL set' },
        ] as const).map((option) => {
          const active = caps?.perception_mode === option.id;
          return (
            <button
              key={option.id}
              onClick={() => setMode(option.id)}
              disabled={busy}
              className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                active
                  ? 'border-teal-500/50 bg-teal-500/10 text-teal-200'
                  : 'border-gray-800 bg-black/40 text-gray-400 hover:border-gray-700'
              }`}
            >
              <option.icon size={16} />
              <span className="text-xs font-bold">{option.label}</span>
              <span className="text-[9px] opacity-60">{option.desc}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/40 p-3">
        <span className="text-[11px] text-gray-400">
          Active tier:{' '}
          <span className={`font-bold ${tier === 'zerogpu' ? 'text-teal-300' : 'text-gray-300'}`}>
            {busy ? <RefreshCw size={11} className="inline animate-spin" /> : tier || '…'}
          </span>
          {caps && !caps.omniparser_configured && caps.perception_tier === 'zerogpu' && (
            <span className="ml-2 text-amber-400">⚠ OMNIPARSER_BASE_URL not set</span>
          )}
        </span>
        <span
          className={`h-3 w-9 rounded-full transition ${caps?.visual_perception_enabled ? 'bg-teal-500' : 'bg-gray-700'}`}
        >
          <span
            className={`block h-3 w-3 rounded-full bg-white transition-transform ${
              caps?.visual_perception_enabled ? 'translate-x-6' : ''
            }`}
          />
        </span>
      </div>
      {note && <p className="text-[10px] text-amber-400">{note}</p>}
    </div>
  );
};

export default PerceptionToggle;
