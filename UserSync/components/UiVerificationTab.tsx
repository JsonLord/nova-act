import React, { useState } from 'react';
import { Eye, CheckCircle2, AlertCircle, RefreshCw, Layers, ShieldAlert, BarChart3, Download, Play } from 'lucide-react';

interface VerificationTask {
  id: string;
  name: string;
  tool: string;
  status: 'passed' | 'failed' | 'running' | 'idle';
  difference?: string;
}

const UI_TASKS: VerificationTask[] = [
  { id: '1', name: 'Verify Header Color Theme Contrast', tool: 'verify_contrast()', status: 'passed' },
  { id: '2', name: 'Verify Logo SVG Aspect Ratio Checksum', tool: 'verify_checksum()', status: 'passed' },
  { id: '3', name: 'Compare Landing Hero Visual Regression Pixels', tool: 'verify_pixels()', status: 'failed', difference: '3.4% pixel mismatch' },
  { id: '4', name: 'Check Interactive Demo DOM Accessibility Guidelines', tool: 'verify_accessibility()', status: 'passed' }
];

const UiVerificationTab: React.FC = () => {
  const [tasks, setTasks] = useState<VerificationTask[]>(UI_TASKS);
  const [isVerifying, setIsVerifying] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const handleRunVerification = () => {
    setIsVerifying(true);
    setLog([
      'Loading nova-act-mcp deterministic models...',
      'Starting visual screenshot matching buffers...',
      'Running accessibility markup parser...'
    ]);

    // Set all to running
    setTasks(prev => prev.map(t => ({ ...t, status: 'running' })));

    setTimeout(() => {
      setIsVerifying(false);
      setTasks([
        { id: '1', name: 'Verify Header Color Theme Contrast', tool: 'verify_contrast()', status: 'passed' },
        { id: '2', name: 'Verify Logo SVG Aspect Ratio Checksum', tool: 'verify_checksum()', status: 'passed' },
        { id: '3', name: 'Compare Landing Hero Visual Regression Pixels', tool: 'verify_pixels()', status: 'passed' },
        { id: '4', name: 'Check Interactive Demo DOM Accessibility Guidelines', tool: 'verify_accessibility()', status: 'passed' }
      ]);
      setLog(prev => [
        ...prev,
        'Accessibility: Passed wcag AA guidelines.',
        'Visual mismatch buffer: 0.00% difference detected.',
        'Deterministic layout check complete. Report written to verify_features.spec.ts.'
      ]);
    }, 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 text-white grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Visual regression and layout tools controls */}
      <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 space-y-6 h-fit">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Eye className="text-orange-400" size={20} />
            UI Verification Suite
          </h2>
          <p className="text-xs text-gray-400">Run pixel-perfect deterministic tests and contrast checks via `nova-act-mcp` tools.</p>
        </div>

        <div className="space-y-4">
          <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-orange-400">
              <ShieldAlert size={14} />
              <span>Deterministic Validation</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Visual elements are checked down to the raw pixel canvas. Overrides dynamic animations to prevent false-positives in CI/CD.
            </p>
          </div>

          <button
            onClick={handleRunVerification}
            disabled={isVerifying}
            className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20 disabled:opacity-50"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="animate-spin" size={14} />
                Verifying Visual Canvas...
              </>
            ) : (
              <>
                <Play size={14} />
                Run Visual Suite Checks
              </>
            )}
          </button>
        </div>
      </div>

      {/* Verification Steps and Status Reports */}
      <div className="lg:col-span-2 bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 flex flex-col justify-between min-h-[480px]">
        <div className="space-y-4 flex-1">
          <div className="border-b border-gray-800 pb-4 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm text-orange-400 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 size={16} />
                Deterministic Verification Tasks
              </h3>
              <p className="text-xs text-gray-400 font-mono">MCP server commands mapped to local component files.</p>
            </div>
          </div>

          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="bg-black/50 border border-gray-900 rounded-xl px-4 py-3 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <p className="font-semibold text-gray-200">{task.name}</p>
                  <p className="text-[10px] text-orange-400/80 font-mono">{task.tool}</p>
                </div>
                <div className="flex items-center gap-3">
                  {task.status === 'passed' && (
                    <span className="flex items-center gap-1.5 text-green-400 font-semibold text-[10px] bg-green-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={12} /> Passed
                    </span>
                  )}
                  {task.status === 'failed' && (
                    <span className="flex items-center gap-1.5 text-red-400 font-semibold text-[10px] bg-red-500/10 px-2 py-0.5 rounded-full">
                      <AlertCircle size={12} /> Failed: {task.difference}
                    </span>
                  )}
                  {task.status === 'running' && (
                    <span className="flex items-center gap-1.5 text-orange-400 font-semibold text-[10px] animate-pulse">
                      <RefreshCw size={12} className="animate-spin" /> Verifying
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {log.length > 0 && (
            <div className="space-y-2 pt-4">
              <label className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} /> Verification Stdout
              </label>
              <div className="w-full h-24 bg-black border border-gray-800 rounded-xl p-3 font-mono text-[10px] text-orange-300 overflow-y-auto space-y-1">
                {log.map((val, idx) => <p key={idx}>[mcp] {val}</p>)}
              </div>
            </div>
          )}
        </div>

        {log.length > 0 && (
          <div className="border-t border-gray-900 pt-4 mt-4 flex justify-end text-xs text-gray-500">
            <button className="flex items-center gap-1 text-orange-400 font-bold hover:underline">
              <Download size={12} /> Export Regression Artifacts (.png)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UiVerificationTab;