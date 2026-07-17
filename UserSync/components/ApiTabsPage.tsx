import React, { useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Play, Server } from 'lucide-react';

type Field = { name: string; label: string; type?: 'text' | 'number' | 'textarea'; placeholder?: string; defaultValue?: string | number };
type TabSpec = { id: string; title: string; description: string; endpoint: string; fields: Field[] };

const TAB_SPECS: TabSpec[] = [
  { id: 'focus-groups', title: '1. Focus Groups', description: 'List available focus groups for the workspace.', endpoint: '/api/tabs/focus-groups/run', fields: [] },
  { id: 'generate-personas', title: '2. Generate Personas', description: 'Generate personas from business and customer context.', endpoint: '/api/tabs/generate-personas/run', fields: [
    { name: 'business_description', label: 'Business Description', type: 'textarea', placeholder: 'What does the company do?' },
    { name: 'customer_profile', label: 'Customer Profile', type: 'textarea', placeholder: 'Who should be represented?' },
    { name: 'num_personas', label: 'Persona Count', type: 'number', defaultValue: 3 },
  ] },
  { id: 'identify-personas', title: '3. Identify Personas', description: 'Identify relevant personas from a pasted context.', endpoint: '/api/tabs/identify-personas/run', fields: [
    { name: 'context', label: 'Context', type: 'textarea', placeholder: 'Paste campaign or product context.' },
  ] },
  { id: 'social-network', title: '4. Social Network', description: 'Generate a persona network graph for a focus group.', endpoint: '/api/tabs/social-network/run', fields: [
    { name: 'name', label: 'Network Name', placeholder: 'Launch audience network' },
    { name: 'persona_count', label: 'Persona Count', type: 'number', defaultValue: 10 },
    { name: 'network_type', label: 'Network Type', defaultValue: 'scale_free' },
    { name: 'focus_group_name', label: 'Focus Group Name', placeholder: 'Optional existing focus group' },
  ] },
  { id: 'start-simulation', title: '5. Start Simulation', description: 'Start an async content simulation.', endpoint: '/api/tabs/start-simulation/run', fields: [
    { name: 'simulation_id', label: 'Simulation / Focus Group ID' },
    { name: 'content_text', label: 'Content Text', type: 'textarea' },
    { name: 'format', label: 'Format', defaultValue: 'text' },
  ] },
  { id: 'simulation-status', title: '6. Simulation Status', description: 'Fetch status and results for a running simulation.', endpoint: '/api/tabs/simulation-status/run', fields: [
    { name: 'simulation_id', label: 'Simulation Job ID' },
  ] },
  { id: 'chat-message', title: '7. Chat Message', description: 'Send a chat message to a simulation context.', endpoint: '/api/tabs/chat-message/run', fields: [
    { name: 'simulation_id', label: 'Simulation ID' },
    { name: 'sender', label: 'Sender', defaultValue: 'User' },
    { name: 'message', label: 'Message', type: 'textarea' },
  ] },
  { id: 'chat-history', title: '8. Chat History', description: 'Load chat history for a simulation.', endpoint: '/api/tabs/chat-history/run', fields: [
    { name: 'simulation_id', label: 'Simulation ID' },
  ] },
  { id: 'variants', title: '9. Generate Variants', description: 'Generate content variants for testing.', endpoint: '/api/tabs/variants/run', fields: [
    { name: 'content_text', label: 'Content Text', type: 'textarea' },
    { name: 'num_variants', label: 'Variant Count', type: 'number', defaultValue: 5 },
  ] },
  { id: 'export', title: '10. Export & Personas', description: 'Export simulation data, personas, or graph details.', endpoint: '/api/tabs/export/run', fields: [
    { name: 'simulation_id', label: 'Simulation ID' },
    { name: 'action', label: 'Action', defaultValue: 'export_simulation' },
    { name: 'persona_name', label: 'Persona Name', placeholder: 'Only needed for get_persona' },
  ] },
];

const ApiTabsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeId, setActiveId] = useState(TAB_SPECS[0].id);
  const active = useMemo(() => TAB_SPECS.find((tab) => tab.id === activeId) || TAB_SPECS[0], [activeId]);
  const [formValues, setFormValues] = useState<Record<string, string | number>>({});
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const updateValue = (name: string, value: string) => setFormValues((prev) => ({ ...prev, [name]: value }));

  const runTab = async () => {
    setIsLoading(true);
    setResult(null);
    const body = Object.fromEntries(active.fields.map((field) => [field.name, formValues[field.name] ?? field.defaultValue ?? '']));
    try {
      const response = await fetch(active.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      setResult(response.ok ? data : { error: data });
    } catch (error) {
      setResult({ error: String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10">
      <button onClick={onBack} className="mb-8 flex items-center gap-2 text-sm text-gray-400 hover:text-white">
        <ArrowLeft size={16} /> Back to UserSync UI
      </button>
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-2xl border border-teal-500/40 bg-teal-500/10 p-3 text-teal-300"><Server /></div>
        <div>
          <h1 className="text-3xl font-bold">UserSync API Tabs</h1>
          <p className="text-sm text-gray-400">Ten same-origin FastAPI tabs hosted from this Hugging Face Space URL.</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {TAB_SPECS.map((tab) => (
            <button key={tab.id} onClick={() => { setActiveId(tab.id); setResult(null); }} className={`w-full rounded-xl border p-4 text-left transition ${activeId === tab.id ? 'border-teal-500 bg-teal-950/30' : 'border-gray-800 bg-gray-950 hover:border-gray-600'}`}>
              <div className="font-semibold">{tab.title}</div>
              <div className="mt-1 text-xs text-gray-500">{tab.description}</div>
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-gray-800 bg-[#080808] p-6">
          <div className="mb-6">
            <div className="text-xs uppercase tracking-widest text-teal-400">{active.endpoint}</div>
            <h2 className="mt-2 text-2xl font-bold">{active.title}</h2>
            <p className="mt-1 text-sm text-gray-400">{active.description}</p>
          </div>
          <div className="space-y-4">
            {active.fields.map((field) => (
              <label key={field.name} className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{field.label}</span>
                {field.type === 'textarea' ? (
                  <textarea className="h-28 w-full rounded-xl border border-gray-800 bg-black p-3 text-sm outline-none focus:border-teal-500" placeholder={field.placeholder} value={String(formValues[field.name] ?? field.defaultValue ?? '')} onChange={(e) => updateValue(field.name, e.target.value)} />
                ) : (
                  <input type={field.type || 'text'} className="w-full rounded-xl border border-gray-800 bg-black p-3 text-sm outline-none focus:border-teal-500" placeholder={field.placeholder} value={String(formValues[field.name] ?? field.defaultValue ?? '')} onChange={(e) => updateValue(field.name, e.target.value)} />
                )}
              </label>
            ))}
            <button onClick={runTab} disabled={isLoading} className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-black hover:bg-gray-200 disabled:opacity-60">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run Tab Endpoint
            </button>
          </div>
          <div className="mt-6 rounded-xl border border-gray-800 bg-black p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Response</div>
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-xs text-gray-300">{result ? JSON.stringify(result, null, 2) : 'Run this tab to see the FastAPI response.'}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiTabsPage;
