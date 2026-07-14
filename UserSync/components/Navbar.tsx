import React, { useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import Button from './ui/Button';

export interface NavbarProps {
  currentTab: number;
  onTabChange: (tab: number) => void;
  onLogin?: () => void;
  onLogout?: () => void;
  user?: any;
}

export const TABS = [
  { id: 1, name: 'Home', desc: 'Home & Landing' },
  { id: 2, name: 'Dashboard', desc: 'Simulation Dashboard' },
  { id: 3, name: 'Content Chat', desc: 'Test Runner' },
  { id: 4, name: 'Persona Builder', desc: 'Focus Groups' },
  { id: 5, name: 'Content Craft', desc: 'Variant Studio' },
  { id: 6, name: 'Browser Automation', desc: 'Nova Act Session' },
  { id: 7, name: 'QA & Flow', desc: 'Nova Act SDK' },
  { id: 8, name: 'Data Extract', desc: 'Research' },
  { id: 9, name: 'UI Verify', desc: 'MCP Tools' },
  { id: 10, name: 'Deployment', desc: 'Integrations & Prod' },
];

const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange, onLogin, onLogout, user }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 left-0 right-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md py-2 border-b border-gray-800">
      <div className="max-w-[1600px] mx-auto px-4 flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onTabChange(1)}>
          <div className="w-7 h-7 flex items-center justify-center font-bold text-sm text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-full h-full">
              <path d="M12 2L2 22h20L12 2z" className="text-teal-500" />
              <path d="M12 6L6 20h12L12 6z" className="text-white fill-white" />
            </svg>
          </div>
          <span className="font-bold text-base tracking-tight text-white hidden xl:inline">SyncUsers & NovaAct</span>
        </div>

        {/* Tab Links (Tabs 1-10) */}
        <div className="hidden lg:flex items-center gap-1 xl:gap-2">
          {TABS.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex flex-col items-center ${
                  isActive
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                    : 'text-gray-400 hover:text-white border border-transparent hover:bg-gray-900/50'
                }`}
                title={tab.desc}
              >
                <span>{tab.name}</span>
                <span className="text-[8px] opacity-60 font-medium hidden xl:inline">{tab.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Auth Controls */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-full pl-2 pr-3 py-1">
               {user.avatarUrl && <img src={user.avatarUrl} alt={user.preferred_username} className="w-5 h-5 rounded-full" />}
               <span className="text-xs font-medium text-gray-300 max-w-[80px] truncate">{user.preferred_username}</span>
               <button onClick={onLogout} className="text-[10px] text-gray-500 hover:text-red-400 font-semibold ml-1">Out</button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={onLogin} className="py-1 text-xs">Sign in with HF</Button>
          )}

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden text-gray-300 hover:text-white p-1.5 rounded-lg hover:bg-gray-900"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-black border-t border-gray-800 p-4 absolute top-full left-0 right-0 max-h-[80vh] overflow-y-auto">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 px-2">Navigation (Tabs 1-10)</span>
            {TABS.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg text-left text-sm font-medium ${
                    isActive ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'text-gray-300 hover:bg-gray-900/50'
                  }`}
                  onClick={() => {
                    onTabChange(tab.id);
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <div>
                    <div className="font-bold">{tab.name}</div>
                    <div className="text-[10px] opacity-60">{tab.desc}</div>
                  </div>
                  <span className="text-xs opacity-40 font-mono">Tab {tab.id}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;