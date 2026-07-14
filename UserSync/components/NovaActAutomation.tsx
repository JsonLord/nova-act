import React, { useState } from 'react';
import { Play, Terminal, Eye, CheckCircle, RefreshCw, Cpu, Database, Award } from 'lucide-react';

export default function NovaActAutomation() {
  const [url, setUrl] = useState('https://news.ycombinator.com');
  const [logs, setLogs] = useState<string[]>([
    'Nova Act instance ready.',
    'Initialized virtual Chromium browser context.'
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [screenshotCaptured, setScreenshotCaptured] = useState(false);

  const runAutomation = () => {
    if (!url.trim()) return;
    setIsRunning(true);
    setLogs(prev => [...prev, `[INIT] Requesting browser navigation to: ${url}`]);

    setTimeout(() => {
      setLogs(prev => [...prev, '[INFO] DNS resolved. Loading site payload...', '[INFO] Executing act() selector analysis...']);
    }, 800);

    setTimeout(() => {
      setLogs(prev => [
        ...prev,
        '[SUCCESS] Navigation complete. HTML Document loaded.',
        '[INFO] Auto-generated agent execution path for page exploratory scanning.'
      ]);
      setScreenshotCaptured(true);
      setIsRunning(false);
    }, 2000);
  };

  return (
    <div className="bg-black text-white min-h-screen p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="text-blue-400 w-8 h-8" />
            <h1 className="text-3xl font-bold tracking-tight">Nova Act Interactive Browser Automation</h1>
          </div>
          <p className="text-gray-400 max-w-3xl">
            Execute exploratory browser automation runs powered by Nova Act SDK. Spin up real browser contexts, navigate complex sites, and interact programmatically via deterministic action sequences.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 space-y-5 h-fit">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Database className="text-blue-400 w-5 h-5" /> Automation Driver
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium uppercase">Target Navigation URL</label>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="e.g. https://github.com"
                className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-blue-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium uppercase">Action Mode</label>
              <select className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-blue-500 outline-none">
                <option>Exploratory (Page Scan)</option>
                <option>Targeted Action Loop (Act/Get)</option>
                <option>Visual Element Inventory</option>
              </select>
            </div>

            <button
              onClick={runAutomation}
              disabled={isRunning || !url.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="animate-spin w-4 h-4" /> Driving browser session...
                </>
              ) : (
                <>
                  <Play size={16} /> Start Interactive Session
                </>
              )}
            </button>
          </div>

          {/* Logs & Viewport */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Real-time Logs */}
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 flex flex-col h-[400px]">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-900">
                <Terminal className="text-blue-400 w-4 h-4" />
                <span className="text-xs font-bold uppercase text-gray-400">Terminal Log Output</span>
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-2 text-gray-300 custom-scrollbar">
                {logs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">
                    <span className="text-blue-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                    {log}
                  </div>
                ))}
              </div>
            </div>

            {/* Simulated Screen */}
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 flex flex-col items-center justify-center h-[400px] text-center">
              {screenshotCaptured ? (
                <div className="space-y-4 w-full h-full flex flex-col justify-between p-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-900">
                    <span className="flex items-center gap-1.5"><Eye size={12} /> Live Viewport Screenshot</span>
                    <span className="text-green-400 font-bold flex items-center gap-1"><CheckCircle size={10} /> Sync Complete</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center bg-[#070707] border border-gray-900 rounded-xl">
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-gray-400 italic">Simulated Visual Web View of:</p>
                      <span className="text-xs text-teal-400 font-mono px-3 py-1 bg-teal-950/20 border border-teal-900/30 rounded-full">{url}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 space-y-3">
                  <Award size={36} className="text-gray-700 mx-auto" />
                  <p className="text-sm font-semibold text-gray-400">No active browser screenshot.</p>
                  <p className="text-xs text-gray-600">Start an interactive session above to render site layout.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
