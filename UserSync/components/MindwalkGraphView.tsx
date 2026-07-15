import React, { useMemo, useState } from 'react';
import { BrainCircuit, GitBranch, ShieldAlert, Sparkles } from 'lucide-react';
import { buildMindwalkGraph, buildNovaActPrompt, limitationFunctions, MindwalkNode } from '../services/mindwalkAdapter';
import { publishTabEvent } from '../services/tabBus';

interface MindwalkGraphViewProps {
  activeTab?: string;
  activeView?: string;
}

const stateColor: Record<string, string> = {
  unvisited: 'bg-gray-800 border-gray-700 text-gray-400',
  seen: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200',
  read: 'bg-sky-500/15 border-sky-300/40 text-sky-100',
  edited: 'bg-amber-500/20 border-amber-300/50 text-amber-100 shadow-amber-900/40',
  limited: 'bg-rose-500/20 border-rose-300/50 text-rose-100 shadow-rose-950/40',
};

const MindwalkGraphView: React.FC<MindwalkGraphViewProps> = ({ activeTab = 'nova-act', activeView = 'mindwalk' }) => {
  const graph = useMemo(() => buildMindwalkGraph(activeTab, activeView), [activeTab, activeView]);
  const [selected, setSelected] = useState<MindwalkNode>(graph.nodes.find((node) => node.id === `${activeTab}:${activeView}`) || graph.nodes[0]);
  const prompt = buildNovaActPrompt(selected);

  const injectLimitations = () => {
    fetch('/api/nova-act/limitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limitationIds: selected.limitationIds, prompt }),
    }).catch((error) => console.error('Failed to inject Nova Act limitations:', error));
    publishTabEvent({
      source: 'mindwalk',
      target: 'nova-act',
      action: 'limitations.inject',
      payload: {
        nodeId: selected.id,
        prompt,
        limitationIds: selected.limitationIds,
      },
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 text-white">
      <div className="mb-6 rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/40 via-black to-teal-950/30 p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-indigo-200">
              <BrainCircuit size={14} /> Mindwalk + OmniParser adapter
            </div>
            <h2 className="text-4xl font-semibold tracking-tight">Parse UI into LLM language, then steer navigation.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
              Mindwalk keeps the navigation graph and touch-state memory; OmniParser is the UI-to-LLM transitioner that converts screen elements into grounded language Nova Act can use for actions and guardrails.
            </p>
          </div>
          <button onClick={injectLimitations} className="rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-400">
            Inject selected limitations
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="relative h-[640px] overflow-hidden rounded-3xl border border-gray-800 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.16),_transparent_55%),#030303]">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {graph.edges.map((edge, index) => {
              const source = graph.nodes.find((node) => node.id === edge.source);
              const target = graph.nodes.find((node) => node.id === edge.target);
              if (!source || !target) return null;
              return <line key={`${edge.source}-${edge.target}-${index}`} x1={source.x * 100} y1={source.y * 100} x2={target.x * 100} y2={target.y * 100} stroke="rgba(148,163,184,0.24)" strokeWidth="0.22" />;
            })}
          </svg>
          {graph.nodes.map((node) => (
            <button
              key={node.id}
              onClick={() => setSelected(node)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-2 text-left text-[11px] shadow-xl transition hover:scale-105 ${stateColor[node.state]} ${selected.id === node.id ? 'ring-2 ring-white/70' : ''}`}
              style={{ left: `${node.x * 100}%`, top: `${node.y * 100}%`, opacity: 0.58 + node.intensity * 0.42 }}
            >
              <div className="font-bold capitalize">{node.label}</div>
              <div className="text-[9px] uppercase tracking-widest opacity-70">{node.kind}</div>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-gray-800 bg-[#0b0b0b] p-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-teal-300"><GitBranch size={16} /> Selected OmniParser UI-to-LLM node</div>
            <h3 className="text-2xl font-bold capitalize">{selected.label}</h3>
            <p className="mt-3 text-sm leading-6 text-gray-300">{selected.llmPhrase}</p><p className="mt-2 text-xs leading-5 text-indigo-200">{selected.omniParserPhrase}</p>
            <pre className="mt-4 max-h-52 overflow-auto rounded-2xl border border-gray-800 bg-black p-4 text-xs text-indigo-100 whitespace-pre-wrap">{prompt}</pre>
          </div>

          <div className="rounded-3xl border border-gray-800 bg-[#0b0b0b] p-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-rose-300"><ShieldAlert size={16} /> Limitation functions</div>
            <div className="space-y-3">
              {limitationFunctions.map((limitation) => (
                <div key={limitation.id} className="rounded-2xl border border-gray-800 bg-black/50 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold"><Sparkles size={14} className="text-rose-300" />{limitation.label}</div>
                  <p className="mt-2 text-xs leading-5 text-gray-400">{limitation.guardrail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MindwalkGraphView;
