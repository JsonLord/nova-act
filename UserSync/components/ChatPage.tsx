
import React, { useState, useRef, useEffect } from 'react';
import { X, ClipboardList, Linkedin, Instagram, Mail, Layout, Edit3, MonitorPlay, Lightbulb, Image, Plus, Sparkles, Zap, Video, Megaphone, Link as LinkIcon, Loader2, RefreshCw, CheckCircle2, MessageSquare } from 'lucide-react';
import { GradioService } from '../services/gradioService';

// --- Types ---
interface ChatPageProps {
  onBack: () => void;
  simulationResult: any;
  setSimulationResult: (res: any) => void;
}

// --- Sub-components (Modular Structure) ---

const ChatButton: React.FC<{ label: string; primary?: boolean; icon?: React.ReactNode; onClick?: () => void; className?: string }> = ({ label, primary, icon, onClick, className = "" }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap
      ${primary 
        ? 'bg-white text-black hover:bg-gray-200 shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
        : 'bg-gray-900 border border-gray-800 text-gray-300 hover:bg-gray-800 hover:text-white hover:border-gray-600'
      } ${className}`}
  >
    {icon}
    {primary && <Zap size={14} className="fill-black" />}
    {label}
  </button>
);

const CategoryCard: React.FC<{
  title: string;
  options: { label: string; icon: React.ReactNode }[];
  selectedVariation: string;
  onSelect: (label: string) => void;
}> = ({ title, options, selectedVariation, onSelect }) => (
  <div className="flex flex-col gap-3">
    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">{title}</h3>
    <div className="space-y-1">
      {options.map((option) => (
        <div
          key={option.label}
          onClick={() => onSelect(option.label)}
          className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all duration-200
            ${selectedVariation === option.label
              ? 'bg-teal-900/20 border-teal-500/50 text-white'
              : 'hover:bg-gray-900/80 border-transparent hover:border-gray-800'}`}
        >
          <div className={`${selectedVariation === option.label ? 'text-teal-400' : 'text-gray-500 group-hover:text-white'} transition-colors w-5 flex justify-center`}>
            {option.icon}
          </div>
          <span className={`text-sm font-medium ${selectedVariation === option.label ? 'text-teal-100' : 'text-gray-400 group-hover:text-gray-200'}`}>{option.label}</span>
        </div>
      ))}
    </div>
  </div>
);

const ChatInput: React.FC<{ onSimulate: (msg: string) => void; onHelpMeCraft: (msg: string) => void; isSimulating: boolean }> = ({ onSimulate, onHelpMeCraft, isSimulating }) => {
  const [message, setMessage] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setUploadedFiles(prev => [...prev, ...newFiles]);
      console.log("Selected files:", newFiles.map(f => f.name));
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="border-t border-gray-800 pt-6 bg-[#0a0a0a] px-6 pb-8 md:pb-10 z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
      <div className="max-w-5xl mx-auto space-y-4">
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {uploadedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-full text-[10px] text-gray-300">
                <Image size={10} />
                <span className="truncate max-w-[100px]">{file.name}</span>
                <button onClick={() => removeFile(idx)} className="text-gray-500 hover:text-white">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          className="w-full h-24 bg-black border border-gray-800 text-gray-200 placeholder-gray-600 p-4 rounded-2xl resize-none focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600 transition-all text-sm leading-relaxed"
          placeholder="Paste your brand narrative or campaign copy here"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div className="flex gap-2 md:gap-3 flex-wrap">
            <div className="flex flex-col gap-2">
                <ChatButton label="Brand Asset for Testing" icon={<LinkIcon size={14} />} />
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
              multiple
            />
            <ChatButton
              label={uploadedFiles.length > 0 ? `${uploadedFiles.length} Images Selected` : "Upload Images"}
              icon={uploadedFiles.length > 0 ? <CheckCircle2 size={14} className="text-green-500" /> : <Image size={14} />}
              className="h-fit"
              onClick={handleUploadClick}
            />
          </div>
          <div className="flex gap-3 items-center mt-auto">
             <button
               onClick={() => onHelpMeCraft(message)}
               className="hidden md:flex text-xs text-gray-500 hover:text-white transition-colors items-center gap-1 mr-2"
             >
                Help Me Craft <Sparkles size={12} />
             </button>
            <div className="flex gap-2">
              <ChatButton
                label="Send"
                onClick={() => onSimulate(message)}
                icon={<MessageSquare size={14} />}
              />
              <ChatButton
                label={isSimulating ? "Please wait..." : "Simulate"}
                primary
                onClick={() => onSimulate(message)}
                icon={isSimulating ? <Loader2 size={14} className="animate-spin" /> : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Page Component ---

const ChatPage: React.FC<ChatPageProps> = ({ onBack, simulationResult, setSimulationResult }) => {
  const [showNotification, setShowNotification] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [simulationId, setSimulationId] = useState<string>('User Group 1');
  const [selectedVariation, setSelectedVariation] = useState<string>('');
  const [showContextModal, setShowContextModal] = useState(false);
  const [contextInput, setContextInput] = useState('');

  useEffect(() => {
    const fetchSimulations = async () => {
      try {
        const sims = await GradioService.listSimulations();
        if (Array.isArray(sims) && sims.length > 0) {
          const firstSim = typeof sims[0] === 'string' ? sims[0] : (sims[0].id || sims[0].name || '');
          if (firstSim) {
            setSimulationId(firstSim);
          }
        }
      } catch (e) {
        console.error("Failed to fetch simulations:", e);
      }
    };
    fetchSimulations();
  }, []);

  const handleSimulate = async (msg: string) => {
    if (!msg.trim()) {
      alert("Please enter some content to simulate.");
      return;
    }
    setIsSimulating(true);
    setShowNotification(true);
    setSimulationResult(null);

    try {
      const result = await GradioService.startSimulationAsync(simulationId, msg);
      setCurrentJobId(result);
      setIsSimulating(false);
      const resData = {
        status: "Initiated",
        message: "Simulation started successfully. Please wait for the results.",
        data: result,
        content: msg,
        variation: selectedVariation,
        simulationId
      };
      setSimulationResult(resData);

      // Persist simulation initiation
      fetch('/api/save-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'simulation-start',
          data: resData,
          user: 'chat-user'
        })
      }).catch(console.error);

    } catch (error) {
      setIsSimulating(false);
      setSimulationResult({
        status: "Error",
        message: "Failed to start simulation. Please try again."
      });
    }
  };

  const handleRefresh = async () => {
    setIsSimulating(true);
    try {
      const status = await GradioService.getSimulationStatus(currentJobId || simulationId);
      setIsSimulating(false);
      const resData = {
        status: "Updated",
        message: "Latest status gathered from API.",
        data: status,
        simulationId
      };
      setSimulationResult(resData);

      // Persist simulation result
      fetch('/api/save-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'simulation-result',
          data: resData,
          user: 'chat-user'
        })
      }).catch(console.error);

    } catch (error) {
      setIsSimulating(false);
      setSimulationResult({
        status: "Error",
        message: "Failed to gather results. The simulation might still be in progress."
      });
    }
  };

  const handleHelpMeCraft = async (msg: string) => {
    if (!msg.trim()) {
        alert("Please enter some content first.");
        return;
    }

    setIsSimulating(true);
    try {
        const response = await fetch('/api/craft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: msg,
                variation: selectedVariation
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to craft content');
        }

        alert(`Crafted variants for ${selectedVariation || 'general content'}:\n\n` + data.result);
    } catch (e: any) {
        console.error(e);
        alert("Failed to craft content: " + e.message);
    } finally {
        setIsSimulating(false);
    }
  };

  const categories = {
    'Survey': [
      { label: 'Survey', icon: <ClipboardList size={18} /> }
    ],
    'Marketing Content': [
      { label: 'Article', icon: <Edit3 size={18} /> },
      { label: 'Website Link', icon: <Layout size={18} /> },
      { label: 'Advertisement', icon: <Megaphone size={18} /> }
    ],
    'Social Media Posts': [
      { label: 'LinkedIn Post', icon: <Linkedin size={18} /> },
      { label: 'Instagram Post', icon: <Instagram size={18} /> },
      { label: 'X Post', icon: <X size={18} /> },
      { label: 'TikTok Script', icon: <Video size={18} /> }
    ],
    'Communication': [
      { label: 'Email Subject Line', icon: <Mail size={18} /> },
      { label: 'Email', icon: <Mail size={18} /> }
    ],
    'Product': [
      { label: 'Product Proposition', icon: <Lightbulb size={18} /> }
    ]
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] text-white flex flex-col animate-in fade-in duration-300 overflow-hidden">
      
      {/* Header / Nav */}
      <div className="flex items-center justify-between px-6 py-4 md:px-8 md:py-6 border-b border-gray-800/50 bg-[#050505] z-10 relative">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-lg text-white font-bold">Λ</div>
            <h2 className="text-xl font-medium tracking-tight">New Simulation</h2>
         </div>
         <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 text-gray-500 hover:text-white hover:bg-gray-900 rounded-full transition-colors">
                <X size={24} />
            </button>
         </div>
      </div>

      {/* Notification Banner */}
      {showNotification && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-lg animate-in slide-in-from-top-4 fade-in duration-500">
            <div className="bg-[#0f1f15] backdrop-blur-xl border border-green-500/20 text-green-100 px-6 py-5 rounded-2xl shadow-2xl flex items-start gap-4 ring-1 ring-green-500/10">
              {/* Eliminated service alert signal */}
              <div className="flex-1">
                <h4 className="font-semibold text-green-300 mb-1">Simulation Status</h4>
                <p className="text-sm text-green-200/70 leading-relaxed">
                  Please wait, the results will show here. The simulation process can take up to <strong className="text-white">30 minutes</strong>. Click "Gather Results" to fetch the latest state.
                </p>
                {simulationResult && (
                  <div className="mt-4 p-3 bg-black/40 rounded-xl border border-green-500/20 text-xs text-green-200 flex flex-col gap-3">
                    <div className="font-medium flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${simulationResult.status === 'Error' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                        {simulationResult.message}
                    </div>
                    {simulationResult.data && (
                        <pre className="text-[10px] bg-black/50 p-2 rounded max-h-32 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                            {JSON.stringify(simulationResult.data, null, 2)}
                        </pre>
                    )}
                    <button
                      onClick={handleRefresh}
                      disabled={isSimulating}
                      className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/40 rounded-lg self-end transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={isSimulating ? "animate-spin" : ""} />
                      Gather Results
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setShowNotification(false)} className="text-green-400 hover:text-white ml-auto p-1">
                <X size={16} />
              </button>
            </div>
        </div>
      )}

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
        <div className="max-w-5xl mx-auto pb-20">
          <h1 className="text-2xl md:text-3xl font-semibold text-center mb-12 mt-4 md:mt-8">What would you like to simulate?</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
             {/* Column 1 */}
             <div className="space-y-12">
               <CategoryCard title="Survey" options={categories['Survey']} selectedVariation={selectedVariation} onSelect={setSelectedVariation} />
               <CategoryCard title="Marketing Content" options={categories['Marketing Content']} selectedVariation={selectedVariation} onSelect={setSelectedVariation} />
             </div>

             {/* Column 2 */}
             <div className="space-y-12">
               <CategoryCard title="Social Media Posts" options={categories['Social Media Posts']} selectedVariation={selectedVariation} onSelect={setSelectedVariation} />
             </div>

             {/* Column 3 */}
             <div className="space-y-12">
                <CategoryCard title="Communication" options={categories['Communication']} selectedVariation={selectedVariation} onSelect={setSelectedVariation} />
                <CategoryCard title="Product" options={categories['Product']} selectedVariation={selectedVariation} onSelect={setSelectedVariation} />
             </div>
          </div>

          <div className="flex justify-center mt-16 mb-8">
             <button
               onClick={() => setShowContextModal(true)}
               className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors text-sm px-4 py-2 hover:bg-gray-900 rounded-lg"
             >
                <Plus size={16} />
                Request a new context
             </button>
          </div>
        </div>
      </div>

      {/* Context Modal */}
      {showContextModal && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Request New Context</h3>
              <button onClick={() => setShowContextModal(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium">New Context / Fuse Box</label>
                <textarea
                  value={contextInput}
                  onChange={(e) => setContextInput(e.target.value)}
                  className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-teal-500 outline-none h-40 resize-none"
                  placeholder="Specify the testing environment or scenario..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => setShowContextModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-800 text-sm font-medium hover:bg-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/save-data', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'context-request',
                        data: { context: contextInput },
                        user: 'chat-user'
                      })
                    });
                    if (response.ok) {
                      alert('Context request saved!');
                      setShowContextModal(false);
                      setContextInput('');
                    }
                  } catch (e) {
                    console.error(e);
                    alert('Successfully submitted (Local simulation)');
                    setShowContextModal(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-500 transition-colors shadow-lg shadow-teal-900/20"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Footer */}
      <ChatInput onSimulate={handleSimulate} onHelpMeCraft={handleHelpMeCraft} isSimulating={isSimulating} />
    </div>
  );
};

export default ChatPage;
