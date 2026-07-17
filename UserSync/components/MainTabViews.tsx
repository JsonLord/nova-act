import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Activity, Braces, Code2, Database, GitBranch, KeyRound, Network } from 'lucide-react';
import SimulationPage from './SimulationPage';
import ChatPage from './ChatPage';
import ApiTabsPage from './ApiTabsPage';
import ProductGuide from './ProductGuide';
import Hero from './Hero';
import TrustedBy from './TrustedBy';
import ProductOverview from './ProductOverview';
import InteractiveDemo from './InteractiveDemo';
import UseCases from './UseCases';
import HowItWorks from './HowItWorks';
import Accuracy from './Accuracy';
import Documentation from './Documentation';
import FAQ from './FAQ';
import Footer from './Footer';
import QaTestingTab from './QaTestingTab';
import DataExtractionTab from './DataExtractionTab';
import UiVerificationTab from './UiVerificationTab';
import DeploymentTab from './DeploymentTab';
// Lazy — pulls the heavy plotly chunk only when a graph view is opened.
const RealNetworkGraph = lazy(() => import('./RealNetworkGraph'));
import SubViewSlider, { SubView } from './SubViewSlider';
import { getApiSpec, publishTabEvent } from '../services/tabBus';
import MindwalkGraphView from './MindwalkGraphView';
import UxMentorChain from './UxMentorChain';
import JourneyConsole from './JourneyConsole';
import RenderFlow from './RenderFlow';
import DevSteeringConsole from './DevSteeringConsole';
import SocialMirror from './SocialMirror';
import AnalysisGraph from './AnalysisGraph';
import AccountPanel from './AccountPanel';
import { TAB_PROMISES } from '../branding';

export type MainTabId = 'usersync' | 'nova-act' | 'datahub' | 'oasis' | 'graph' | 'dev';

interface MainTabViewsProps {
  tab: MainTabId;
  routeView?: string;
  onNavigate?: (tab: string, view?: string) => void;
  onOpenGuide: () => void;
  user: any;
  onLogin: () => void;
  onLogout: () => void;
  simulationResult: any;
  setSimulationResult: (result: any) => void;
}

const viewsByTab: Record<MainTabId, SubView[]> = {
  // The usersync tab is the Leon4gr45/UserSync Space frontend, verbatim views
  // (simulation-first), wired to this FastAPI backend's /api/v1 compat pack.
  usersync: [
    { id: 'simulation', label: 'Simulation', description: 'Assemble focus groups and run audience sync.' },
    { id: 'overview', label: 'Overview', description: 'Landing, use cases, and product proof.' },
    { id: 'chat', label: 'Chat', description: 'Test content against the simulated group.' },
    { id: 'guide', label: 'Guide', description: 'The product guide.' },
    { id: 'api', label: 'API Tabs', description: 'Ten same-origin FastAPI tabs, runnable in-app.' },
  ],
  'nova-act': [
    { id: 'console', label: 'Nova Console', description: 'Run persona-steered journeys, watch steps and thinking live.' },
    { id: 'qa', label: 'QA Flows', description: 'Reusable SDK test paths.' },
    { id: 'verify', label: 'UI Verify', description: 'MCP style visual and DOM checks.' },
    { id: 'ux-chain', label: 'UX Chain', description: 'Screenshot + heatmap, problem, and re-rendered solution.' },
    { id: 'mindwalk', label: 'Mindwalk', description: 'Navigation graph and touch-state memory across tabs.' },
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
    { id: 'mindwalk', label: 'Mindwalk', description: 'Navigation memory rendered as a graph of visited views.' },
  ],
  dev: [
    { id: 'steering', label: 'Steering Console', description: 'Layers 1/2, derivation rulesets, and audited corrections.' },
    { id: 'account', label: 'Account', description: 'Credits, capabilities, and jobs.' },
    { id: 'api', label: 'API Docs', description: 'OpenAPI/Swagger-compatible documentation.' },
    { id: 'events', label: 'Tab Bus', description: 'FastAPI-compatible tab communication contract.' },
    { id: 'status', label: 'Status', description: 'Delivery checklist and runtime health.' },
  ],
};

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

const DEFAULT_VIEW: Record<MainTabId, string> = {
  usersync: 'simulation', 'nova-act': 'console', datahub: 'render', oasis: 'mirror', graph: 'analysis', dev: 'steering',
};

// The Space's landing page, composed exactly as Leon4gr45/UserSync renders it.
const SpaceLanding: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div className="bg-black text-white selection:bg-teal-500/30">
    <Hero onStart={onStart} />
    <TrustedBy />
    <ProductOverview />
    <InteractiveDemo />
    <UseCases />
    <HowItWorks />
    <Accuracy />
    <Documentation />
    <FAQ />
    <Footer />
  </div>
);

const MainTabViews: React.FC<MainTabViewsProps> = (props) => {
  const tabViews = viewsByTab[props.tab];
  // URL is the source of truth for the view; fall back to the tab default.
  const routed = props.routeView && tabViews.some((v) => v.id === props.routeView) ? props.routeView : DEFAULT_VIEW[props.tab];
  const [activeView, setLocalView] = useState<string>(routed);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Sync from the URL when it changes (back/forward, deep link, tab switch).
  useEffect(() => {
    setLocalView(routed);
  }, [routed]);

  const setActiveView = (view: string) => {
    const from = tabViews.findIndex((v) => v.id === activeView);
    const to = tabViews.findIndex((v) => v.id === view);
    setDirection(to >= from ? 1 : -1);
    setLocalView(view);
    props.onNavigate?.(props.tab, view); // deep-linkable
    publishTabEvent({ source: 'frontend', target: props.tab, action: 'view.changed', payload: { view } });
  };
  const content = useMemo(() => {
    if (props.tab === 'usersync') {
      if (activeView === 'simulation') return <SimulationPage onBack={() => setActiveView('overview')} onOpenChat={() => setActiveView('chat')} onOpenGuide={() => setActiveView('guide')} onOpenApiTabs={() => setActiveView('api')} user={props.user} onLogin={props.onLogin} onLogout={props.onLogout} simulationResult={props.simulationResult} setSimulationResult={props.setSimulationResult} />;
      if (activeView === 'chat') return <ChatPage onBack={() => setActiveView('simulation')} simulationResult={props.simulationResult} setSimulationResult={props.setSimulationResult} />;
      if (activeView === 'guide') return <ProductGuide />;
      if (activeView === 'api') return <ApiTabsPage onBack={() => setActiveView('simulation')} />;
      return <SpaceLanding onStart={() => setActiveView('simulation')} />;
    }
    if (props.tab === 'nova-act') return activeView === 'console' ? <JourneyConsole /> : activeView === 'qa' ? <QaTestingTab /> : activeView === 'ux-chain' ? <UxMentorChain /> : activeView === 'mindwalk' ? <MindwalkGraphView activeTab="nova-act" activeView="mindwalk" /> : <UiVerificationTab />;
    if (props.tab === 'datahub') return activeView === 'render' ? <RenderFlow /> : activeView === 'extract' ? <DataExtractionTab /> : activeView === 'deploy' ? <DeploymentTab /> : <SimplePanel title="DataHub Warehouse" icon={Database}>Saved records, simulation outputs, and browser traces are sorted here before being published to downstream tabs over <code>/api/tabs/events</code>.</SimplePanel>;
    if (props.tab === 'oasis') return activeView === 'mirror' ? <SocialMirror /> : <SimplePanel title={activeView === 'trust' ? 'Shared HF Trust Layer' : 'Oasis Network'} icon={activeView === 'trust' ? KeyRound : Network}>One Hugging Face login cookie is valid across UserSync, Nova Act, DataHub, Oasis, Graph, and Dev. Backend routes resolve the same user with <code>/api/user</code>.</SimplePanel>;
    if (props.tab === 'graph') return activeView === 'analysis' ? <AnalysisGraph /> : activeView === 'live' ? <GraphPanel /> : activeView === 'mindwalk' ? <MindwalkGraphView activeTab="graph" activeView="mindwalk" /> : <SimplePanel title="Graph Signals" icon={GitBranch}>Subview events, persona cohorts, and DataHub artifacts are sorted by source tab and action type for graph exploration.</SimplePanel>;
    if (props.tab === 'dev') return activeView === 'steering' ? <DevSteeringConsole /> : activeView === 'account' ? <AccountPanel /> : activeView === 'api' ? <DevApiDocs /> : activeView === 'events' ? <SimplePanel title="Tab Bus Contract" icon={Braces}>Publish tab communication with <code>POST /api/tabs/events</code>. Read the queue with <code>GET /api/tabs/events</code>. The schema is visible in API docs.</SimplePanel> : <SimplePanel title="Runtime Status" icon={Activity}>Frontend build, Express compatibility API, and FastAPI reference backend are included for delivery.</SimplePanel>;
  }, [activeView, props]);

  return (
    <>
      {/* Per-tab service promise (branding.ts). */}
      {TAB_PROMISES[props.tab] && (
        <div className="mx-auto max-w-[1600px] px-4 pt-4">
          <p className="text-xs font-medium text-gray-500">{TAB_PROMISES[props.tab]}</p>
        </div>
      )}
      <SubViewSlider views={viewsByTab[props.tab]} activeView={activeView} onViewChange={setActiveView} />
      {/* Keyed on tab:view so each switch re-mounts with a directional slide. */}
      <div key={`${props.tab}:${activeView}`} className={direction === 1 ? 'animate-view-right' : 'animate-view-left'}>
        {content}
      </div>
    </>
  );
};

export default MainTabViews;
