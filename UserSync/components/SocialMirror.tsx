import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Network, Pause, Play, RefreshCw } from 'lucide-react';
import { api, apiData } from '../services/api';

/** Social Mirror: run an OASIS simulation over a persona hub and scrub the
 * network animation frames; show the real-vs-synthetic similarity. */
const SocialMirror: React.FC = () => {
  const [hubId, setHubId] = useState('');
  const [sim, setSim] = useState<any>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const hub = await api('/api/personas/generate', { body: { company_name: 'Acme', count: 20, seed: 5 } });
      setHubId(hub.artifact_id!);
      const started = await api('/api/social-mirror/simulations', {
        body: { persona_hub_id: hub.artifact_id, timesteps: 15, activate_fraction: 0.4, seed: 5 },
      });
      const simId = started.artifact_id!;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const data = await apiData(`/api/social-mirror/simulations/${simId}`);
        if (data.status === 'completed') {
          clearInterval(pollRef.current!);
          setSim(data);
          setPlaying(true);
          setLoading(false);
        }
      }, 500);
    } catch {
      setLoading(false);
    }
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  useEffect(() => {
    if (!playing || !sim) return;
    const t = setInterval(() => setFrame((f) => (f + 1 >= sim.frames.length ? (setPlaying(false), f) : f + 1)), 700);
    return () => clearInterval(t);
  }, [playing, sim]);

  // Cumulative edges up to the current frame + node layout.
  const layout = useMemo(() => {
    if (!sim) return null;
    const nodeCount = sim.metrics?.nodes || 20;
    const positions = Array.from({ length: nodeCount }, (_, i) => {
      const a = (2 * Math.PI * i) / nodeCount - Math.PI / 2;
      return { cx: 50 + 40 * Math.cos(a), cy: 50 + 40 * Math.sin(a) };
    });
    const edges: [number, number][] = [];
    const active = new Set<number>();
    sim.frames.slice(0, frame + 1).forEach((f: any) => {
      (f.new_edges || []).forEach((e: number[]) => edges.push([e[0], e[1]]));
      (f.active || []).forEach((a: number) => active.add(a));
    });
    (sim.edges || []).forEach((e: number[]) => edges.push([e[0], e[1]]));
    return { positions, edges, active };
  }, [sim, frame]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 text-white">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold"><Network className="text-teal-400" /> Social Mirror</h2>
        <button onClick={run} disabled={loading} className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold hover:bg-teal-500">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />} Run simulation
        </button>
      </div>

      {!sim ? (
        <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 rounded-2xl border border-gray-800 bg-[#050505] text-gray-600">
          <Network size={40} />
          <p className="text-xs">Run a simulation — personas post, follow, and react over time.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="rounded-2xl border border-gray-800 bg-[#050505] p-4">
            <svg viewBox="0 0 100 100" className="h-[420px] w-full">
              {layout!.edges.map(([a, b], i) => (
                <line key={i} x1={layout!.positions[a]?.cx} y1={layout!.positions[a]?.cy}
                  x2={layout!.positions[b]?.cx} y2={layout!.positions[b]?.cy} stroke="#1f2937" strokeWidth={0.2} />
              ))}
              {layout!.positions.map((p, i) => (
                <circle key={i} cx={p.cx} cy={p.cy} r={layout!.active.has(i) ? 1.8 : 1.2}
                  fill={layout!.active.has(i) ? '#2dd4bf' : '#475569'} />
              ))}
            </svg>
            <div className="mt-2 flex items-center gap-3">
              <button onClick={() => setPlaying((p) => !p)} className="rounded-lg border border-gray-700 p-1.5 hover:bg-gray-800">
                {playing ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <input type="range" min={0} max={sim.frames.length - 1} value={frame} onChange={(e) => setFrame(+e.target.value)} className="flex-1 accent-teal-500" />
              <span className="w-16 text-right font-mono text-[10px] text-gray-400">t={frame}/{sim.frames.length - 1}</span>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-gray-800 bg-[#0c0c0c] p-5 text-[11px]">
            <div className="font-bold uppercase text-gray-500">Network metrics</div>
            {sim.metrics && Object.entries(sim.metrics).filter(([k]) => typeof sim.metrics[k] !== 'object').map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-gray-400">{k.replace(/_/g, ' ')}</span><span className="font-mono text-teal-300">{String(v)}</span></div>
            ))}
            <div className="border-t border-gray-800 pt-2 text-[10px] text-gray-500">Posts this run: {sim.posts?.length || 0}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialMirror;
