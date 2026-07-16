import React, { useEffect, useRef, useState } from 'react';
import { Boxes, Database, Figma, Radio, Share2, Sparkles, Users, Zap } from 'lucide-react';
import { api, apiData } from '../services/api';

/**
 * DataHub Render Flow (Phase 3): source flow diagram with green-lightning
 * verified-connection boxes → Render → OASIS streams personas one by one into
 * the graph below, each carrying its READ-ONLY discovered steering.
 */

const SOURCES = [
  { id: 'hubspot', label: 'HubSpot', icon: Database },
  { id: 'salesforce', label: 'Salesforce', icon: Database },
  { id: 'figma', label: 'Figma', icon: Figma },
  { id: 'last30days', label: 'last30days', icon: Radio },
  { id: 'monitoring', label: 'Monitoring', icon: Share2 },
  { id: 'neo4j', label: 'Neo4j', icon: Boxes },
] as const;

interface Health {
  configured: boolean;
  connected: boolean | null;
  detail: string;
}

interface Node {
  id: string;
  index: number;
  label: string;
  profile: any;
  discovered_steering?: any;
  provenance?: any;
}

const SourceBox: React.FC<{ source: (typeof SOURCES)[number]; health?: Health }> = ({ source, health }) => {
  const state = !health
    ? 'verifying'
    : health.connected
    ? 'live'
    : health.connected === false && health.configured
    ? 'failing'
    : health.configured
    ? 'ready'
    : 'off';
  const styles: Record<string, string> = {
    verifying: 'border-amber-500/50 animate-pulse text-amber-300',
    live: 'border-green-500 text-green-300 shadow-[0_0_18px_rgba(34,197,94,0.4)]',
    ready: 'border-teal-500/40 text-teal-300',
    failing: 'border-rose-500/60 text-rose-300',
    off: 'border-dashed border-gray-700 text-gray-500',
  };
  return (
    <div
      title={health?.detail}
      className={`relative flex min-w-[92px] flex-col items-center gap-1 rounded-xl border-2 bg-black/40 px-3 py-2.5 transition ${styles[state]}`}
    >
      {state === 'live' && <Zap size={12} className="absolute -right-1.5 -top-1.5 text-green-400" fill="currentColor" />}
      <source.icon size={16} />
      <span className="text-[10px] font-bold">{source.label}</span>
    </div>
  );
};

const RenderFlow: React.FC = () => {
  const [health, setHealth] = useState<Record<string, Health>>({});
  const [company, setCompany] = useState('Acme Web Shop');
  const [product, setProduct] = useState('Acme Storefront');
  const [businessCase, setBusinessCase] = useState('usability_test');
  const [count, setCount] = useState(16);
  const [hubId, setHubId] = useState('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [target, setTarget] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [selected, setSelected] = useState<Node | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const enrich = async () => {
    setEnriching(true);
    try {
      await api(`/api/personas/${hubId}/enrich`, { body: { batch_size: 10, concurrency: 8 } });
      const graph = await apiData(`/api/personas/${hubId}/graph`);
      setNodes(graph.nodes || []);
    } catch {
      /* enrichment needs a BYOK text model; leave templated text */
    } finally {
      setEnriching(false);
    }
  };

  useEffect(() => {
    SOURCES.forEach((s) =>
      apiData<Health>(`/api/connectors/${s.id}/verify`)
        .then((h) => setHealth((prev) => ({ ...prev, [s.id]: h })))
        .catch(() => undefined),
    );
  }, []);

  const anyGreen = Object.values(health).some((h) => h.connected) || true; // synthetic always allowed

  const render = async () => {
    setRendering(true);
    setNodes([]);
    setSelected(null);
    try {
      const env = await api('/api/personas/generate', {
        body: { company_name: company, product_name: product, business_case: businessCase, count, stream: true },
      });
      const id = env.artifact_id!;
      setHubId(id);
      setTarget(count);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const graph = await apiData(`/api/personas/${id}/graph`);
          setNodes(graph.nodes || []);
          if ((graph.nodes || []).length >= count && pollRef.current) {
            clearInterval(pollRef.current);
            setRendering(false);
          }
        } catch {
          /* keep polling */
        }
      }, 400);
    } catch {
      setRendering(false);
    }
  };

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const cols = Math.ceil(Math.sqrt(Math.max(1, target)));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 text-white">
      {/* Authored "Test setup" — editable, company/test-case scoped */}
      <div className="mb-6 rounded-2xl border border-gray-800 bg-[#0c0c0c] p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
          <Sparkles size={14} /> Test setup <span className="text-[9px] text-gray-500">(authored · editable · this test case)</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company"
            className="rounded-lg border border-gray-800 bg-black p-2 text-xs outline-none focus:border-teal-500" />
          <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Product"
            className="rounded-lg border border-gray-800 bg-black p-2 text-xs outline-none focus:border-teal-500" />
          <select value={businessCase} onChange={(e) => setBusinessCase(e.target.value)}
            className="rounded-lg border border-gray-800 bg-black p-2 text-xs outline-none focus:border-teal-500">
            <option value="usability_test">Usability</option>
            <option value="u_test">U-test</option>
            <option value="content_test">Content</option>
            <option value="branding_test">Branding</option>
          </select>
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            <span>Personas</span>
            <input type="range" min={4} max={60} value={count} onChange={(e) => setCount(+e.target.value)} className="flex-1 accent-teal-500" />
            <span className="w-6 font-mono text-teal-300">{count}</span>
          </div>
          <div className="text-[10px] text-gray-600">Change → Render → new cohort</div>
        </div>
      </div>

      {/* Source flow diagram */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-800 bg-[#050505] p-5">
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => <SourceBox key={s.id} source={s} health={health[s.id]} />)}
        </div>
        <div className="text-gray-600">→</div>
        <div className="rounded-xl border border-gray-700 bg-gray-900/60 px-3 py-2.5 text-[10px] font-bold text-gray-300">Unify</div>
        <div className="text-gray-600">→</div>
        <div className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2.5 text-[10px] font-bold text-violet-300">OASIS generator</div>
        <div className="text-gray-600">→</div>
        <button
          onClick={render}
          disabled={rendering || !anyGreen}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-bold transition hover:bg-teal-500 disabled:opacity-40"
        >
          <Zap size={16} fill="currentColor" /> {rendering ? 'Rendering…' : 'Render'}
        </button>
      </div>

      {/* The graph canvas — personas appear one by one */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-h-[420px] rounded-2xl border border-gray-800 bg-[#050505] p-5">
          {nodes.length === 0 ? (
            <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-3 text-gray-600">
              <Users size={40} />
              <p className="text-xs">Press Render — personas grow into the graph one by one as OASIS generates them.</p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between text-[11px] text-gray-400">
                <span>
                  {rendering ? `Shaping persona ${nodes.length} of ${target}…` : `${nodes.length} personas`}
                  {nodes.at(-1)?.provenance?.datahub_snapshot_ids?.length ? ' · shaped by DataHub cohort' : ' · synthetic'}
                </span>
                {!rendering && hubId && (
                  <button
                    onClick={enrich}
                    disabled={enriching}
                    className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold text-violet-300 transition hover:bg-violet-500/20"
                  >
                    {enriching ? 'Enriching…' : '✨ Enrich (LLM)'}
                  </button>
                )}
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {nodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => setSelected(node)}
                    className={`animate-[fadeIn_0.3s_ease] rounded-xl border p-2 text-left transition ${
                      selected?.id === node.id ? 'border-teal-400 bg-teal-500/10' : 'border-gray-800 bg-gray-950 hover:border-gray-700'
                    }`}
                  >
                    <div className="truncate text-[11px] font-bold text-white">{node.label}</div>
                    <div className="truncate text-[9px] text-gray-500">
                      {node.profile?.age} · {node.profile?.mbti} · {node.profile?.physical?.primary_device}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Per-persona READ-ONLY discovered steering card */}
        <div className="rounded-2xl border border-gray-800 bg-[#0c0c0c] p-5">
          {!selected ? (
            <p className="text-xs text-gray-600">Select a persona to see how it steers the agent.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-bold text-teal-300">{selected.label}</div>
                <div className="text-[10px] text-gray-400">
                  {selected.profile?.age} · {selected.profile?.gender} · {selected.profile?.mbti} · {selected.profile?.country}
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                🔒 backend · read-only steering
              </div>
              <p className="max-h-24 overflow-auto text-[11px] leading-relaxed text-gray-300">{selected.profile?.persona}</p>
              {selected.discovered_steering && (
                <div className="space-y-1.5 border-t border-gray-800 pt-3 text-[10px]">
                  <div className="font-bold uppercase text-gray-500">Because this persona is…</div>
                  {Object.entries(selected.discovered_steering.observing || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="text-gray-400">{k.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-teal-300">{JSON.stringify(v)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400">allowed actions</span>
                    <span className="font-mono text-teal-300">{(selected.discovered_steering.acting_allowed || []).length}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400">frustration abort</span>
                    <span className="font-mono text-rose-300">{selected.discovered_steering.frustration_abort} steps</span>
                  </div>
                </div>
              )}
              {selected.provenance?.datahub_snapshot_ids?.length > 0 && (
                <div className="text-[9px] text-gray-500">shaped by: {selected.provenance.datahub_snapshot_ids.join(', ')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RenderFlow;
