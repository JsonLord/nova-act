import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Navbar from './components/Navbar';
import ProductGuide from './components/ProductGuide';
import MainTabViews, { MainTabId } from './components/MainTabViews';

function App() {
  const [currentTab, setCurrentTab] = useState<MainTabId>('usersync');
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);

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
        <MainTabViews tab={currentTab} onOpenGuide={() => setShowGuide(true)} user={user} onLogin={loginWithHF} onLogout={handleLogout} simulationResult={simulationResult} setSimulationResult={setSimulationResult} />
      </main>
    </div>
  );
}

export default App;
