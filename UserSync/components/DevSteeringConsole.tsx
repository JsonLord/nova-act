import React, { useEffect, useState } from 'react';
import { Code2, FlaskConical, History, Lock, Play, RotateCcw, Sliders, Sparkles, Terminal } from 'lucide-react';
import { api, apiData } from '../services/api';
import { useLlmConfig } from '../services/useLlmConfig';
import ModelGate from './ModelGate';

/**
 * Developer steering console (Dev tab). Honors the two-layer differentiation:
 * - Layer 1 DISCOVERED (read-only per persona) — shown locked with a badge.
 * - Layer 1 WRITE via derivation RULESETS — how parameters are computed
 *   (safe formulas), clearly a developer authoring surface.
 * - Layer 2 AUTHORED overrides — per test-case value overrides.
 * - Past-job CORRECTIONS — an audited changelog with undo (not an edit field).
 */

const OVERRIDABLE = [
  'observing.observation_delay_ms', 'observing.scan_pattern', 'observing.fixation_budget',
  'thinking.max_steps', 'thinking.options_considered', 'acting.allowed_actions',
  'acting.timeout_s', 'acting.frustration_abort_after_failed_steps',
];

const Section: React.FC<{ title: string; icon: any; badge?: string; badgeTone?: string; children: React.ReactNode }> = ({
  title, icon: Icon, badge, badgeTone, children,
}) => (
  <div className="rounded-2xl border border-gray-800 bg-[#0c0c0c] p-5">
    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
      <Icon size={14} /> {title}
      {badge && <span className={`rounded-full px-2 py-0.5 text-[9px] ${badgeTone}`}>{badge}</span>}
    </div>
    {children}
  </div>
);

const DevSteeringConsole: React.FC = () => {
  const [hubId, setHubId] = useState('');
  const [personaIndex, setPersonaIndex] = useState(0);
  const [discovered, setDiscovered] = useState<any>(null);
  const [layer, setLayer] = useState('');
  // ruleset (layer-1 write)
  const [rulePath, setRulePath] = useState('thinking.max_steps');
  const [ruleExpr, setRuleExpr] = useState('clamp(digital_literacy * 4, 5, 30)');
  const [rulePreview, setRulePreview] = useState<any>(null);
  // layer-2 override
  const [ovPath, setOvPath] = useState('acting.frustration_abort_after_failed_steps');
  const [ovValue, setOvValue] = useState('1');
  const [effective, setEffective] = useState<any>(null);
  // corrections
  const [corrFolder, setCorrFolder] = useState('journeys');
  const [corrId, setCorrId] = useState('');
  const [corrPath, setCorrPath] = useState('steering.thinking.max_steps.value');
  const [corrValue, setCorrValue] = useState('99');
  const [corrReason, setCorrReason] = useState('reviewer override');
  const [corrLog, setCorrLog] = useState<any[]>([]);
  const [autofill, setAutofill] = useState<any>(null);
  const [autofillNote, setAutofillNote] = useState('');
  const [err, setErr] = useState('');
  const llm = useLlmConfig();

  const seedHub = async () => {
    const env = await api('/api/personas/generate', { body: { company_name: 'Dev', count: 6, seed: 1 } });
    setHubId(env.artifact_id!);
    return env.artifact_id!;
  };

  useEffect(() => {
    seedHub().catch(() => undefined);
  }, []);

  const runDerive = async (rulesetId?: string) => {
    setErr('');
    try {
      const id = hubId || (await seedHub());
      const data = await apiData('/api/steering/derive', {
        body: { persona_hub_id: id, persona_index: personaIndex, ...(rulesetId ? { ruleset_id: rulesetId } : {}) },
      });
      setDiscovered(data.steering);
      setLayer(data.layer);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const previewRuleset = async () => {
    setErr('');
    try {
      const created = await api('/api/steering/rulesets', {
        body: { name: 'dev-preview', rules: { [rulePath]: { type: 'formula', expr: ruleExpr } } },
      });
      const data = await apiData('/api/steering/rulesets/preview', {
        body: { persona_hub_id: hubId, persona_index: personaIndex, ruleset_id: created.artifact_id },
      });
      setRulePreview(data.diff);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const applyOverride = async () => {
    setErr('');
    try {
      let parsed: any = ovValue;
      try { parsed = JSON.parse(ovValue); } catch { /* keep string */ }
      const data = await apiData('/api/steering/apply', {
        body: { persona_hub_id: hubId, persona_index: personaIndex, overrides: { [ovPath]: parsed } },
      });
      setEffective(data.effective_steering);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const runAutofill = async () => {
    setAutofillNote('');
    try {
      const data = await apiData('/api/steering/autofill', { body: { persona_hub_id: hubId, persona_index: personaIndex, goal: 'Find and buy a product' } });
      setAutofill(data);
      setAutofillNote(data.provenance?.llm ? `composed by ${data.provenance.llm}` : 'deterministic values (no LLM)');
    } catch (e: any) {
      setAutofillNote(e.message);
    }
  };

  const injectCorrection = async () => {
    setErr('');
    try {
      let parsed: any = corrValue;
      try { parsed = JSON.parse(corrValue); } catch { /* keep string */ }
      await api('/api/corrections', {
        body: { folder: corrFolder, artifact_id: corrId, path: corrPath, value: parsed, reason: corrReason },
      });
      loadCorrections();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const loadCorrections = async () => {
    if (!corrId) return;
    try {
      const data = await apiData(`/api/corrections/${corrFolder}/${corrId}`);
      setCorrLog(data.corrections || []);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const revert = async () => {
    try {
      await api(`/api/corrections/${corrFolder}/${corrId}/revert`, { method: 'POST' });
      loadCorrections();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-6 py-8 text-white">
      <div className="flex items-center gap-2">
        <Terminal className="text-teal-400" />
        <h2 className="text-xl font-bold">Developer Steering Console</h2>
        <span className="text-[10px] text-gray-500">layer 1 read · layer 1 write (rulesets) · layer 2 · corrections</span>
      </div>
      {err && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-300">{err}</div>}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Layer 1 discovered — read-only */}
        <Section title="Layer 1 · Discovered" icon={Lock} badge="read-only" badgeTone="bg-amber-500/10 text-amber-300">
          <p className="mb-2 text-[10px] text-gray-500">A property of the persona — computed, not editable. `POST /api/steering/derive`.</p>
          <button onClick={() => runDerive()} className="mb-2 flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-[10px] font-bold hover:bg-gray-700">
            <Play size={11} /> Derive
          </button>
          {discovered && (
            <>
              <div className="mb-1 text-[9px] font-mono text-teal-400">{layer}</div>
              <pre className="max-h-56 overflow-auto rounded-lg border border-gray-800 bg-black p-2 text-[9px] leading-relaxed text-gray-300">
                {JSON.stringify(discovered, null, 1)}
              </pre>
            </>
          )}
        </Section>

        {/* Layer 1 WRITE — derivation ruleset */}
        <Section title="Layer 1 · Write (derivation ruleset)" icon={FlaskConical} badge="how params compute" badgeTone="bg-violet-500/10 text-violet-300">
          <p className="mb-2 text-[10px] text-gray-500">Redefine the compute rule via a safe formula over persona features. `POST /api/steering/rulesets`.</p>
          <div className="space-y-2">
            <select value={rulePath} onChange={(e) => setRulePath(e.target.value)}
              className="w-full rounded-lg border border-gray-800 bg-black p-2 text-[11px] outline-none focus:border-violet-500">
              {OVERRIDABLE.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={ruleExpr} onChange={(e) => setRuleExpr(e.target.value)}
              className="w-full rounded-lg border border-gray-800 bg-black p-2 font-mono text-[11px] outline-none focus:border-violet-500" />
            <button onClick={previewRuleset} className="flex items-center gap-1.5 rounded-lg bg-violet-600/80 px-3 py-1.5 text-[10px] font-bold hover:bg-violet-600">
              <Code2 size={11} /> Preview formula
            </button>
          </div>
          {rulePreview && (
            <div className="mt-2 space-y-1 text-[10px]">
              {Object.entries(rulePreview).map(([p, d]: any) => (
                <div key={p} className="flex justify-between font-mono">
                  <span className="text-gray-400">{p}</span>
                  <span><span className="text-gray-500 line-through">{JSON.stringify(d.default)}</span> → <span className="text-violet-300">{JSON.stringify(d.computed)}</span></span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Layer 2 authored override */}
        <Section title="Layer 2 · Authored override" icon={Sliders} badge="test-case" badgeTone="bg-teal-500/10 text-teal-300">
          <p className="mb-2 text-[10px] text-gray-500">Override a final value for this test case. `POST /api/steering/apply`.</p>
          <div className="flex gap-2">
            <select value={ovPath} onChange={(e) => setOvPath(e.target.value)}
              className="flex-1 rounded-lg border border-gray-800 bg-black p-2 text-[11px] outline-none focus:border-teal-500">
              {OVERRIDABLE.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={ovValue} onChange={(e) => setOvValue(e.target.value)}
              className="w-24 rounded-lg border border-gray-800 bg-black p-2 font-mono text-[11px] outline-none focus:border-teal-500" />
            <button onClick={applyOverride} className="rounded-lg bg-teal-600 px-3 text-[10px] font-bold hover:bg-teal-500">Apply</button>
          </div>
          {effective && (
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-gray-800 bg-black p-2 text-[9px] text-gray-300">
              {JSON.stringify(effective[ovPath.split('.')[0]]?.[ovPath.split('.')[1]], null, 1)}
            </pre>
          )}
        </Section>

        {/* LLM Auto-fill — composes the language rows (think-restyle, goal voice) */}
        <Section title="Auto-fill (LLM)" icon={Sparkles} badge="composes language rows" badgeTone="bg-violet-500/10 text-violet-300">
          <p className="mb-2 text-[10px] text-gray-500">Numbers stay deterministic; the BYOK text model composes the persona-voiced think-restyle & goal. `POST /api/steering/autofill`.</p>
          {!llm.textConfigured ? (
            <ModelGate modality="text" loggedIn={llm.loggedIn} what="Auto-fill" />
          ) : (
            <button onClick={runAutofill} className="flex items-center gap-1.5 rounded-lg bg-violet-600/80 px-3 py-1.5 text-[10px] font-bold hover:bg-violet-600">
              <Sparkles size={11} /> Auto-fill from persona
            </button>
          )}
          {autofillNote && <div className="mt-1 text-[9px] text-violet-300">{autofillNote}</div>}
          {autofill && (
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-gray-800 bg-black p-2 text-[9px] text-gray-300">
              {JSON.stringify(autofill.thinking?.think_restyle_instruction, null, 1)}
            </pre>
          )}
        </Section>

        {/* Corrections — audited changelog with undo */}
        <Section title="Past-job corrections" icon={History} badge="audited · reversible" badgeTone="bg-rose-500/10 text-rose-300">
          <p className="mb-2 text-[10px] text-gray-500">Inject a corrected value into a completed artifact. Original kept; every edit logged.</p>
          <div className="grid grid-cols-2 gap-2">
            <select value={corrFolder} onChange={(e) => setCorrFolder(e.target.value)}
              className="rounded-lg border border-gray-800 bg-black p-2 text-[11px] outline-none focus:border-rose-500">
              {['journeys', 'personas', 'analyses', 'steering', 'social_mirror'].map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <input value={corrId} onChange={(e) => setCorrId(e.target.value)} onBlur={loadCorrections} placeholder="artifact id"
              className="rounded-lg border border-gray-800 bg-black p-2 font-mono text-[10px] outline-none focus:border-rose-500" />
            <input value={corrPath} onChange={(e) => setCorrPath(e.target.value)} placeholder="dotted.path"
              className="rounded-lg border border-gray-800 bg-black p-2 font-mono text-[10px] outline-none focus:border-rose-500" />
            <input value={corrValue} onChange={(e) => setCorrValue(e.target.value)} placeholder="new value"
              className="rounded-lg border border-gray-800 bg-black p-2 font-mono text-[10px] outline-none focus:border-rose-500" />
          </div>
          <input value={corrReason} onChange={(e) => setCorrReason(e.target.value)} placeholder="reason"
            className="mt-2 w-full rounded-lg border border-gray-800 bg-black p-2 text-[10px] outline-none focus:border-rose-500" />
          <div className="mt-2 flex gap-2">
            <button onClick={injectCorrection} className="rounded-lg bg-rose-600/80 px-3 py-1.5 text-[10px] font-bold hover:bg-rose-600">Inject correction</button>
            <button onClick={revert} className="flex items-center gap-1 rounded-lg border border-gray-700 px-3 py-1.5 text-[10px] font-bold hover:bg-gray-800">
              <RotateCcw size={11} /> Revert last
            </button>
          </div>
          {corrLog.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-gray-800 pt-2 text-[10px]">
              <div className="font-bold uppercase text-gray-500">Changelog</div>
              {corrLog.map((c, i) => (
                <div key={i} className="font-mono text-gray-400">
                  <span className="text-gray-500">{c.path}</span>: {JSON.stringify(c.from)} → <span className="text-rose-300">{JSON.stringify(c.to)}</span>
                  <span className="text-gray-600"> · {c.reason}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
};

export default DevSteeringConsole;
