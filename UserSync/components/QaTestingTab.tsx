import React, { useState } from 'react';
import { Shield, Play, Terminal, CheckCircle2, AlertCircle, Trash, Plus, FileText, Settings, Loader2 } from 'lucide-react';

interface QaTestFlow {
  id: string;
  name: string;
  url: string;
  steps: string[];
  status: 'passed' | 'failed' | 'idle' | 'running';
  runtime?: string;
}

const INITIAL_FLOWS: QaTestFlow[] = [
  {
    id: '1',
    name: 'User Onboarding Pipeline',
    url: 'https://huggingface.co/join',
    steps: [
      "act('fill email with test@example.com')",
      "act('click #submit-btn')",
      "act_get('check if verify message is visible')"
    ],
    status: 'passed',
    runtime: '3.4s'
  },
  {
    id: '2',
    name: 'Model Space Launch Flow',
    url: 'https://huggingface.co/spaces',
    steps: [
      "act('click .new-space-button')",
      "act('fill #space-name with my-super-agent')",
      "act_get('assert checkout status is active')"
    ],
    status: 'failed',
    runtime: '5.1s'
  }
];

const QaTestingTab: React.FC = () => {
  const [flows, setFlows] = useState<QaTestFlow[]>(INITIAL_FLOWS);
  const [selectedFlow, setSelectedFlow] = useState<QaTestFlow | null>(INITIAL_FLOWS[0]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [newStep, setNewStep] = useState('');
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  const handleRunFlow = (flow: QaTestFlow) => {
    setIsExecuting(true);
    setConsoleLogs([
      `[${new Date().toLocaleTimeString()}] Initializing QA Test Suite: ${flow.name}...`,
      `[${new Date().toLocaleTimeString()}] Setting up sandbox browser context...`,
      `[${new Date().toLocaleTimeString()}] Target: ${flow.url}`
    ]);

    // Update state to running
    setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, status: 'running' } : f));

    // Simulate steps execution
    let currentIdx = 0;
    const runInterval = setInterval(() => {
      if (currentIdx < flow.steps.length) {
        const step = flow.steps[currentIdx];
        setConsoleLogs(prev => [...prev, `[EXEC] Running SDK command: ${step}... OK`]);
        currentIdx++;
      } else {
        clearInterval(runInterval);
        setIsExecuting(false);
        const randomOutcome = Math.random() > 0.15 ? 'passed' : 'failed';
        setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, status: randomOutcome, runtime: '4.8s' } : f));
        setConsoleLogs(prev => [
          ...prev,
          `[RESULT] Suite completed. Outcome: ${randomOutcome.toUpperCase()}`,
          `[REPORT] PDF Report generated successfully.`
        ]);
        // Update local detail state
        if (selectedFlow?.id === flow.id) {
          setSelectedFlow(prev => prev ? { ...prev, status: randomOutcome, runtime: '4.8s' } : null);
        }
      }
    }, 1000);
  };

  const handleAddStep = () => {
    if (!newStep.trim() || !selectedFlow) return;
    const updatedFlow = {
      ...selectedFlow,
      steps: [...selectedFlow.steps, newStep]
    };
    setFlows(prev => prev.map(f => f.id === selectedFlow.id ? updatedFlow : f));
    setSelectedFlow(updatedFlow);
    setNewStep('');
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 text-white grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Test cases selection panel */}
      <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 space-y-6 h-fit">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="text-red-400" size={20} />
            <h2 className="font-bold text-base">QA Test Suite</h2>
          </div>
          <span className="text-xs bg-gray-900 border border-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
            {flows.length} Flows
          </span>
        </div>

        <div className="space-y-2">
          {flows.map((flow) => (
            <div
              key={flow.id}
              onClick={() => setSelectedFlow(flow)}
              className={`p-4 rounded-xl cursor-pointer border transition-all flex items-center justify-between ${
                selectedFlow?.id === flow.id
                  ? 'bg-red-950/10 border-red-500/30 text-white'
                  : 'bg-black/40 border-gray-900 hover:border-gray-800 text-gray-300'
              }`}
            >
              <div className="space-y-1 max-w-[70%]">
                <h4 className="font-semibold text-sm truncate">{flow.name}</h4>
                <p className="text-[10px] text-gray-500 truncate">{flow.url}</p>
              </div>
              <div className="flex items-center gap-2">
                {flow.status === 'passed' && <CheckCircle2 size={16} className="text-green-500" />}
                {flow.status === 'failed' && <AlertCircle size={16} className="text-red-500" />}
                {flow.status === 'running' && <Loader2 size={16} className="text-red-400 animate-spin" />}
                {flow.status === 'idle' && <span className="w-2 h-2 rounded-full bg-gray-600"></span>}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunFlow(flow);
                  }}
                  disabled={isExecuting}
                  className="p-1.5 bg-gray-900 border border-gray-800 hover:border-gray-700 text-red-400 hover:text-white rounded-lg transition-all"
                >
                  <Play size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="w-full py-3 bg-red-950/20 border border-red-900/30 text-red-400 text-xs font-bold rounded-xl hover:bg-red-950/40 transition-all flex items-center justify-center gap-1.5">
          <Plus size={14} />
          Create New Flow Test
        </button>
      </div>

      {/* Execution panel and visual steps editor */}
      <div className="lg:col-span-2 bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 flex flex-col justify-between min-h-[500px]">
        {selectedFlow ? (
          <div className="space-y-6 flex-1">
            <div className="border-b border-gray-800 pb-4 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-100">{selectedFlow.name}</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">Target: {selectedFlow.url}</p>
              </div>
              <div className="flex items-center gap-3">
                {selectedFlow.runtime && (
                  <span className="text-[10px] bg-gray-900 border border-gray-800 px-2 py-1 rounded font-mono text-gray-400">
                    Runtime: {selectedFlow.runtime}
                  </span>
                )}
                <button
                  onClick={() => handleRunFlow(selectedFlow)}
                  disabled={isExecuting}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-red-900/20 disabled:opacity-50"
                >
                  <Play size={10} />
                  Execute Suite
                </button>
              </div>
            </div>

            {/* Test script steps list */}
            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Test Automation Instructions (act & act_get)</label>
              <div className="space-y-1">
                {selectedFlow.steps.map((step, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-black/50 border border-gray-900 rounded-xl px-4 py-3 text-xs font-mono text-gray-300">
                    <div className="flex gap-3">
                      <span className="text-red-500/80 font-bold">{idx + 1}</span>
                      <span>{step}</span>
                    </div>
                    <button className="text-gray-600 hover:text-red-400 transition-colors">
                      <Trash size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add instruction input */}
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                  className="flex-1 bg-black border border-gray-800 rounded-xl p-3 text-xs font-mono text-white outline-none focus:border-red-500"
                  placeholder="e.g. act('click .submit')"
                />
                <button
                  onClick={handleAddStep}
                  className="px-4 py-3 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl text-xs font-bold hover:text-white transition-all flex items-center gap-1"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {/* Execution logs output */}
            <div className="space-y-2 pt-4">
              <label className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Terminal size={14} />
                Live Execution Logs
              </label>
              <div className="w-full h-36 bg-black border border-gray-800 rounded-xl p-3 font-mono text-[10px] text-red-400/90 overflow-y-auto space-y-1">
                {consoleLogs.length === 0 ? (
                  <span className="text-gray-600 italic">No logging information. Execute flow test to spin up the runner logs.</span>
                ) : (
                  consoleLogs.map((log, idx) => <p key={idx}>{log}</p>)
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500 italic">
            Select a test flow from the side panel to view scripts and start assertions.
          </div>
        )}

        {/* Reports Download Footer */}
        {selectedFlow && selectedFlow.status !== 'idle' && selectedFlow.status !== 'running' && (
          <div className="border-t border-gray-900 pt-4 mt-6 flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1"><FileText size={12} /> HTML & XML Reports Ready</span>
            <button className="flex items-center gap-1 text-red-400 font-bold hover:underline">
              <Settings size={12} /> Download Raw Artifacts
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QaTestingTab;