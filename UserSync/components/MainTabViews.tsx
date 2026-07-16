import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Activity, Bot, Braces, Code2, Database, GitBranch, Globe2, KeyRound, Network, ShieldCheck, Sparkles, TerminalSquare } from 'lucide-react';
import LandingTab from './LandingTab';
import SimulationPage from './SimulationPage';
import ChatPage from './ChatPage';
import PersonaBuilderTab from './PersonaBuilderTab';
import ContentCraftTab from './ContentCraftTab';
import BrowserAutomationTab from './BrowserAutomationTab';
import QaTestingTab from './QaTestingTab';
import DataExtractionTab from './DataExtractionTab';
import UiVerificationTab from './UiVerificationTab';
import DeploymentTab from './DeploymentTab';
// Lazy — pulls the heavy plotly chunk only when a graph view is opened.
const RealNetworkGraph = lazy(() => import('./RealNetworkGraph'));
import SubViewSlider, { SubView } from './SubViewSlider';
import { getApiSpec, publishTabEvent } from '../services/tabBus';
import MindwalkGraphView from './MindwalkGraphView';
import PersonaHubTab from './PersonaHubTab';
import UxMentorChain from './UxMentorChain';
import JourneyConsole from './JourneyConsole';
import RenderFlow from './RenderFlow';
import DevSteeringConsole from './DevSteeringConsole';
import SocialMirror from './SocialMirror';
import AnalysisGraph from './AnalysisGraph';
import AccountPanel from './AccountPanel';

export type MainTabId = 'usersync' | 'nova-act' | 'datahub' | 'oasis' | 'graph' | 'dev';

interface MainTabViewsProps {
  tab: MainTabId;
  onOpenGuide: () => void;
  user: any;
  onLogin: () => void;
  onLogout: () => void;
  simulationResult: any;
  setSimulationResult: (result: any) => void;
}

const viewsByTab: Record<MainTabId, SubView[]> = {
  usersync: [
    { id: 'overview', label: 'Overview', description: 'Landing, use cases, pricing, and product proof.' },
    { id: 'simulation', label: 'Simulation', description: 'Run audience sync and inspect results.' },
    { id: 'personas', label: 'Personas', description: 'Sort and build focus-group personas.' },
    { id: 'content', label: 'Content Craft', description: 'Generate and evaluate variants.' },
  ],
  'nova-act': [
    { id: 'console', label: 'Nova Console', description: 'Run persona-steered journeys, watch steps and thinking live.' },
    { id: 'studio', label: 'Nova Studio', description: 'Amazon Nova-inspired command surface.' },
    { id: 'browser', label: 'Browser Act', description: 'Headful web action session.' },
    { id: 'qa', label: 'QA Flows', description: 'Reusable SDK test paths.' },
    { id: 'verify', label: 'UI Verify', description: 'MCP style visual and DOM checks.' },
    { id: 'ux-chain', label: 'UX Chain', description: 'Screenshot + heatmap, problem, and re-rendered solution.' },
    { id: 'mindwalk', label: 'Mindwalk + OmniParser', description: 'Use OmniParser for UI-to-LLM prompts and Mindwalk for navigation memory.' },
  ],
  datahub: [
    { id: 'render', label: 'Render Flow', description: 'Verify sources, render personas one by one, read their steering.' },
    { id: 'extract', label: 'Extract', description: 'Collect structured records.' },
    { id: 'warehouse', label: 'Warehouse', description: 'Saved artifacts and tab handoff.' },
    { id: 'deploy', label: 'Deploy', description: 'Production export and integrations.' },
  ],
  oasis: [
    { id: 'mirror', label: 'Social Mirror', description: 'Living network of personas; scrub the animation.' },
    { id: 'network', label: 'Oasis Network', description: 'Community, identity, and auth mesh.' },
    { id: 'trust', label: 'Trust Layer', description: 'HF login is shared across every tab.' },
  ],
  graph: [
    { id: 'analysis', label: 'Action Trace', description: 'Similarity blend, decisions, and graph answers.' },
    { id: 'live', label: 'Live Graph', description: 'Network topology view.' },
    { id: 'signals', label: 'Signals', description: 'Sorted persona and datahub events.' },
    { id: 'mindwalk', label: 'Mindwalk + OmniParser', description: 'Graph tabs while OmniParser describes UI controls for LLM action.' },
  ],
  dev: [
    { id: 'steering', label: 'Steering Console', description: 'Layers 1/2, derivation rulesets, and audited corrections.' },
    { id: 'account', label: 'Account', description: 'Credits, capabilities, and jobs.' },
    { id: 'api', label: 'API Docs', description: 'OpenAPI/Swagger-compatible documentation.' },
    { id: 'events', label: 'Tab Bus', description: 'FastAPI-compatible tab communication contract.' },
    { id: 'status', label: 'Status', description: 'Delivery checklist and runtime health.' },
  ],
};

const NovaStudio = () => (
  <div className="mx-auto max-w-7xl px-6 py-12">
    <div className="overflow-hidden rounded-[2rem] border border-violet-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.25),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(124,58,237,0.3),_transparent_30%),#050505] p-8 shadow-2xl">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-teal-200">
            <Sparkles size={14} /> Nova Act command plane
          </div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Act, reason, browse, and verify from one tab.</h1>
          <p className="mt-5 text-lg text-gray-300">A Nova-inspired orchestration surface that bundles browser automation, QA, visual verification, content tools, and backend app actions behind one signed-in HF session.</p>
        </div>
        <div className="grid min-w-[280px] gap-3 rounded-3xl border border-white/10 bg-black/50 p-4 font-mono text-xs text-gray-300">
          {['/api/nova-act/session', '/api/omniparser/parse', '/api/nova-act/limitations', '/api/openapi.json'].map((endpoint) => (
            <div key={endpoint} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3"><TerminalSquare size={14} className="text-teal-300" />{endpoint}</div>
          ))}
        </div>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-4">
        {[
          ['Multimodal actions', Bot], ['Browser runtime', Globe2], ['Shared auth', KeyRound], ['Verified delivery', ShieldCheck],
        ].map(([label, Icon]: any) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><Icon className="mb-4 text-teal-300" /><div className="font-bold">{label}</div></div>)}
      </div>
    </div>
  </div>
);

const SimplePanel = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <div className="mx-auto max-w-7xl px-6 py-12">
    <div className="rounded-3xl border border-gray-800 bg-[#0b0b0b] p-8">
      <h2 className="mb-4 flex items-center gap-3 text-3xl font-bold"><Icon className="text-teal-400" />{title}</h2>
      <div className="text-gray-300">{children}</div>
    </div>
  </div>
);

const GraphPanel = () => <div className="mx-auto h-[680px] max-w-7xl px-6 py-12"><div className="h-full rounded-3xl border border-gray-800 bg-[#050505] p-4"><Suspense fallback={<div className="skeleton h-full w-full rounded-2xl" />}><RealNetworkGraph /></Suspense></div></div>;

const DevApiDocs = () => {
  const [spec, setSpec] = useState<any>(null);
  useEffect(() => { getApiSpec().then((result) => result.ok && setSpec(result.data)); }, []);
  return <SimplePanel title="Developer API Documentation" icon={Code2}><p className="mb-4">FastAPI-compatible OpenAPI is exposed in-app so every tab can discover backend actions.</p><pre className="max-h-[520px] overflow-auto rounded-2xl border border-gray-800 bg-black p-4 text-xs text-teal-100">{JSON.stringify(spec || { loading: '/api/openapi.json' }, null, 2)}</pre></SimplePanel>;
};

const MainTabViews: React.FC<MainTabViewsProps> = (props) => {
  const [activeViews, setActiveViews] = useState<Record<string, string>>({ usersync: 'overview', 'nova-act': 'console', datahub: 'render', oasis: 'mirror', graph: 'analysis', dev: 'steering' });
  const activeView = activeViews[props.tab] || viewsByTab[props.tab][0].id;
  const setActiveView = (view: string) => { setActiveViews((prev) => ({ ...prev, [props.tab]: view })); publishTabEvent({ source: 'frontend', target: props.tab, action: 'view.changed', payload: { view } }); };
  const content = useMemo(() => {
    if (props.tab === 'usersync') {
      if (activeView === 'simulation') return <SimulationPage onBack={() => setActiveView('overview')} onOpenChat={() => setActiveView('content')} onOpenGuide={props.onOpenGuide} user={props.user} onLogin={props.onLogin} onLogout={props.onLogout} simulationResult={props.simulationResult} setSimulationResult={props.setSimulationResult} />;
      if (activeView === 'personas') return <><PersonaHubTab /><PersonaBuilderTab /></>;
      if (activeView === 'content') return <><ChatPage onBack={() => setActiveView('simulation')} simulationResult={props.simulationResult} setSimulationResult={props.setSimulationResult} /><ContentCraftTab /></>;
      return <LandingTab onTabChange={() => setActiveView('simulation')} />;
    }
    if (props.tab === 'nova-act') return activeView === 'console' ? <JourneyConsole /> : activeView === 'studio' ? <NovaStudio /> : activeView === 'browser' ? <BrowserAutomationTab /> : activeView === 'qa' ? <QaTestingTab /> : activeView === 'ux-chain' ? <UxMentorChain /> : activeView === 'mindwalk' ? <MindwalkGraphView activeTab="nova-act" activeView="mindwalk" /> : <UiVerificationTab />;
    if (props.tab === 'datahub') return activeView === 'render' ? <RenderFlow /> : activeView === 'extract' ? <DataExtractionTab /> : activeView === 'deploy' ? <DeploymentTab /> : <SimplePanel title="DataHub Warehouse" icon={Database}>Saved records, simulation outputs, and browser traces are sorted here before being published to downstream tabs over <code>/api/tabs/events</code>.</SimplePanel>;
    if (props.tab === 'oasis') return activeView === 'mirror' ? <SocialMirror /> : <SimplePanel title={activeView === 'trust' ? 'Shared HF Trust Layer' : 'Oasis Network'} icon={activeView === 'trust' ? KeyRound : Network}>One Hugging Face login cookie is valid across UserSync, Nova Act, DataHub, Oasis, Graph, and Dev. Backend routes resolve the same user with <code>/api/user</code>.</SimplePanel>;
    if (props.tab === 'graph') return activeView === 'analysis' ? <AnalysisGraph /> : activeView === 'live' ? <GraphPanel /> : activeView === 'mindwalk' ? <MindwalkGraphView activeTab="graph" activeView="mindwalk" /> : <SimplePanel title="Graph Signals" icon={GitBranch}>Subview events, persona cohorts, and DataHub artifacts are sorted by source tab and action type for graph exploration.</SimplePanel>;
    if (props.tab === 'dev') return activeView === 'steering' ? <DevSteeringConsole /> : activeView === 'account' ? <AccountPanel /> : activeView === 'api' ? <DevApiDocs /> : activeView === 'events' ? <SimplePanel title="Tab Bus Contract" icon={Braces}>Publish tab communication with <code>POST /api/tabs/events</code>. Read the queue with <code>GET /api/tabs/events</code>. The schema is visible in API docs.</SimplePanel> : <SimplePanel title="Runtime Status" icon={Activity}>Frontend build, Express compatibility API, and FastAPI reference backend are included for delivery.</SimplePanel>;
  }, [activeView, props]);

  return <><SubViewSlider views={viewsByTab[props.tab]} activeView={activeView} onViewChange={setActiveView} />{content}</>;
};

export default MainTabViews;
