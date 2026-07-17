import React, { useMemo, useState } from 'react';
import { Network, RefreshCw, Sparkles, Users } from 'lucide-react';

/**
 * Persona Generation tab (spec.md Tab 4): in-depth generation form over
 * /api/personas/generate and the persona graph rendered from the hub's
 * graph payload. Falls back to a local demo layout when the API is absent.
 */

interface GraphNode {
  id: string;
  index: number;
  label: string;
  profile: any;
}

interface GraphEdge {
  source: number;
  target: number;
}

interface PersonaGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const DEVICE_COLORS: Record<string, string> = {
  desktop: '#2dd4bf',
  smartphone: '#a78bfa',
  tablet: '#fbbf24',
};

const PersonaHubTab: React.FC = () => {
  const [companyName, setCompanyName] = useState('Acme Web Shop');
  const [productName, setProductName] = useState('Acme Storefront');
  const [businessCase, setBusinessCase] = useState('usability_test');
  const [dataMode, setDataMode] = useState<'synthetic' | 'company' | 'company_social'>('synthetic');
  const [count, setCount] = useState(24);
  const [seed, setSeed] = useState(42);
  const [graph, setGraph] = useState<PersonaGraph | null>(null);
  const [hubId, setHubId] = useState('');
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/personas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          product_name: productName,
          business_case: businessCase,
          count,
          seed,
        }),
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const body = await response.json();
      setGraph(body.data.graph);
      setHubId(body.artifact_id);
    } catch (caught) {
      setError('Persona API unreachable — start the FastAPI backend (uvicorn backend.app.main:app).');
    } finally {
      setLoading(false);
    }
  };

  // Circular layout with edges; deterministic, no physics dependency.
  const layout = useMemo(() => {
    if (!graph) return null;
    const nodeCount = graph.nodes.length;
    return graph.nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodeCount - Math.PI / 2;
      return { ...node, cx: 50 + 40 * Math.cos(angle), cy: 50 + 40 * Math.sin(angle) };
    });
  }, [graph]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 text-white">
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold"><Users className="text-teal-400" /> Persona Generation</h2>
        <p className="text-xs text-gray-400">Grow a synthetic user group for your company — steering-ready, opinionated, graph-connected.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* In-depth generation form */}
        <div className="space-y-4 rounded-2xl border border-gray-800 bg-[#0c0c0c] p-5">
          {[
            { label: 'Company', value: companyName, set: setCompanyName },
            { label: 'Product', value: productName, set: setProductName },
          ].map((field) => (
            <div key={field.label} className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-gray-500">{field.label}</label>
              <input
                value={field.value}
                onChange={(event) => field.set(event.target.value)}
                className="w-full rounded-xl border border-gray-800 bg-black p-2.5 text-xs outline-none focus:border-teal-500"
              />
            </div>
          ))}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-gray-500">Business case</label>
            <select
              value={businessCase}
              onChange={(event) => setBusinessCase(event.target.value)}
              className="w-full rounded-xl border border-gray-800 bg-black p-2.5 text-xs outline-none focus:border-teal-500"
            >
              <option value="usability_test">Usability test</option>
              <option value="u_test">U-test</option>
              <option value="content_test">Content test</option>
              <option value="branding_test">Branding test</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-gray-500">Data source (spec §16)</label>
            <select
              value={dataMode}
              onChange={(event) => setDataMode(event.target.value as any)}
              className="w-full rounded-xl border border-gray-800 bg-black p-2.5 text-xs outline-none focus:border-teal-500"
            >
              <option value="synthetic">Synthetic only</option>
              <option value="company">Company data (HubSpot / Salesforce)</option>
              <option value="company_social">Company + last30days social</option>
            </select>
            {dataMode !== 'synthetic' && (
              <p className="text-[10px] text-amber-400/80">Run a connector import + /api/datahub/unify first; pass the unified_traits_id.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-gray-500">Personas: {count}</label>
              <input type="range" min={4} max={200} value={count} onChange={(event) => setCount(Number(event.target.value))} className="w-full accent-teal-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-gray-500">Seed</label>
              <input
                type="number"
                value={seed}
                onChange={(event) => setSeed(Number(event.target.value))}
                className="w-full rounded-xl border border-gray-800 bg-black p-2 text-xs outline-none focus:border-teal-500"
              />
            </div>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-xs font-bold transition hover:bg-teal-500"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Generate focus group
          </button>
          {error && <p className="text-[11px] text-rose-400">{error}</p>}
          {hubId && <p className="text-[10px] font-mono text-gray-500">hub: {hubId}</p>}
        </div>

        {/* Persona graph */}
        <div className="relative min-h-[480px] rounded-2xl border border-gray-800 bg-[#050505] p-4">
          {!layout ? (
            <div className="flex h-full min-h-[440px] flex-col items-center justify-center gap-3 text-gray-600">
              <Network size={40} />
              <p className="text-xs">Generate a focus group to grow the persona graph.</p>
            </div>
          ) : (
            <svg viewBox="0 0 100 100" className="h-[480px] w-full">
              {graph!.edges.map((edge, index) => {
                const source = layout[edge.source];
                const target = layout[edge.target];
                if (!source || !target) return null;
                return (
                  <line key={index} x1={source.cx} y1={source.cy} x2={target.cx} y2={target.cy} stroke="#1f2937" strokeWidth={0.2} />
                );
              })}
              {layout.map((node) => (
                <circle
                  key={node.id}
                  cx={node.cx}
                  cy={node.cy}
                  r={selected?.id === node.id ? 2.4 : 1.6}
                  fill={DEVICE_COLORS[node.profile?.physical?.primary_device] || '#2dd4bf'}
                  className="cursor-pointer transition-all"
                  onClick={() => setSelected(node)}
                />
              ))}
            </svg>
          )}

          {selected && (
            <div className="absolute right-4 top-4 w-72 rounded-xl border border-gray-800 bg-black/90 p-4 backdrop-blur">
              <div className="text-sm font-bold text-teal-300">{selected.label}</div>
              <div className="mt-1 text-[11px] text-gray-400">
                {selected.profile.age} · {selected.profile.gender} · {selected.profile.mbti} · {selected.profile.country}
              </div>
              <p className="mt-2 max-h-24 overflow-auto text-[11px] leading-relaxed text-gray-300">{selected.profile.persona}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {['physical', 'mental', 'emotional'].map((block) => (
                  <span key={block} className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-teal-300">
                    {block} ✓
                  </span>
                ))}
              </div>
              <button onClick={() => setSelected(null)} className="mt-3 text-[10px] text-gray-500 hover:text-white">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonaHubTab;
