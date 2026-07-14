import React, { useState } from 'react';
import { Play, Sparkles, Code, CheckCircle2, ShieldAlert, List, RotateCcw } from 'lucide-react';

interface TestCase {
  id: string;
  name: string;
  flow: string;
  status: 'passed' | 'failed' | 'pending';
}

const INITIAL_SUITE: TestCase[] = [
  { id: '1', name: 'Check standard checkout flow', flow: "act('Click Checkout') -> act_get('Verify total price')", status: 'passed' },
  { id: '2', name: 'Verify navigation menu responsiveness', flow: "act('Resize window 375px') -> act('Open Hamburger')", status: 'passed' },
  { id: '3', name: 'Submit newsletter subscription', flow: "act('Type test@example.com') -> act('Click Submit')", status: 'pending' }
];

export default function NovaActQA() {
  const [suite, setSuite] = useState<TestCase[]>(INITIAL_SUITE);
  const [isRunning, setIsRunning] = useState(false);

  const runQA = () => {
    setIsRunning(true);
    setSuite(prev => prev.map(tc => ({ ...tc, status: 'pending' })));

    setTimeout(() => {
      setSuite(prev =>
        prev.map((tc, idx) => ({
          ...tc,
          status: idx === 1 ? 'failed' : 'passed'
        }))
      );
      setIsRunning(false);
    }, 1500);
  };

  return (
    <div className="bg-black text-white min-h-screen p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Code className="text-emerald-400 w-8 h-8" />
            <h1 className="text-3xl font-bold tracking-tight">Nova Act QA & Flow Testing</h1>
          </div>
          <p className="text-gray-400 max-w-3xl">
            Develop resilient frontend UI test flows with Nova Act. Orchestrate step-by-step user interactions using sequential `act()` and `act_get()` directives, simulating human actions inside headless browsers.
          </p>
        </div>

        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <List className="text-emerald-400 w-5 h-5" /> Regression Suite Execution
            </h2>
            <button
              onClick={runQA}
              disabled={isRunning}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2"
            >
              {isRunning ? 'Executing Suite...' : 'Run QA Tests'}
              <Play size={14} />
            </button>
          </div>

          <div className="space-y-3">
            {suite.map((test) => (
              <div key={test.id} className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-gray-200">{test.name}</h4>
                  <p className="text-xs text-gray-500 font-mono">{test.flow}</p>
                </div>

                <div className="flex items-center gap-3">
                  {test.status === 'passed' && (
                    <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-950/30 border border-green-900 px-3 py-1 rounded-full font-bold">
                      <CheckCircle2 size={12} /> Passed
                    </span>
                  )}
                  {test.status === 'failed' && (
                    <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/30 border border-red-900 px-3 py-1 rounded-full font-bold">
                      <ShieldAlert size={12} /> Failed (Element mismatch)
                    </span>
                  )}
                  {test.status === 'pending' && (
                    <span className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-950/30 border border-yellow-900 px-3 py-1 rounded-full font-bold">
                      <RotateCcw size={12} className="animate-spin" /> Running
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
