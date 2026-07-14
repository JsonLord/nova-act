import React from 'react';
import { ArrowRight, Activity, Cpu, Shield, Settings, Users, PenTool, Database, Eye, Terminal } from 'lucide-react';

interface LandingTabProps {
  onTabChange: (tab: number) => void;
}

const LandingTab: React.FC<LandingTabProps> = ({ onTabChange }) => {
  const cards = [
    {
      title: 'Simulation Dashboard (Tab 2)',
      desc: 'Visualize your active simulated networks, node sentiments, and power user activities.',
      tab: 2,
      icon: <Activity className="text-teal-400" size={24} />,
      status: 'Active',
      statusColor: 'text-green-400 bg-green-500/10'
    },
    {
      title: 'Content Chat & Test Runner (Tab 3)',
      desc: 'Write campaign narratives or survey questions to run and gather interactive feedback.',
      tab: 3,
      icon: <Terminal className="text-purple-400" size={24} />,
      status: 'Active',
      statusColor: 'text-green-400 bg-green-500/10'
    },
    {
      title: 'Persona & Focus Group Builder (Tab 4)',
      desc: 'Assemble custom audiences with parameterized sentiment weights and demographic profiles.',
      tab: 4,
      icon: <Users className="text-blue-400" size={24} />,
      status: 'Active',
      statusColor: 'text-green-400 bg-green-500/10'
    },
    {
      title: 'Content Craft & Variant Studio (Tab 5)',
      desc: 'Generate optimized copy variants using Helmholtz-Blablador AI and Helmholtz servers.',
      tab: 5,
      icon: <PenTool className="text-pink-400" size={24} />,
      status: 'Active',
      statusColor: 'text-green-400 bg-green-500/10'
    },
    {
      title: 'Nova Act Browser Automation (Tab 6)',
      desc: 'Initiate interactive exploratory automation and control remote chromium sessions.',
      tab: 6,
      icon: <Cpu className="text-amber-400" size={24} />,
      status: 'Ready',
      statusColor: 'text-yellow-400 bg-yellow-500/10'
    },
    {
      title: 'Nova Act QA & Flow Testing (Tab 7)',
      desc: 'Write declarative assertion scripts to test complex login, purchase, and user journeys.',
      tab: 7,
      icon: <Shield className="text-red-400" size={24} />,
      status: 'Ready',
      statusColor: 'text-yellow-400 bg-yellow-500/10'
    },
    {
      title: 'Nova Act Data Extraction (Tab 8)',
      desc: 'Define custom JSON schemas to scrape and extract unstructured competitor pricing data.',
      tab: 8,
      icon: <Database className="text-indigo-400" size={24} />,
      status: 'Ready',
      statusColor: 'text-yellow-400 bg-yellow-500/10'
    },
    {
      title: 'UI Verification Suite (Tab 9)',
      desc: 'Verify visual and structural layouts deterministically using our customized MCP tools.',
      tab: 9,
      icon: <Eye className="text-orange-400" size={24} />,
      status: 'Ready',
      statusColor: 'text-yellow-400 bg-yellow-500/10'
    },
    {
      title: 'Deployment & Integrations (Tab 10)',
      desc: 'Configure AWS IAM permissions, Hugging Face oauth endpoints, and MCP server options.',
      tab: 10,
      icon: <Settings className="text-gray-400" size={24} />,
      status: 'Ready',
      statusColor: 'text-yellow-400 bg-yellow-500/10'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 text-white">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto mb-16 animate-in fade-in duration-500">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-teal-400 via-white to-purple-500 bg-clip-text text-transparent">
          SyncUsers & Nova Act Workspace
        </h1>
        <p className="text-lg md:text-xl text-gray-400 leading-relaxed">
          The ultimate control center for multi-agent persona simulation, browser automation, visual QA, and model context protocol integrations. Toggle between tools using the persistent header navbar.
        </p>
      </div>

      {/* Workspace Quick-Access Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, idx) => (
          <div
            key={idx}
            onClick={() => onTabChange(card.tab)}
            className="group relative bg-[#0e0e0e]/80 border border-gray-800 rounded-2xl p-6 hover:border-teal-500/50 hover:bg-gray-900/40 transition-all duration-300 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gray-900 rounded-xl border border-gray-800 group-hover:border-teal-500/20 transition-all">
                  {card.icon}
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${card.statusColor}`}>
                  {card.status}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-100 group-hover:text-teal-400 transition-colors mb-2">
                {card.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed mb-6">
                {card.desc}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-teal-400 opacity-60 group-hover:opacity-100 transition-all">
              <span>Open Workspace</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LandingTab;