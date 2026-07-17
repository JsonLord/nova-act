import React, { useEffect, useRef, useState } from 'react';
import { useLlmConfig } from '../services/useLlmConfig';
import { Bot, CircleDot, History, MousePointerClick, Play, RefreshCw, Sparkles } from 'lucide-react';

/**
 * Journey console (spec.md Tab 1, Nova-chat-parity shell): session list on
 * the left, step/think stream in the center, composer at the bottom. Runs
 * execute on the OpenEngine (spec §17) with the caller's BYOK text model;
 * progress streams via polling GET /api/journeys/{id}.
 */

interface JourneyStep {
  i: number;
  think: string;
  action: string;
  args: Record<string, unknown>;
  ok?: boolean;
  error?: string;
  screenshot?: string | null;
  perceived?: number;
  missed?: number;
  missed_elements?: { text: string; reason: string }[];
}

interface JourneyRun {
  status: string;
  target_url: string;
  goal: string;
  steps: JourneyStep[];
  result?: string;
}

const STATUS_COLORS: Record<string, string> = {
  running: 'text-teal-300',
  starting: 'text-teal-300',
  completed: 'text-green-400',
  failed: 'text-rose-400',
  queued: 'text-amber-300',
};

const StepCard: React.FC<{ step: JourneyStep; runId: string }> = ({ step, runId }) => (
  <div className="flex gap-3">
    {/* Evidence: the screenshot the persona actually saw (optically degraded). */}
    {step.screenshot && (
      <img
        src={`/api/journeys/${runId}/screenshot/${step.i}`}
        alt={`step ${step.i}`}
        className="h-20 w-28 flex-shrink-0 rounded-lg border border-gray-800 object-cover object-top"
      />
    )}
    <div className="min-w-0 flex-1 space-y-2">
      {step.think && (
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-gray-800 bg-[#101014] p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-violet-300">
            <Sparkles size={10} /> think
          </div>
          <p className="text-xs leading-relaxed text-gray-300">{step.think}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 pl-2">
        <MousePointerClick size={12} className={step.ok === false ? 'text-rose-400' : 'text-teal-400'} />
        <code className="rounded-lg bg-black px-2 py-1 text-[11px] text-teal-200">
          {step.action}({JSON.stringify(step.args)})
        </code>
        {step.error && <span className="text-[10px] text-rose-400">{step.error}</span>}
        {/* Perception delta — saw vs missed. */}
        {(step.perceived != null || step.missed != null) && (
          <span
            className="text-[9px] text-gray-500"
            title={(step.missed_elements || []).map((m) => `${m.text || 'element'}: ${m.reason}`).join('\n')}
          >
            👁 saw {step.perceived ?? 0}{step.missed ? ` · missed ${step.missed}` : ''}
          </span>
        )}
      </div>
    </div>
  </div>
);

const JourneyConsole: React.FC = () => {
  const [runs, setRuns] = useState<{ artifact_id: string; provenance?: any }[]>([]);
  const [activeRunId, setActiveRunId] = useState('');
  const [run, setRun] = useState<JourneyRun | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [url, setUrl] = useState('https://example.com');
  const [goal, setGoal] = useState('');
  const [personaHubId, setPersonaHubId] = useState('');
  const [visionMode, setVisionMode] = useState(false);
  const [launching, setLaunching] = useState(false);
  const llm = useLlmConfig();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRuns = () =>
    fetch('/api/journeys')
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => body?.data && setRuns(body.data.reverse()))
      .catch(() => undefined);

  useEffect(() => {
    loadRuns();
  }, []);

  const openRun = (runId: string) => {
    setActiveRunId(runId);
    if (pollRef.current) clearInterval(pollRef.current);
    const poll = async () => {
      try {
        const response = await fetch(`/api/journeys/${runId}`);
        if (!response.ok) return;
        const body = await response.json();
        setRun(body.data);
        if (!['running', 'starting'].includes(body.data.status) && pollRef.current) {
          clearInterval(pollRef.current);
        }
      } catch {
        /* keep polling */
      }
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
  };

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const launch = async () => {
    if (!goal.trim()) return;
    setLaunching(true);
    setWarnings([]);
    try {
      const response = await fetch('/api/journeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_url: url,
          goal,
          vision_mode: visionMode,
          ...(personaHubId ? { persona_hub_id: personaHubId, persona_index: 0 } : {}),
        }),
      });
      const body = await response.json();
      if (response.ok) {
        setWarnings(body.warnings || []);
        await loadRuns();
        openRun(body.artifact_id);
        setGoal('');
      } else {
        setWarnings([body.detail || `HTTP ${response.status}`]);
      }
    } catch {
      setWarnings(['API unreachable — start the FastAPI backend.']);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="mx-auto grid h-[calc(100vh-140px)] max-w-[1600px] grid-cols-[240px_1fr] gap-0 px-4 py-4 text-white">
      {/* Session list */}
      <aside className="overflow-y-auto border-r border-gray-800 pr-3">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          <History size={12} /> Journeys
        </div>
        {runs.length === 0 && <p className="text-[11px] text-gray-600">No runs yet.</p>}
        {runs.map((entry) => (
          <button
            key={entry.artifact_id}
            onClick={() => openRun(entry.artifact_id)}
            className={`mb-1 w-full rounded-xl border p-2.5 text-left text-[11px] transition ${
              entry.artifact_id === activeRunId
                ? 'border-teal-500/40 bg-teal-500/10 text-teal-200'
                : 'border-transparent text-gray-400 hover:bg-gray-900'
            }`}
          >
            <div className="truncate font-mono">{entry.artifact_id}</div>
            <div className="truncate text-[9px] opacity-60">
              {entry.provenance?.engine} · {entry.provenance?.llm || 'no model'}
            </div>
          </button>
        ))}
      </aside>

      {/* Thread + composer */}
      <section className="flex min-w-0 flex-col pl-4">
        <header className="flex items-center justify-between border-b border-gray-800 pb-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Bot size={16} className="text-teal-400" />
            {run ? run.goal : 'Nova Console — persona-steered journeys'}
          </div>
          {run && (
            <span className={`flex items-center gap-1.5 text-[11px] font-bold ${STATUS_COLORS[run.status] || 'text-gray-400'}`}>
              {['running', 'starting'].includes(run.status)
                ? <RefreshCw size={11} className="animate-spin" />
                : <CircleDot size={11} />}
              {run.status}
            </span>
          )}
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          {!run && (
            <p className="pt-16 text-center text-xs text-gray-600">
              Launch a journey below — the agent's steps and thinking stream here, one act at a time.
            </p>
          )}
          {run?.steps.map((step) => <StepCard key={step.i} step={step} runId={activeRunId} />)}
          {run?.result && (
            <div className={`rounded-2xl border p-3 text-xs ${run.status === 'completed' ? 'border-green-500/30 bg-green-500/5 text-green-300' : 'border-rose-500/30 bg-rose-500/5 text-rose-300'}`}>
              {run.result}
            </div>
          )}
        </div>

        {warnings.map((warning) => (
          <p key={warning} className="mb-1 text-[10px] text-amber-400">{warning}</p>
        ))}

        {/* Composer */}
        <div className="flex flex-col gap-2 rounded-2xl border border-gray-800 bg-[#0c0c0c] p-3">
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://target-site.com"
              className="w-2/5 rounded-xl border border-gray-800 bg-black p-2.5 text-xs font-mono outline-none focus:border-teal-500"
            />
            <input
              value={personaHubId}
              onChange={(event) => setPersonaHubId(event.target.value)}
              placeholder="persona hub id (optional — steers the agent)"
              className="flex-1 rounded-xl border border-gray-800 bg-black p-2.5 text-xs font-mono outline-none focus:border-teal-500"
            />
            <button
              onClick={() => setVisionMode((v) => !v)}
              disabled={!llm.visionConfigured}
              title={llm.visionConfigured ? 'Decide from screenshots (vision model)' : 'Needs a BYOK vision model'}
              className={`rounded-xl border px-3 text-[11px] font-bold transition disabled:opacity-40 ${
                visionMode ? 'border-violet-500 bg-violet-500/15 text-violet-300' : 'border-gray-800 bg-black text-gray-400 hover:border-gray-700'
              }`}
            >
              👁 Vision
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && launch()}
              placeholder="Describe the journey goal — e.g. Find and buy a two-person tent"
              className="flex-1 rounded-xl border border-gray-800 bg-black p-3 text-sm outline-none focus:border-teal-500"
            />
            <button
              onClick={launch}
              disabled={launching || !goal.trim()}
              className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 text-xs font-bold transition hover:bg-teal-500 disabled:opacity-40"
            >
              {launching ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
              Run
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default JourneyConsole;
