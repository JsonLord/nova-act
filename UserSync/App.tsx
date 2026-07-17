import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Navbar from './components/Navbar';
import ProductGuide from './components/ProductGuide';
import MainTabViews, { MainTabId } from './components/MainTabViews';
import { TAB_PROMISES, PRODUCT_NAME } from './branding';
import { useHashRoute } from './services/useHashRoute';

const KNOWN_TABS = ['usersync', 'nova-act', 'datahub', 'oasis', 'graph', 'dev'];

function App() {
  const [route, navigate] = useHashRoute('usersync');
  const currentTab = (KNOWN_TABS.includes(route.tab) ? route.tab : 'usersync') as MainTabId;
  const setCurrentTab = (tab: MainTabId) => navigate(tab);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // Deep-linkable page title per tab (spec §11 / branding).
  useEffect(() => {
    document.title = `${PRODUCT_NAME} — ${TAB_PROMISES[currentTab] || 'AI usability testing'}`;
  }, [currentTab]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/user');
        if (response.ok) setUser(await response.json());
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    };
    fetchUser();
    window.addEventListener('storage', fetchUser);
    return () => window.removeEventListener('storage', fetchUser);
  }, []);

  const loginWithHF = () => window.open('/login', '_blank');
  const handleLogout = async () => {
    await fetch('/api/logout');
    setUser(null);
  };

  if (showGuide) {
    return (
      <div className="bg-black min-h-screen relative">
        <button onClick={() => setShowGuide(false)} className="absolute top-8 left-8 p-3 bg-gray-900 border border-gray-800 rounded-full text-white hover:bg-gray-800 transition-colors z-50">
          <X size={24} />
        </button>
        <ProductGuide />
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen text-white selection:bg-teal-500/30 flex flex-col">
      <Navbar currentTab={currentTab} onTabChange={setCurrentTab} onLogin={loginWithHF} onLogout={handleLogout} user={user} />
      <main className="flex-1">
        <MainTabViews tab={currentTab} routeView={route.view} onNavigate={navigate} onOpenGuide={() => setShowGuide(true)} user={user} onLogin={loginWithHF} onLogout={handleLogout} simulationResult={simulationResult} setSimulationResult={setSimulationResult} />
      </main>
    </div>
  );
}

export default App;
