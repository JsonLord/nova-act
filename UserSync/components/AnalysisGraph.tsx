import React, { useMemo, useState } from 'react';
import { GitBranch, MessagesSquare, Sparkles } from 'lucide-react';
import { api, apiData } from '../services/api';

/** Action Trace analysis: build a similarity graph from two demo runs, blend
 * the heatmap/thinking channels, and ask the graph AI questions. */
const DEMO = {
  runs: [
    { run_id: 'r1', persona_id: 'p1', steps: [
      { action: 'agentClick', x: 0.5, y: 0.2, think: 'easy to find the button' },
      { action: 'agentScroll', x: 0.5, y: 0.6, think: 'scrolling for details' },
    ] },
    { run_id: 'r2', persona_id: 'p2', steps: [
      { action: 'agentClick', x: 0.5, y: 0.2, think: 'text too small cannot read' },
      { action: 'agentScroll', x: 0.5, y: 0.6, think: 'lost where is checkout' },
    ] },
  ],
};

const AnalysisGraph: React.FC = () => {
  const [graphId, setGraphId] = useState('');
  const [graph, setGraph] = useState<any>(null);
  const [blend, setBlend] = useState(0.5); // 0 = heatmap, 1 = thinking
  const [decisions, setDecisions] = useState<any[]>([]);
  const [qa, setQa] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const build = async () => {
    setBusy(true);
    try {
      const env = await api('/api/analysis/action-trace', { body: DEMO });
      setGraph(env.data);
      setGraphId(env.artifact_id!);
      const dec = await apiData('/api/analysis/decisions', { body: { action_trace_graph_id: env.artifact_id } });
      setDecisions(dec.findings || []);
    } finally {
      setBusy(false);
    }
  };

  const askGraph = async () => {
    const data = await apiData('/api/graph-research/qa', { body: { graph_id: graphId } });
    setQa(data.qa || []);
  };

  const blended = useMemo(() => {
    if (!graph?.similarities) return [];
    return graph.similarities.map((s: any) => ({
      ...s,
      score: (1 - blend) * s.heatmap_similarity + blend * s.thinking_similarity,
    }));
  }, [graph, blend]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 text-white">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold"><GitBranch className="text-teal-400" /> Action Trace Analysis</h2>
        <button onClick={build} disabled={busy} className="rounded-xl bg-teal-600 px-5 py-2 text-xs font-bold hover:bg-teal-500">
          {busy ? 'Building…' : 'Analyze runs'}
        </button>
      </div>

      {!graph ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-gray-800 bg-[#050505] text-xs text-gray-600">
          Analyze runs to compare how personas acted vs. how they thought.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {/* Blend slider — the core insight */}
            <div className="rounded-2xl border border-gray-800 bg-[#0c0c0c] p-5">
              <div className="mb-2 flex justify-between text-[10px] font-bold uppercase text-gray-500">
                <span>Heatmap similarity</span><span>Thinking similarity</span>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={blend} onChange={(e) => setBlend(+e.target.value)} className="w-full accent-teal-500" />
              <div className="mt-3 space-y-1 text-[11px]">
                {blended.map((s: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="font-mono text-gray-400">{s.a} ↔ {s.b}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-32 rounded-full bg-gray-800"><div className="h-full rounded-full bg-teal-400" style={{ width: `${s.score * 100}%` }} /></div>
                      <span className="w-9 text-right font-mono text-teal-300">{(s.score * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Decision findings — lead with the answer */}
            <div className="rounded-2xl border border-gray-800 bg-[#0c0c0c] p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-teal-400"><Sparkles size={14} /> Decisions</div>
              {decisions.length === 0 ? <p className="text-[11px] text-gray-600">No divergences found.</p> : decisions.map((d, i) => (
                <div key={i} className="mb-2 rounded-xl border border-gray-800 bg-black/40 p-3">
                  <div className="text-[11px] font-bold text-teal-300">{d.decision_candidate}</div>
                  <div className="mt-1 text-[10px] text-gray-400">{d.signal}</div>
                  <div className="mt-1 text-[9px] font-mono text-gray-600">runs: {d.runs.join(', ')} · {d.kind}</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Graph Answers */}
          <div className="rounded-2xl border border-gray-800 bg-[#0c0c0c] p-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-teal-400"><MessagesSquare size={14} /> Graph Answers</div>
              <button onClick={askGraph} className="rounded-lg bg-gray-800 px-2.5 py-1 text-[10px] font-bold hover:bg-gray-700">Ask</button>
            </div>
            {qa.length === 0 ? <p className="text-[11px] text-gray-600">Ask the graph for grounded Q&A.</p> : qa.map((item, i) => (
              <div key={i} className="mb-3">
                <div className="text-[11px] font-bold text-gray-200">{item.question}</div>
                <div className="mt-1 text-[10px] text-gray-400">{item.answer}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisGraph;
