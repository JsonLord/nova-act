import React, { useState } from 'react';
import { Cpu, Globe, ArrowRight, Play, Square, RefreshCw, Terminal, MousePointer, Type, Eye } from 'lucide-react';

const BrowserAutomationTab: React.FC = () => {
  const [url, setUrl] = useState('https://huggingface.co');
  const [sessionActive, setSessionActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const startSession = () => {
    setIsLoading(true);
    setLogs(['Initiating Nova Act SDK browser context...', 'Spinning up Chromium headfully...']);

    setTimeout(() => {
      setSessionActive(true);
      setIsLoading(false);
      setLogs(prev => [
        ...prev,
        'Connection established.',
        `Viewport set to 1280x800.`,
        `Navigating to ${url}...`,
        'Page loaded successfully. Capturing screenshot...'
      ]);
      setScreenshotUrl('https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6');
    }, 1500);
  };

  const stopSession = () => {
    setSessionActive(false);
    setScreenshotUrl('');
    setLogs(prev => [...prev, 'Session closed by user.', 'Chromium context terminated safely.']);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 text-white grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Interactive Controls & Logs */}
      <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 space-y-6 flex flex-col justify-between h-full">
        <div className="space-y-4">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Cpu className="text-amber-400" size={20} />
              Nova Act Browser Automation
            </h2>
            <p className="text-xs text-gray-400">Launch headful, interactive exploratory chromium automation sessions.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Target Destination URL</label>
            <div className="flex bg-black border border-gray-800 rounded-xl overflow-hidden focus-within:border-amber-500 transition-all p-1">
              <div className="flex items-center pl-3 pr-2 text-gray-500">
                <Globe size={16} />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-transparent border-0 text-xs py-2 text-white outline-none"
                placeholder="https://example.com"
              />
            </div>
          </div>

          <div className="flex gap-2">
            {!sessionActive ? (
              <button
                onClick={startSession}
                disabled={isLoading}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-900/20 disabled:opacity-50"
              >
                <Play size={12} />
                Start Session
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <Square size={12} />
                Terminate
              </button>
            )}
            <button className="p-2.5 bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white rounded-xl transition-all">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Live Execution Logs */}
        <div className="space-y-2 flex-1 pt-6">
          <label className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Terminal size={14} />
            Execution Logs
          </label>
          <div className="w-full h-56 bg-black border border-gray-800 rounded-xl p-4 font-mono text-[10px] text-amber-400/90 overflow-y-auto space-y-1.5 scrollbar-thin">
            {logs.length === 0 ? (
              <span className="text-gray-600 italic">No active session logging. Click "Start Session" to connect.</span>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-gray-600 select-none">&gt;</span>
                  <p>{log}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Headless Browser Display Screen */}
      <div className="lg:col-span-2 bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 flex flex-col h-[550px] justify-between">
        <div className="border-b border-gray-800 pb-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
            </div>
            <span className="text-xs text-gray-400 font-mono pl-3">{url}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-full">
              {sessionActive ? 'Interactive' : 'Idle'}
            </span>
          </div>
        </div>

        {/* Viewport Canvas Screen */}
        <div className="flex-1 bg-black rounded-xl border border-gray-900 overflow-hidden flex items-center justify-center my-4 relative">
          {!sessionActive ? (
            <div className="text-center max-w-sm space-y-2">
              <p className="text-sm font-bold text-gray-400">Exploratory Viewport</p>
              <p className="text-xs text-gray-600">The browser display window is ready. Start an active automation session to see real-time UI interactions.</p>
            </div>
          ) : (
            <div className="w-full h-full relative group">
              <img
                src={screenshotUrl}
                alt="Exploratory session screenshot"
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                <button className="p-3 bg-amber-500 text-white rounded-full hover:scale-105 transition-all shadow-xl">
                  <MousePointer size={20} />
                </button>
                <button className="p-3 bg-amber-500 text-white rounded-full hover:scale-105 transition-all shadow-xl">
                  <Type size={20} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action controls footer */}
        <div className="flex justify-between items-center text-xs text-gray-500 border-t border-gray-900 pt-4">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Eye size={12} /> Viewport: 1280x800</span>
            <span>Agent Control: Enabled</span>
          </div>
          <button className="flex items-center gap-1 text-amber-400 font-bold hover:underline">
            Export Test Script <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BrowserAutomationTab;