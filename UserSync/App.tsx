
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
import SimulationPage from './components/SimulationPage';
import ChatPage from './components/ChatPage';
import ProductGuide from './components/ProductGuide';

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'simulation' | 'chat' | 'guide'>('simulation');
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

    // Listen for storage changes in case of popup login
    const handleStorage = () => fetchUser();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const loginWithHF = () => {
    // Open in a new tab to pop out of iframe
    window.open('/login', '_blank');
  };

  const handleLogout = async () => {
    await fetch('/api/logout');
    setUser(null);
  };

  const startSimulation = () => {
    setCurrentView('simulation');
    window.scrollTo(0,0);
  };

  const goBackToLanding = () => {
    setCurrentView('landing');
  };

  const openChat = () => {
    setCurrentView('chat');
  };

  const openGuide = () => {
    setCurrentView('guide');
  };

  const goBackToSimulation = () => {
    setCurrentView('simulation');
  };

  if (currentView === 'guide') {
    return (
      <div className="bg-black min-h-screen relative">
        <button
          onClick={goBackToSimulation}
          className="absolute top-8 left-8 p-3 bg-gray-900 border border-gray-800 rounded-full text-white hover:bg-gray-800 transition-colors z-50"
        >
          <X size={24} />
        </button>
        <ProductGuide />
      </div>
    );
  }

  if (currentView === 'simulation') {
    return (
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
    );
  }

  if (currentView === 'conversation') {
    return <ConversationPage onBack={goBackToSimulation} />;
  }

  if (currentView === 'chat') {
    return (
      <ChatPage
        onBack={goBackToSimulation}
        simulationResult={simulationResult}
        setSimulationResult={setSimulationResult}
      />
    );
  }

  return (
    <div className="bg-black min-h-screen text-white selection:bg-teal-500/30">
      <Navbar onStart={startSimulation} onLogin={loginWithHF} user={user} />
      <main>
        <Hero onStart={startSimulation} />
        <TrustedBy />
        <ProductOverview />
        <InteractiveDemo />
        <UseCases />
        <HowItWorks />
        <Accuracy />
        <Documentation />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}

export default App;