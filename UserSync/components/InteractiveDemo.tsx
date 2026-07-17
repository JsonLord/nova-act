import React, { useState, useEffect, useMemo } from 'react';
import Button from './ui/Button';
import { Check, Sparkles, Send, MessageSquare, X } from 'lucide-react';

// --- Shared Components ---

const NetworkBackground: React.FC<{ className?: string }> = ({ className = "" }) => {
  // Static node positions for consistency in other steps
  const nodes = [
    { cx: "20%", cy: "20%", r: 4, fill: "#14b8a6" }, // teal
    { cx: "50%", cy: "10%", r: 6, fill: "#a855f7" }, // purple
    { cx: "80%", cy: "30%", r: 5, fill: "#f97316" }, // orange
    { cx: "30%", cy: "50%", r: 7, fill: "#3b82f6" }, // blue
    { cx: "70%", cy: "60%", r: 6, fill: "#ec4899" }, // pink
    { cx: "10%", cy: "70%", r: 5, fill: "#ef4444" }, // red
    { cx: "40%", cy: "80%", r: 4, fill: "#14b8a6" },
    { cx: "90%", cy: "80%", r: 5, fill: "#8b5cf6" },
    { cx: "60%", cy: "40%", r: 3, fill: "#eab308" },
    { cx: "25%", cy: "90%", r: 6, fill: "#3b82f6" },
  ];

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none opacity-30 ${className}`}>
      <svg className="w-full h-full">
        {/* Lines */}
        <line x1="20%" y1="20%" x2="50%" y2="10%" stroke="#374151" strokeWidth="1" />
        <line x1="50%" y1="10%" x2="80%" y2="30%" stroke="#374151" strokeWidth="1" />
        <line x1="20%" y1="20%" x2="30%" y2="50%" stroke="#374151" strokeWidth="1" />
        <line x1="30%" y1="50%" x2="70%" y2="60%" stroke="#374151" strokeWidth="1" />
        <line x1="70%" y1="60%" x2="80%" y2="30%" stroke="#374151" strokeWidth="1" />
        <line x1="30%" y1="50%" x2="10%" y2="70%" stroke="#374151" strokeWidth="1" />
        <line x1="40%" y1="80%" x2="10%" y2="70%" stroke="#374151" strokeWidth="1" />
        <line x1="70%" y1="60%" x2="90%" y2="80%" stroke="#374151" strokeWidth="1" />
        <line x1="50%" y1="10%" x2="60%" y2="40%" stroke="#374151" strokeWidth="1" />
        <line x1="25%" y1="90%" x2="40%" y2="80%" stroke="#374151" strokeWidth="1" />

        {/* Nodes */}
        {nodes.map((node, i) => (
          <circle key={i} {...node} className="animate-pulse" style={{ animationDelay: `${i * 0.5}s` }} />
        ))}
      </svg>
    </div>
  );
};

const SectionLayout: React.FC<{
  number: string;
  title: string;
  description: React.ReactNode;
  visual: React.ReactNode;
}> = ({ number, title, description, visual }) => {
  return (
    <section className="py-24 border-t border-gray-900 bg-black">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Text Content */}
        <div className="order-2 lg:order-1">
          <div className="w-12 h-12 rounded-full border border-gray-700 flex items-center justify-center mb-8 text-xl font-mono text-white">
            {number}
          </div>
          <h2 className="text-4xl md:text-5xl font-semibold mb-6 text-white">{title}</h2>
          <div className="text-xl text-gray-400 leading-relaxed max-w-lg">
            {description}
          </div>
        </div>

        {/* Visual Content */}
        <div className="order-1 lg:order-2 relative h-[500px] bg-gray-900/20 border border-gray-800 rounded-3xl overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 w-full h-full flex items-center justify-center p-0">
            {visual}
          </div>
        </div>
      </div>
    </section>
  );
};

// --- Step 1: Generate Focus Group ---

const Step1 = () => {
  const [status, setStatus] = useState<'input' | 'creating' | 'ready'>('input');
  const [inputValue, setInputValue] = useState("AI-focused startup founders in Europe");

  const handleCreate = () => {
    setStatus('creating');
    setTimeout(() => {
      setStatus('ready');
    }, 2000);
  };

  return (
    <SectionLayout
      number="1"
      title="Generate Any Focus Group"
      description={
        <div className="space-y-6">
          <p>
            Use plain english to describe your target audience, or generate a personal focus group based on your real social media interactions.
          </p>
          <div className="space-y-2 pt-2">
             <p className="text-base font-medium text-gray-300">
               Personalize your experience with your own LinkedIn network database.
             </p>
             <p className="text-sm text-gray-500">
               LinkedIn and X data are going into the persona simulator.
             </p>
          </div>
        </div>
      }
      visual={
        <>
           {/* Background for all phases, fully visible in 'ready' */}
           <div className={`transition-opacity duration-1000 ${status === 'ready' ? 'opacity-100' : 'opacity-30'}`}>
              <NetworkBackground className="opacity-100" />
           </div>

          {/* Input State */}
          <div className={`transition-all duration-500 absolute w-full max-w-sm z-20 ${status === 'input' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
             <div className="bg-black border border-gray-800 rounded-xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <span className="text-gray-400 text-sm">Target Audience</span>
                    <button className="text-gray-500 hover:text-white"><X size={16}/></button>
                </div>
                <h4 className="text-xl mb-4 text-center">Who would you like to simulate?</h4>
                <div className="relative mb-6">
                    <input 
                      type="text" 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-teal-500"
                    />
                    <span className="absolute right-3 top-3.5 w-0.5 h-5 bg-teal-500 animate-blink"></span>
                </div>
                <Button className="w-full py-3" onClick={handleCreate}>
                   Generate Your Focus Group <Sparkles size={16} className="ml-2" />
                </Button>
             </div>
          </div>

          {/* Creating State */}
          <div className={`transition-all duration-500 absolute z-20 ${status === 'creating' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
             <div className="bg-black/80 backdrop-blur-md border border-gray-700 rounded-full px-8 py-4 flex items-center gap-3 shadow-2xl">
                <Sparkles className="text-teal-400 animate-pulse" />
                <span className="text-lg font-medium">Generating Focus Group...</span>
             </div>
          </div>

          {/* Ready State */}
          <div className={`transition-all duration-1000 absolute inset-0 flex items-end justify-center pb-8 ${status === 'ready' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
             {/* Bottom Toast Overlay */}
             <div className="bg-black/80 backdrop-blur border border-gray-800 rounded-full pl-3 pr-6 py-2 flex items-center gap-3 shadow-2xl pointer-events-auto">
                <div className="bg-green-500/20 rounded-full p-1">
                    <Check className="w-4 h-4 text-green-500" />
                </div>
                <span className="text-sm font-medium text-white whitespace-nowrap">Your Personal Focus Group is Ready</span>
             </div>
             <div className="absolute bottom-2 text-center pointer-events-auto">
                <button 
                  onClick={() => setStatus('input')}
                  className="text-xs text-gray-500 hover:text-white transition-colors"
                >
                  Start Over
                </button>
             </div>
          </div>
        </>
      }
    />
  );
};

// --- Step 2: Run Experiments ---

const Step2 = () => {
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
    }, 2500);
  };

  return (
    <SectionLayout
      number="2"
      title="Validate Campaign Narratives"
      description="Execute simulations in minutes to find the optimal resonance of your brand message."
      visual={
        <>
          <NetworkBackground />
          <div className="w-full max-w-sm relative z-10">
             {/* Post Card */}
             <div className={`bg-black border border-gray-800 rounded-xl p-6 shadow-2xl transition-all duration-500 ${isSimulating ? 'opacity-40 blur-sm scale-95' : 'opacity-100 scale-100'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gray-700"></div>
                  <div>
                    <div className="w-24 h-3 bg-gray-700 rounded mb-1"></div>
                    <div className="w-16 h-2 bg-gray-800 rounded"></div>
                  </div>
                </div>
                <div className="space-y-2 mb-6">
                  <div className="w-full h-2 bg-gray-800 rounded"></div>
                  <div className="w-full h-2 bg-gray-800 rounded"></div>
                  <div className="w-3/4 h-2 bg-gray-800 rounded"></div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 mb-4 border border-gray-800">
                  <p className="text-gray-300 text-sm">
                      Our new brand identity focuses on radical transparency and community-driven growth...
                  </p>
                </div>
                <Button 
                   className="w-full flex items-center justify-center gap-2"
                   onClick={handleSimulate}
                >
                   Simulate Campaign <Send size={16} />
                </Button>
             </div>

             {/* Simulating Overlay */}
             <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${isSimulating ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
                 <div className="bg-black/90 backdrop-blur border border-gray-700 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 min-w-[200px]">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full border-2 border-gray-800 border-t-teal-500 animate-spin"></div>
                      <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-teal-500 w-5 h-5" />
                    </div>
                    <span className="text-white font-medium">Simulating reactions...</span>
                 </div>
             </div>
          </div>
        </>
      }
    />
  );
};

// --- Step 3: Get Insights ---

const Step3 = () => {
  return (
    <SectionLayout
      number="3"
      title="Measure Brand Resonance"
      description="Evaluate how your brand values land with specific demographics through detailed sentiment scores."
      visual={
        <>
        <NetworkBackground />
        <div className="w-full max-w-sm space-y-4 relative z-10">
           {/* Score Card */}
           <div className="bg-black border border-gray-800 rounded-xl p-6 shadow-2xl hover:border-gray-600 transition-colors cursor-default group">
              <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Brand Alignment</span>
                    <div className="text-3xl font-bold text-white mt-1">94<span className="text-base font-normal text-gray-500">/100</span></div>
                  </div>
                  <div className="bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded border border-green-500/20">Highly Coherent</div>
              </div>
              
              <div className="space-y-4">
                 <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                       <span>Trustworthiness</span>
                       <span>88%</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                       <div className="h-full bg-green-500 w-[88%] rounded-full group-hover:bg-green-400 transition-colors"></div>
                    </div>
                 </div>
                 <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                       <span>Brand Recall</span>
                       <span>82%</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                       <div className="h-full bg-teal-500 w-[82%] rounded-full group-hover:bg-teal-400 transition-colors"></div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Feedback Card */}
           <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-2 mb-3">
                 <MessageSquare size={14} className="text-purple-400" />
                 <span className="text-xs font-medium text-purple-200">Brand Insight</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed italic">
                 "The 'transparency' angle increased trust scores by 25% among Millennial tech professionals."
              </p>
           </div>
        </div>
        </>
      }
    />
  );
};

// --- Step 4: Forecast Outcome ---

const Step4 = () => {
  const [activeVariant, setActiveVariant] = useState(0);

  const variants = [
    { label: "Original", score: 52, text: "We're launching a new sustainable clothing line next month." },
    { label: "Variant 1", score: 91, text: "Radical transparency in every stitch. Meet the brand that's redefining sustainable luxury." },
    { label: "Variant 2", score: 78, text: "Style without compromise. Our eco-friendly collection arrives soon." },
  ];

  return (
    <SectionLayout
      number="4"
      title="Forecast Every Outcome"
      description="SyncUsers uses your style to generate and test variations of your original post every time you run a simulation."
      visual={
        <div className="relative w-full max-w-lg flex items-center justify-center">
            <NetworkBackground />
            
            {/* Main Content Area */}
            <div className="w-full max-w-xs bg-black border border-gray-800 rounded-xl p-6 shadow-2xl relative z-10 transition-all duration-300">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">{variants[activeVariant].label}</span>
                  <div className={`px-2 py-0.5 rounded text-xs font-bold ${activeVariant === 0 ? 'bg-gray-800 text-gray-400' : 'bg-green-900 text-green-400'}`}>
                    Score: {variants[activeVariant].score}
                  </div>
                </div>
                <div className="min-h-[100px]">
                  <p className="text-sm text-gray-200 leading-relaxed animate-fade-in">
                    {variants[activeVariant].text}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-800 flex gap-4">
                   <div className="h-2 w-8 bg-gray-800 rounded-full"></div>
                   <div className="h-2 w-16 bg-gray-800 rounded-full"></div>
                </div>
            </div>

            {/* Floating Menu */}
            <div className="absolute -right-4 top-1/2 -translate-y-1/2 translate-x-1/2 w-48 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl p-2 shadow-2xl z-20">
               <div className="text-[10px] text-gray-500 uppercase px-2 mb-2 font-bold tracking-wider">Select Variant</div>
               <div className="space-y-1">
                 {variants.map((v, i) => (
                   <div 
                      key={i}
                      onMouseEnter={() => setActiveVariant(i)}
                      className={`p-2 rounded cursor-pointer transition-all flex justify-between items-center group ${activeVariant === i ? 'bg-white text-black' : 'hover:bg-white/10 text-gray-400'}`}
                   >
                      <span className="text-xs font-medium">{v.label}</span>
                      <span className={`text-xs font-bold ${activeVariant === i ? 'text-black' : 'text-gray-500 group-hover:text-white'}`}>{v.score}</span>
                   </div>
                 ))}
               </div>
            </div>

            {/* Connecting Line Visual */}
            <div className="absolute right-[50%] top-1/2 w-[30%] h-[1px] bg-gradient-to-r from-transparent to-gray-700 -z-10"></div>
        </div>
      }
    />
  );
};

// --- Main Container ---

const InteractiveDemo: React.FC = () => {
  return (
    <div className="flex flex-col">
      <Step1 />
      <Step2 />
      <Step3 />
      <Step4 />
    </div>
  );
};

export default InteractiveDemo;