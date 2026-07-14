import React, { useState } from 'react';
import { Eye, ShieldAlert, Sparkles, CheckCircle, Clock, RefreshCw, BarChart2 } from 'lucide-react';

interface Report {
  id: string;
  module: string;
  status: 'passed' | 'warning' | 'critical';
  details: string;
  time: string;
}

const INITIAL_REPORTS: Report[] = [
  { id: '1', module: 'Login Component Validation', status: 'passed', details: 'All visual elements align perfectly with Figma specification designs.', time: '5 mins ago' },
  { id: '2', module: 'Interactive Workspace Canvas', status: 'warning', details: 'Rendering lag detected on mobile screens (viewport width < 480px).', time: '1 hour ago' },
  { id: '3', module: 'Payment Gateway Overlay', status: 'critical', details: 'Deterministic verify_element check failed. Action button overlaps checkout details.', time: '2 hours ago' }
];

export default function UIVerificationTab() {
  const [reports, setReports] = useState<Report[]>(INITIAL_REPORTS);
  const [running, setRunning] = useState(false);

  const triggerVerification = () => {
    setRunning(true);
    setTimeout(() => {
      setReports(prev => [
        { id: Date.now().toString(), module: 'Global Navigation Header', status: 'passed', details: 'Mobile navigation menu passes all accessibility contrast validation rules.', time: 'Just now' },
        ...prev
      ]);
      setRunning(false);
    }, 1500);
  };

  return (
    <div className="bg-black text-white min-h-screen p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Eye className="text-teal-400 w-8 h-8" />
            <h1 className="text-3xl font-bold tracking-tight">UI Verification Dashboard</h1>
          </div>
          <p className="text-gray-400 max-w-3xl">
            Audit frontend layout elements and contrast alignment deterministically using `nova-act-mcp` tools. Generate execution reports to pinpoint rendering flaws, structural overflows, or contrast errors.
          </p>
        </div>

        <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BarChart2 className="text-teal-400 w-5 h-5" /> MCP Verification Reports
            </h2>

            <button
              onClick={triggerVerification}
              disabled={running}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2"
            >
              {running ? (
                <>
                  <RefreshCw className="animate-spin w-4 h-4" /> Analyzing Layout...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Verify Layout Elements
                </>
              )}
            </button>
          </div>

          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="bg-gray-950 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-base text-gray-100">{report.module}</h4>
                    <span className="text-[10px] text-gray-500 flex items-center gap-1"><Clock size={10} /> {report.time}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{report.details}</p>
                </div>

                <div>
                  {report.status === 'passed' && (
                    <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-950/30 border border-green-900 px-3 py-1 rounded-full font-bold">
                      <CheckCircle size={12} /> Compliant
                    </span>
                  )}
                  {report.status === 'warning' && (
                    <span className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-950/30 border border-yellow-900 px-3 py-1 rounded-full font-bold">
                      <ShieldAlert size={12} /> Warning (Low Contrast)
                    </span>
                  )}
                  {report.status === 'critical' && (
                    <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/30 border border-red-900 px-3 py-1 rounded-full font-bold">
                      <ShieldAlert size={12} /> Defect (Overlap)
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
