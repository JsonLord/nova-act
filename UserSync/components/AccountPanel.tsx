import React, { useEffect, useState } from 'react';
import { Activity, Cpu, Gauge, KeyRound, RefreshCw } from 'lucide-react';
import { apiData } from '../services/api';

/** Dev & Account: credits, usage, capabilities (tier/engine/queue), jobs. */
const AccountPanel: React.FC = () => {
  const [credits, setCredits] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [caps, setCaps] = useState<any>(null);
  const [jobs, setJobs] = useState<any>(null);

  const load = () => {
    apiData('/api/account/credits').then(setCredits).catch(() => undefined);
    apiData('/api/account/usage').then(setUsage).catch(() => undefined);
    apiData('/api/account/capabilities').then(setCaps).catch(() => undefined);
    apiData('/api/jobs').then(setJobs).catch(() => undefined);
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const Card: React.FC<{ title: string; icon: any; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <div className="rounded-2xl border border-gray-800 bg-[#0c0c0c] p-5">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400"><Icon size={14} />{title}</div>
      {children}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-8 text-white">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Credits" icon={KeyRound}>
          {credits && (
            <>
              <div className="text-3xl font-bold text-teal-300">{credits.credits}</div>
              <div className="text-[10px] text-gray-500">{credits.budget_scope} · via {credits.auth_via}</div>
            </>
          )}
        </Card>
        <Card title="Deployment tier" icon={Cpu}>
          {caps && (
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-gray-400">perception</span><span className={caps.perception_tier === 'zerogpu' ? 'text-teal-300' : 'text-gray-300'}>{caps.perception_tier}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">engine</span><span className="text-gray-300">{caps.engine}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">nova key</span><span>{caps.nova_configured ? '✓' : '—'}</span></div>
            </div>
          )}
        </Card>
        <Card title="Job queue" icon={Gauge}>
          {caps?.job_queue && (
            <div className="text-[11px]">
              <div className="flex justify-between"><span className="text-gray-400">active</span><span className="font-mono text-teal-300">{caps.job_queue.active}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">max workers</span><span className="font-mono">{caps.job_queue.max_workers}</span></div>
            </div>
          )}
        </Card>
      </div>

      <Card title="Usage by category" icon={Activity}>
        {usage?.usage && Object.keys(usage.usage).length > 0 ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] lg:grid-cols-3">
            {Object.entries(usage.usage).map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-gray-400">{k}</span><span className="font-mono text-teal-300">{String(v)}</span></div>
            ))}
          </div>
        ) : <p className="text-[11px] text-gray-600">No usage yet.</p>}
      </Card>

      <Card title="Recent jobs" icon={RefreshCw}>
        {jobs?.jobs?.length ? (
          <div className="space-y-1 text-[10px] font-mono">
            {jobs.jobs.slice(0, 8).map((j: any) => (
              <div key={j.job_id} className="flex justify-between">
                <span className="text-gray-400">{j.kind}</span>
                <span className={j.status === 'done' ? 'text-green-400' : j.status === 'failed' ? 'text-rose-400' : 'text-amber-300'}>{j.status}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-[11px] text-gray-600">No jobs yet.</p>}
      </Card>
    </div>
  );
};

export default AccountPanel;
