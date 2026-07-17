import React, { useEffect, useState } from 'react';
import { BrainCircuit, CheckCircle2, Eye, KeyRound, RefreshCw, Save, XCircle } from 'lucide-react';

/**
 * Bring-your-own-key LLM settings (spec.md Tab 7): two independent slots —
 * a TEXT-ONLY model and a MULTIMODAL (vision) model — each with its own
 * provider, model, and token, saved via /api/account/llm-config and
 * verifiable with a live one-token test call.
 */

interface ProviderMeta {
  id: string;
  label: string;
  base_url: string;
  token_hint: string;
  text_default: string;
  vision_default: string | null;
  supports_vision: boolean;
}

interface SlotState {
  provider: string;
  model: string;
  api_key: string;
  base_url: string;
  keyStored: boolean;
}

const EMPTY_SLOT: SlotState = { provider: 'huggingface', model: '', api_key: '', base_url: '', keyStored: false };

type Modality = 'text' | 'vision';

const SlotCard: React.FC<{
  modality: Modality;
  providers: ProviderMeta[];
  slot: SlotState;
  onChange: (slot: SlotState) => void;
  testResult: { ok: boolean; detail: string } | null;
  onTest: () => void;
  testing: boolean;
}> = ({ modality, providers, slot, onChange, testResult, onTest, testing }) => {
  const isVision = modality === 'vision';
  const usable = providers.filter((provider) => !isVision || provider.supports_vision);
  const meta = usable.find((provider) => provider.id === slot.provider) || usable[0];
  const defaultModel = meta ? (isVision ? meta.vision_default || '' : meta.text_default) : '';

  return (
    <div className="space-y-4 rounded-2xl border border-gray-800 bg-black/40 p-5">
      <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
        {isVision ? <Eye size={14} /> : <BrainCircuit size={14} />}
        {isVision ? 'Multimodal model (vision)' : 'Text-only model'}
      </h4>
      <p className="text-[10px] leading-relaxed text-gray-500">
        {isVision
          ? 'Screenshot analysis, vision-mode journeys. Only vision-capable providers are listed.'
          : 'Persona enrichment, steering auto-fill, graph Q&A, DOM-mode journeys.'}
      </p>

      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-gray-500">Provider</label>
        <select
          value={slot.provider}
          onChange={(event) => {
            const nextMeta = usable.find((provider) => provider.id === event.target.value);
            onChange({
              ...slot,
              provider: event.target.value,
              model: nextMeta ? (isVision ? nextMeta.vision_default || '' : nextMeta.text_default) : '',
              keyStored: false,
            });
          }}
          className="w-full rounded-xl border border-gray-800 bg-black p-2.5 text-xs outline-none focus:border-teal-500"
        >
          {usable.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-gray-500">Model</label>
        <input
          value={slot.model}
          onChange={(event) => onChange({ ...slot, model: event.target.value })}
          placeholder={defaultModel || 'model id'}
          className="w-full rounded-xl border border-gray-800 bg-black p-2.5 text-xs font-mono outline-none focus:border-teal-500"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-gray-500">
          Token {slot.keyStored && <span className="ml-1 rounded-full bg-teal-500/10 px-2 py-0.5 text-[9px] text-teal-300">stored ✓</span>}
        </label>
        <input
          type="password"
          value={slot.api_key}
          onChange={(event) => onChange({ ...slot, api_key: event.target.value })}
          placeholder={slot.keyStored ? 'leave empty to keep stored token' : meta?.token_hint || 'token'}
          className="w-full rounded-xl border border-gray-800 bg-black p-2.5 text-xs font-mono outline-none focus:border-teal-500"
        />
      </div>

      {slot.provider === 'custom' && (
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-gray-500">Base URL (OpenAI-compatible)</label>
          <input
            value={slot.base_url}
            onChange={(event) => onChange({ ...slot, base_url: event.target.value })}
            placeholder="https://my-endpoint.example/v1"
            className="w-full rounded-xl border border-gray-800 bg-black p-2.5 text-xs font-mono outline-none focus:border-teal-500"
          />
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onTest}
          disabled={testing}
          className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-[10px] font-bold text-gray-300 transition hover:border-teal-500/60"
        >
          {testing ? <RefreshCw size={11} className="animate-spin" /> : <KeyRound size={11} />}
          Test call
        </button>
        {testResult && (
          <span className={`flex items-center gap-1 text-[10px] font-bold ${testResult.ok ? 'text-green-400' : 'text-rose-400'}`}>
            {testResult.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {testResult.detail}
          </span>
        )}
      </div>
    </div>
  );
};

const ByokSettings: React.FC = () => {
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [textSlot, setTextSlot] = useState<SlotState>({ ...EMPTY_SLOT });
  const [visionSlot, setVisionSlot] = useState<SlotState>({ ...EMPTY_SLOT });
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [testing, setTesting] = useState<Modality | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [testResults, setTestResults] = useState<Record<Modality, { ok: boolean; detail: string } | null>>({
    text: null,
    vision: null,
  });

  useEffect(() => {
    fetch('/api/account/llm-providers')
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => body?.data && setProviders(body.data))
      .catch(() => undefined);
    fetch('/api/account/llm-config')
      .then((response) => {
        if (response.status === 401) {
          setNeedsLogin(true);
          return null;
        }
        return response.ok ? response.json() : null;
      })
      .then((body) => {
        const config = body?.data;
        if (config?.text) setTextSlot({ ...config.text, api_key: '', keyStored: config.text.api_key_set });
        if (config?.vision) setVisionSlot({ ...config.vision, api_key: '', keyStored: config.vision.api_key_set });
      })
      .catch(() => undefined);
  }, []);

  const save = async () => {
    setSaving(true);
    setSaveNote('');
    try {
      const toSlot = (slot: SlotState) => ({
        provider: slot.provider,
        model: slot.model,
        api_key: slot.api_key, // empty keeps the stored key server-side
        base_url: slot.base_url,
      });
      const response = await fetch('/api/account/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: toSlot(textSlot), vision: toSlot(visionSlot) }),
      });
      setSaveNote(response.ok ? 'Saved — tokens stay masked server-side.' : `Save failed (${response.status})`);
      if (response.ok) {
        const data = (await response.json()).data;
        setTextSlot((slot) => ({ ...slot, api_key: '', keyStored: Boolean(data.text?.api_key_set) }));
        setVisionSlot((slot) => ({ ...slot, api_key: '', keyStored: Boolean(data.vision?.api_key_set) }));
      }
    } catch {
      setSaveNote('API unreachable — start the FastAPI backend.');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async (modality: Modality) => {
    setTesting(modality);
    try {
      const response = await fetch(`/api/account/llm-config/test/${modality}`, { method: 'POST' });
      const body = await response.json();
      setTestResults((results) => ({
        ...results,
        [modality]: response.ok
          ? { ok: body.data.ok, detail: body.data.ok ? `${body.data.provider}/${body.data.model} ✓` : body.data.reply }
          : { ok: false, detail: body.detail || `HTTP ${response.status}` },
      }));
    } catch {
      setTestResults((results) => ({ ...results, [modality]: { ok: false, detail: 'API unreachable' } }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <h3 className="flex items-center gap-2 border-b border-gray-900 pb-2 text-xs font-bold uppercase tracking-wider text-teal-400">
        <KeyRound size={14} /> Bring Your Own Key — LLM providers
      </h3>
      {needsLogin && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-300">
          Sign in with Hugging Face to store keys. Keys are held <b>only for your session</b> (in-memory,
          12h TTL, never written to disk) and are visible only to your logged-in account. Without login,
          pass keys per request via <code className="font-mono">X-LLM-*</code> headers instead.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <SlotCard
          modality="text"
          providers={providers}
          slot={textSlot}
          onChange={setTextSlot}
          testResult={testResults.text}
          onTest={() => runTest('text')}
          testing={testing === 'text'}
        />
        <SlotCard
          modality="vision"
          providers={providers}
          slot={visionSlot}
          onChange={setVisionSlot}
          testResult={testResults.vision}
          onTest={() => runTest('vision')}
          testing={testing === 'vision'}
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        {saveNote && <span className="text-[10px] text-gray-400">{saveNote}</span>}
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-teal-500"
        >
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
          Save keys
        </button>
      </div>
    </div>
  );
};

export default ByokSettings;
