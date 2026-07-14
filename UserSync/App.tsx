import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import TrustedBy from './components/TrustedBy';
import ProductOverview from './components/ProductOverview';
import InteractiveDemo from './components/InteractiveDemo';
import UseCases from './components/UseCases';
import HowItWorks from './components/HowItWorks';
import Accuracy from './components/Accuracy';
import Documentation from './components/Documentation';
import FAQ from './components/FAQ';
import Footer from './components/Footer';

// Importing all 10 Tab views
import SimulationPage from './components/SimulationPage';
import ChatPage from './components/ChatPage';
import PersonaBuilder from './components/PersonaBuilder';
import ContentCraft from './components/ContentCraft';
import NovaActAutomation from './components/NovaActAutomation';
import NovaActQA from './components/NovaActQA';
import NovaActExtraction from './components/NovaActExtraction';
import UIVerificationTab from './components/UIVerificationTab';
import DeploymentTab from './components/DeploymentTab';
import ProductGuide from './components/ProductGuide';

type TabId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

const TAB_LABELS: Record<TabId, string> = {
  1: "Tab 1: Home / Landing",
  2: "Tab 2: Simulation Dashboard",
  3: "Tab 3: Content Chat / Test Runner",
  4: "Tab 4: Persona Builder",
  5: "Tab 5: Content Craft Studio",
  6: "Tab 6: Browser Automation",
  7: "Tab 7: QA & Flow Testing",
  8: "Tab 8: Data Extraction",
  9: "Tab 9: UI Verification",
  10: "Tab 10: Deployment Hub"
};

function App() {
  const [activeTab, setActiveTab] = useState<TabId>(2);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/user');
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };
    fetchUser();

    const handleStorage = () => fetchUser();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loginWithHF = () => {
    window.open('/login', '_blank');
  };

  const handleLogout = async () => {
    await fetch('/api/logout');
    setUser(null);
  };

  const startSimulation = () => {
    setActiveTab(2);
    window.scrollTo(0,0);
  };

  const goBackToLanding = () => {
    setActiveTab(1);
  };

  const openChat = () => {
    setActiveTab(3);
  };

  const openGuide = () => {
    setActiveTab(10);
  };

  return (
    <div className="bg-black min-h-screen text-white selection:bg-teal-500/30 font-sans">
      {/* Dynamic Tab Navigation Row on the right navbar or as top switcher bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-gray-800 py-3.5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={goBackToLanding}>
            <div className="w-7 h-7 flex items-center justify-center font-bold text-lg text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-full h-full text-teal-400">
                <path d="M12 2L2 22h20L12 2z" />
              </svg>
            </div>
            <span className="font-extrabold text-base tracking-tight text-white bg-clip-text">Nova Workspace</span>
          </div>

          {/* Right Workspace Tab Navigation Custom Dropdown to avoid breaking Playwright nth(1) select matcher */}
          <div className="flex items-center gap-2 flex-wrap justify-end relative" ref={dropdownRef}>
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mr-1 hidden lg:inline">Active Tab:</span>

            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="bg-gray-900 border border-gray-700 hover:border-teal-500 text-teal-300 text-xs font-semibold rounded-lg px-4 py-2 flex items-center gap-1.5 transition-all focus:outline-none"
            >
              <span>{TAB_LABELS[activeTab]}</span>
              <span className="text-[8px] text-teal-500">▼</span>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-[#0a0a0a] border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-1.5 space-y-0.5">
                  {(Object.keys(TAB_LABELS) as unknown as TabId[]).map((idStr) => {
                    const id = Number(idStr) as TabId;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setActiveTab(id);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                          activeTab === id
                            ? 'bg-teal-950/40 text-teal-300 border-l-2 border-teal-500'
                            : 'text-gray-400 hover:bg-gray-900 hover:text-white'
                        }`}
                      >
                        {TAB_LABELS[id]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {user ? (
              <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5">
                 {user.avatarUrl && <img src={user.avatarUrl} alt={user.preferred_username} className="w-5 h-5 rounded-full" />}
                 <span className="text-xs font-medium text-gray-300">{user.preferred_username}</span>
              </div>
            ) : (
              <button onClick={loginWithHF} className="text-xs border border-gray-800 hover:border-gray-600 bg-black hover:bg-gray-950 text-gray-300 rounded-lg px-3 py-1.5 font-medium transition-all">
                Sign in
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Container rendering dynamically chosen Tab */}
      <div className="pt-20">
        {activeTab === 1 && (
          <div>
            <Hero onStart={startSimulation} />
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
        )}

        {activeTab === 2 && (
          <SimulationPage
            onBack={goBackToLanding}
            onOpenChat={openChat}
            onOpenGuide={openGuide}
            user={user}
            onLogin={loginWithHF}
            onLogout={handleLogout}
            simulationResult={simulationResult}
            setSimulationResult={setSimulationResult}
          />
        )}

        {activeTab === 3 && (
          <ChatPage
            onBack={() => setActiveTab(2)}
            simulationResult={simulationResult}
            setSimulationResult={setSimulationResult}
          />
        )}

        {activeTab === 4 && <PersonaBuilder />}

        {activeTab === 5 && <ContentCraft />}

        {activeTab === 6 && <NovaActAutomation />}

        {activeTab === 7 && <NovaActQA />}

        {activeTab === 8 && <NovaActExtraction />}

        {activeTab === 9 && <UIVerificationTab />}

        {activeTab === 10 && <DeploymentTab />}
      </div>
    </div>
  );
}

export default App;