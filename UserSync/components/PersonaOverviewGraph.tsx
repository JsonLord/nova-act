import React, { useEffect, useMemo, useState } from 'react';
import { Braces, Layers, RefreshCw, Share2, User, Users } from 'lucide-react';
import { apiData } from '../services/api';

/**
 * DataHub → Persona Overview graph. Adapts the Mindwalk graph rendering
 * (SVG social ties + absolutely-positioned node buttons + a selection detail
 * panel) to visualize the *imported* persona hub instead of navigation state.
 *
 * Nodes are the generated/imported personas; edges are their OASIS social
 * ties. A colour dimension (profession / country / brand affinity / age band)
 * groups the cohort into arcs so the shape of the audience is legible at a
 * glance. Selecting a persona reveals its profile and its READ-ONLY,
 * backend-owned discovered steering (spec §4 two-layer principle).
 */

interface FocusGroup {
  id: string;
  name: string;
  count: number;
}

interface GraphNode {
  id: string;
  index: number;
  label: string;
  profile: any;
  discovered_steering?: any;
}

interface GraphEdge {
  source: number;
  target: number;
  relation?: string;
}

type Dimension = 'profession' | 'country' | 'affinity' | 'age';

const DIMENSIONS: { id: Dimension; label: string }[] = [
  { id: 'profession', label: 'Profession' },
  { id: 'country', label: 'Country' },
  { id: 'affinity', label: 'Brand affinity' },
  { id: 'age', label: 'Age band' },
];

// A calm, distinguishable categorical ramp (teal→violet family, colour-safe).
const PALETTE = [
  '#2dd4bf', '#a78bfa', '#f472b6', '#fbbf24', '#38bdf8',
  '#34d399', '#fb7185', '#c084fc', '#facc15', '#60a5fa',
  '#f97316', '#4ade80',
];

function bucketOf(node: GraphNode, dimension: Dimension): string {
  const p = node.profile || {};
  if (dimension === 'profession') return p.profession || 'Unspecified';
  if (dimension === 'country') return p.country || 'Unknown';
  if (dimension === 'affinity') {
    const a = p.emotional?.brand_affinity ?? 0;
    return a <= -1 ? 'Hostile' : a === 0 ? 'Neutral' : a >= 2 ? 'Advocate' : 'Warm';
  }
  const age = p.age ?? 0;
  if (age < 25) return '18–24';
  if (age < 35) return '25–34';
  if (age < 50) return '35–49';
  if (age < 65) return '50–64';
  return '65+';
}

const PersonaOverviewGraph: React.FC = () => {
  const [groups, setGroups] = useState<FocusGroup[]>([]);
  const [hubId, setHubId] = useState('');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [dimension, setDimension] = useState<Dimension>('profession');
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadGroups = async () => {
    try {
      const response = await fetch('/api/v1/personas');
      const body = await response.json();
      const list: FocusGroup[] = body.focus_groups || [];
      setGroups(list);
      if (list.length && !hubId) setHubId(list[0].id);
    } catch {
      setError('Could not load persona hubs — start the FastAPI backend.');
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (!hubId) return;
    setLoading(true);
    setError('');
    setSelected(null);
    apiData(`/api/personas/${hubId}/graph`)
      .then((graph: any) => {
        setNodes(graph?.nodes || []);
        setEdges(graph?.edges || []);
      })
      .catch(() => setError('Could not load that persona hub graph.'))
      .finally(() => setLoading(false));
  }, [hubId]);

  // Group personas into arcs by the active colour dimension so the cohort's
  // composition is the visual shape. Deterministic → stable across renders.
  const { positioned, legend } = useMemo(() => {
    const buckets = new Map<string, GraphNode[]>();
    nodes.forEach((node) => {
      const key = bucketOf(node, dimension);
      (buckets.get(key) || buckets.set(key, []).get(key)!).push(node);
    });
    const keys = [...buckets.keys()].sort();
    const colorOf = new Map(keys.map((key, i) => [key, PALETTE[i % PALETTE.length]]));
    const pos = new Map<number, { x: number; y: number; color: string; bucket: string }>();
    const clusters = keys.length;
    keys.forEach((key, ci) => {
      const members = buckets.get(key)!;
      // Each bucket gets a cluster centre on a ring; members orbit the centre.
      const clusterAngle = (Math.PI * 2 * ci) / Math.max(1, clusters) - Math.PI / 2;
      const cx = 0.5 + Math.cos(clusterAngle) * (clusters > 1 ? 0.3 : 0);
      const cy = 0.5 + Math.sin(clusterAngle) * (clusters > 1 ? 0.3 : 0);
      members.forEach((node, mi) => {
        const r = members.length === 1 ? 0 : 0.06 + (mi % 5) * 0.022;
        const a = (Math.PI * 2 * mi) / Math.max(1, members.length);
        pos.set(node.index, {
          x: Math.max(0.05, Math.min(0.95, cx + Math.cos(a) * r)),
          y: Math.max(0.06, Math.min(0.94, cy + Math.sin(a) * r)),
          color: colorOf.get(key)!,
          bucket: key,
        });
      });
    });
    return {
      positioned: pos,
      legend: keys.map((key) => ({ key, color: colorOf.get(key)!, count: buckets.get(key)!.length })),
    };
  }, [nodes, dimension]);

  const degree = useMemo(() => {
    const d = new Map<number, number>();
    edges.forEach((e) => {
      d.set(e.source, (d.get(e.source) || 0) + 1);
      d.set(e.target, (d.get(e.target) || 0) + 1);
    });
    return d;
  }, [edges]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 text-white">
      <div className="mb-6 rounded-3xl border border-teal-500/20 bg-gradient-to-br from-teal-950/40 via-black to-violet-950/30 p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-teal-200">
              <Users size={14} /> Persona overview
            </div>
            <h2 className="text-4xl font-semibold tracking-tight">The imported audience, as one graph.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
              Every node is a persona from the selected hub; edges are their OASIS social ties.
              Colour groups the cohort by a chosen dimension so its composition is visible at a
              glance. Select a persona to read its profile and its <span className="text-teal-300">backend-owned, read-only</span> discovered steering.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Persona hub</label>
            <div className="flex items-center gap-2">
              <select
                value={hubId}
                onChange={(e) => setHubId(e.target.value)}
                className="min-w-[220px] rounded-xl border border-gray-800 bg-black px-3 py-2 text-sm outline-none focus:border-teal-500"
              >
                {groups.length === 0 && <option value="">No hubs yet — generate in Render Flow</option>}
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} · {g.count} personas
                  </option>
                ))}
              </select>
              <button
                onClick={loadGroups}
                title="Refresh hubs"
                className="rounded-xl border border-gray-800 bg-black p-2 text-gray-400 transition hover:border-gray-700 hover:text-white"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Colour dimension selector + legend */}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 rounded-xl border border-gray-800 bg-black/50 p-1">
            <Layers size={13} className="ml-2 mr-1 text-gray-500" />
            {DIMENSIONS.map((d) => (
              <button
                key={d.id}
                onClick={() => setDimension(d.id)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                  dimension === d.id ? 'bg-teal-500/20 text-teal-200' : 'text-gray-400 hover:text-white'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {legend.map((l) => (
              <span key={l.key} className="flex items-center gap-1.5 text-[11px] text-gray-300">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                {l.key} <span className="text-gray-600">· {l.count}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* The persona graph canvas */}
        <div className="relative h-[640px] overflow-hidden rounded-3xl border border-gray-800 bg-[radial-gradient(circle_at_center,_rgba(45,212,191,0.12),_transparent_55%),#030303]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
              <RefreshCw size={16} className="mr-2 animate-spin" /> Loading personas…
            </div>
          )}
          {!loading && nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center text-sm text-gray-500">
              <Share2 size={22} className="text-gray-700" />
              <p>{error || 'No personas in this hub yet. Generate a cohort in the Render Flow view first.'}</p>
            </div>
          )}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {edges.map((edge, index) => {
              const s = positioned.get(edge.source);
              const t = positioned.get(edge.target);
              if (!s || !t) return null;
              return (
                <line
                  key={`${edge.source}-${edge.target}-${index}`}
                  x1={s.x * 100}
                  y1={s.y * 100}
                  x2={t.x * 100}
                  y2={t.y * 100}
                  stroke="rgba(148,163,184,0.18)"
                  strokeWidth="0.16"
                />
              );
            })}
          </svg>
          {nodes.map((node) => {
            const p = positioned.get(node.index);
            if (!p) return null;
            const deg = degree.get(node.index) || 0;
            const size = 10 + Math.min(14, deg * 2); // hubs read larger
            const isSelected = selected?.index === node.index;
            return (
              <button
                key={node.id || node.index}
                onClick={() => setSelected(node)}
                title={`${node.label} · ${p.bucket}`}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition hover:z-10 hover:scale-125 ${
                  isSelected ? 'z-10 ring-2 ring-white' : ''
                }`}
                style={{
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  width: size,
                  height: size,
                  backgroundColor: p.color,
                  borderColor: 'rgba(255,255,255,0.35)',
                }}
              />
            );
          })}
          {nodes.length > 0 && (
            <div className="absolute bottom-3 left-4 text-[11px] text-gray-500">
              {nodes.length} personas · {edges.length} social ties · sized by connections
            </div>
          )}
        </div>

        {/* Selected persona detail */}
        <div className="space-y-4">
          {!selected ? (
            <div className="rounded-3xl border border-gray-800 bg-[#0b0b0b] p-8 text-center text-sm text-gray-500">
              <User size={22} className="mx-auto mb-3 text-gray-700" />
              Select a persona in the graph to inspect its profile and steering.
            </div>
          ) : (
            <>
              <div className="rounded-3xl border border-gray-800 bg-[#0b0b0b] p-6">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-teal-300">
                  <User size={16} /> {selected.profile?.realname || selected.label}
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 text-xs text-gray-300">
                  <span className="text-gray-500">Username</span>
                  <span>@{selected.profile?.username}</span>
                  <span className="text-gray-500">Age</span>
                  <span>{selected.profile?.age}</span>
                  <span className="text-gray-500">Profession</span>
                  <span>{selected.profile?.profession || '—'}</span>
                  <span className="text-gray-500">Country</span>
                  <span>{selected.profile?.country || '—'}</span>
                  <span className="text-gray-500">MBTI</span>
                  <span>{selected.profile?.mbti || '—'}</span>
                  <span className="text-gray-500">Connections</span>
                  <span>{degree.get(selected.index) || 0}</span>
                </div>
                {selected.profile?.interested_topics?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selected.profile.interested_topics.slice(0, 6).map((t: string) => (
                      <span key={t} className="rounded-full border border-gray-800 bg-black px-2 py-0.5 text-[10px] text-gray-400">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {selected.profile?.bio && (
                  <p className="mt-3 text-xs leading-5 text-gray-400">{selected.profile.bio}</p>
                )}
              </div>

              {/* Discovered steering — backend-owned, read-only (badge). */}
              <div className="rounded-3xl border border-violet-500/25 bg-[#0b0b0b] p-6">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-violet-300">
                    <Braces size={16} /> Discovered steering
                  </div>
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-violet-300">
                    backend • read-only
                  </span>
                </div>
                {selected.discovered_steering ? (
                  <pre className="max-h-64 overflow-auto rounded-2xl border border-gray-800 bg-black p-4 text-[11px] leading-5 text-violet-100 whitespace-pre-wrap">
                    {JSON.stringify(selected.discovered_steering, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs leading-5 text-gray-500">
                    This hub was generated without per-node steering summaries. Open the persona in{' '}
                    <span className="text-gray-300">Render Flow</span> (streamed generation) or query{' '}
                    <code className="text-gray-400">/api/personas/{'{hub}'}/steering/{selected.index}</code> for the full derivation.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonaOverviewGraph;
