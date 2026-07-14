import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Navbar from './components/Navbar';
import ProductGuide from './components/ProductGuide';

// Importing Tab components
import LandingTab from './components/LandingTab';
import SimulationPage from './components/SimulationPage';
import ChatPage from './components/ChatPage';
import PersonaBuilderTab from './components/PersonaBuilderTab';
import ContentCraftTab from './components/ContentCraftTab';
import BrowserAutomationTab from './components/BrowserAutomationTab';
import QaTestingTab from './components/QaTestingTab';
import DataExtractionTab from './components/DataExtractionTab';
import UiVerificationTab from './components/UiVerificationTab';
import DeploymentTab from './components/DeploymentTab';

function App() {
  const [currentTab, setCurrentTab] = useState<number>(1); // Default to Tab 1 (LandingTab) for a better welcoming flow
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);

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

  const loginWithHF = () => {
    window.open('/login', '_blank');
  };

  const handleLogout = async () => {
    await fetch('/api/logout');
    setUser(null);
  };

  if (showGuide) {
    return (
      <div className="bg-black min-h-screen relative">
        <button
          onClick={() => setShowGuide(false)}
          className="absolute top-8 left-8 p-3 bg-gray-900 border border-gray-800 rounded-full text-white hover:bg-gray-800 transition-colors z-50"
        >
          <X size={24} />
        </button>
        <ProductGuide />
      </div>
    );
  }

  // Helper function to render current tab component
  const renderTabContent = () => {
    switch (currentTab) {
      case 1:
        return <LandingTab onTabChange={setCurrentTab} />;
      case 2:
        return (
          <SimulationPage
            onBack={() => setCurrentTab(1)}
            onOpenChat={() => setCurrentTab(3)}
            onOpenGuide={() => setShowGuide(true)}
            user={user}
            onLogin={loginWithHF}
            onLogout={handleLogout}
            simulationResult={simulationResult}
            setSimulationResult={setSimulationResult}
          />
        );
      case 3:
        return (
          <ChatPage
            onBack={() => setCurrentTab(2)}
            simulationResult={simulationResult}
            setSimulationResult={setSimulationResult}
          />
        );
      case 4:
        return <PersonaBuilderTab />;
      case 5:
        return <ContentCraftTab />;
      case 6:
        return <BrowserAutomationTab />;
      case 7:
        return <QaTestingTab />;
      case 8:
        return <DataExtractionTab />;
      case 9:
        return <UiVerificationTab />;
      case 10:
        return <DeploymentTab />;
      default:
        return <LandingTab onTabChange={setCurrentTab} />;
    }
  };

  return (
    <div className="bg-black min-h-screen text-white selection:bg-teal-500/30 flex flex-col">
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onLogin={loginWithHF}
        onLogout={handleLogout}
        user={user}
      />
      <main className="flex-1">
        {renderTabContent()}
      </main>
    </div>
  );
}

export default App;