import React from 'react';
import { User, Share2, Cpu, CheckCircle, Scale } from 'lucide-react';

const HowItWorks: React.FC = () => {
  const steps = [
    { icon: <User />, label: "Persona Creation" },
    { icon: <Share2 />, label: "Focus Group Construction" },
    { icon: <Cpu />, label: "AI-driven Simulations" },
    { icon: <CheckCircle />, label: "Result Generation" },
    { icon: <Scale />, label: "Automatic A/B Testing" },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-black border-t border-gray-900">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <div className="inline-block px-4 py-1.5 rounded-full border border-gray-700 text-sm text-gray-300 mb-8">How It Works</div>
        <h2 className="text-3xl md:text-5xl font-semibold mb-20">From raw data to real understanding</h2>
        
        {/* Steps Navigation/Visual */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-20">
           {steps.map((step, idx) => (
             <div key={idx} className="flex flex-col items-center gap-3 group cursor-default">
                <div className="w-16 h-12 md:w-auto md:h-auto px-6 py-3 rounded-full border border-gray-700 bg-gray-900/50 flex items-center gap-2 text-gray-400 group-hover:text-white group-hover:border-gray-500 transition-all">
                   {step.icon}
                   <span className="text-sm font-medium hidden md:inline">{step.label}</span>
                </div>
             </div>
           ))}
        </div>

        {/* Abstract Visualization */}
        <div className="relative h-[400px] w-full max-w-4xl mx-auto border border-gray-800 rounded-3xl bg-black overflow-hidden flex items-center justify-center">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
             {/* Radar/Network Graphic */}
             <div className="relative w-96 h-96">
                <div className="absolute inset-0 border border-blue-900/30 rounded-full animate-ping duration-[3000ms]"></div>
                <div className="absolute inset-10 border border-blue-800/30 rounded-full"></div>
                <div className="absolute inset-20 border border-blue-700/30 rounded-full"></div>
                
                {/* Connecting Lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* Center to Top (in) */}
                  <line x1="50%" y1="50%" x2="50%" y2="5%" stroke="#3b82f6" strokeWidth="2" strokeOpacity="0.5" />
                  {/* Center to Bottom Right (X) */}
                  <line x1="50%" y1="50%" x2="85%" y2="85%" stroke="#3b82f6" strokeWidth="2" strokeOpacity="0.5" />
                  {/* Center to Bottom Left (Globe) */}
                  <line x1="50%" y1="50%" x2="15%" y2="85%" stroke="#3b82f6" strokeWidth="2" strokeOpacity="0.5" />
                </svg>
                
                {/* Center Node */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gray-900 rounded-full border-2 border-blue-500 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.5)] z-10">
                   <User className="text-white w-6 h-6" />
                </div>

                {/* Satellite Nodes */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 bg-gray-900 border border-gray-600 rounded-full flex items-center justify-center z-10">
                   <span className="text-xs font-bold">in</span>
                </div>
                <div className="absolute bottom-10 right-10 w-10 h-10 bg-gray-900 border border-gray-600 rounded-full flex items-center justify-center z-10">
                   <span className="text-xs font-bold">X</span>
                </div>
                 <div className="absolute bottom-10 left-10 w-10 h-10 bg-gray-900 border border-gray-600 rounded-full flex items-center justify-center z-10">
                   <GlobeIcon />
                </div>
             </div>
        </div>
      </div>
    </section>
  );
};

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
  </svg>
);

export default HowItWorks;