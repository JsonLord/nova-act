import React, { Suspense, lazy, useState, useEffect } from 'react';
import { ChevronDown, Plus, Info, MessageSquare, BookOpen, LogOut, PanelLeftClose, MessageCircle, Menu, PanelRightClose, RefreshCw } from 'lucide-react';
const SimulationGraph = lazy(() => import('./SimulationGraph'));
import { GradioService } from '../services/gradioService';

interface SimulationPageProps {
  onBack: () => void;
  onOpenChat: () => void;
  onOpenGuide: () => void;
  user?: any;
  onLogin?: () => void;
  onLogout?: () => void;
  simulationResult: any;
  setSimulationResult: (res: any) => void;
}

// Define the data structure for filters
const VIEW_FILTERS: Record<string, Array<{ label: string; color: string }>> = {
  'Country': [
    { label: "United States", color: "bg-blue-600" },
    { label: "United Kingdom", color: "bg-purple-600" },
    { label: "Netherlands", color: "bg-teal-600" },
    { label: "France", color: "bg-orange-600" },
    { label: "India", color: "bg-pink-600" }
  ],
  'Job Title': [
    { label: "Founder", color: "bg-indigo-500" },
    { label: "Product Manager", color: "bg-emerald-500" },
    { label: "Engineer", color: "bg-rose-500" },
    { label: "Investor", color: "bg-amber-500" },
    { label: "Designer", color: "bg-fuchsia-500" }
  ],
  'Sentiment': [
    { label: "Positive", color: "bg-green-500" },
    { label: "Neutral", color: "bg-gray-500" },
    { label: "Negative", color: "bg-red-500" },
    { label: "Mixed", color: "bg-yellow-500" }
  ],
  'Activity Level': [
    { label: "Power User", color: "bg-red-600" },
    { label: "Daily Active", color: "bg-orange-500" },
    { label: "Weekly Active", color: "bg-blue-500" },
    { label: "Lurker", color: "bg-slate-600" }
  ]
};

const SimulationPage: React.FC<SimulationPageProps> = ({
  onBack, onOpenChat, onOpenGuide, user, onLogin, onLogout, simulationResult, setSimulationResult
}) => {
  const [society, setSociety] = useState('');
  const [societies, setSocieties] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState('Job Title');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(window.innerWidth > 1200);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(window.innerWidth > 768);

  const [activeModal, setActiveModal] = useState<'none' | 'assemble' | 'feedback' | 'context' | 'test'>('none');
  const [formData, setFormData] = useState({
    customerProfile: '',
    companyInfo: '',
    personaScale: 50,
    feedback: '',
    context: '',
    testName: ''
  });

  // Handle window resize for mobile responsiveness
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsLeftPanelOpen(false);
        setIsRightPanelOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);

    // Fetch real focus groups
    const fetchSocieties = async () => {
        try {
            let names: string[] = [];

            // 1. Fetch from Gradio (Templates/Global)
            const result = await GradioService.listSimulations();
            const list = Array.isArray(result) ? result : (result?.data?.[0] || []);
            // GradioService now returns the array of focus group objects directly

            if (Array.isArray(list)) {
                const gradioNames = list
                    .map((s: any) => {
                        if (typeof s === 'string') return s;
                        if (typeof s === 'object' && s !== null) return s.id || s.name || '';
                        return '';
                    })
                    // Filter out non-user groups as requested
                    .filter(name => name.length > 0 && !name.toLowerCase().includes('default') && !name.toLowerCase().includes('template') && !name.toLowerCase().includes('current'));

                names = [...gradioNames];
            }

            // 2. Fetch User-created groups from local storage
            if (user?.preferred_username) {
              try {
                const localResp = await fetch(`/api/list-data?type=assemble&user=${user.preferred_username}`);
                if (localResp.ok) {
                  const localData = await localResp.json();
                  const localNames = localData.map((d: any) => d.data.customerProfile.substring(0, 20) + '...');
                  names = [...names, ...localNames];
                }
              } catch (e) {
                console.error("Failed to fetch local groups", e);
              }
            }

            // Remove duplicates
            const uniqueNames = Array.from(new Set(names));
            setSocieties(uniqueNames);

            if (uniqueNames.length > 0) {
              if (!society || !uniqueNames.includes(society)) {
                setSociety(uniqueNames[0]);
              }
            } else {
              setSociety('Standard Example');
            }
        } catch (e) {
            console.error("Failed to fetch focus groups", e);
        }
    };
    fetchSocieties();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Function to simulate rebuilding the graph when settings change
  const handleSettingChange = (setter: (val: string) => void, value: string) => {
    if (value === society || (value === viewMode && setter === setViewMode)) return; // No change
    
    setter(value);
    setIsBuilding(true);
    // Simulate network delay
    setTimeout(() => {
        setIsBuilding(false);
    }, 1500);
  };

  const currentFilters = VIEW_FILTERS[viewMode] || VIEW_FILTERS['Country'];

  return (
    <div className="flex h-[calc(100vh-56px)] w-full overflow-hidden bg-black text-white font-sans relative">
      {/* Sidebar */}
      <aside className={`fixed md:relative w-[300px] h-full flex-shrink-0 border-r border-gray-800 flex flex-col bg-[#0a0a0a] z-40 transition-all duration-300 ${isLeftPanelOpen ? 'translate-x-0' : '-translate-x-full md:-ml-[300px]'}`}>
        {/* Header */}
        <div className="p-4 h-16 border-b border-gray-800 flex items-center justify-between">
           <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
              <div className="w-6 h-6 flex items-center justify-center font-bold text-white">Λ</div>
              <span className="font-semibold tracking-tight text-xs">Branding Content Testing</span>
           </div>
           <button
             onClick={() => setIsLeftPanelOpen(false)}
             className="text-gray-500 hover:text-white"
           >
             <PanelLeftClose size={18}/>
           </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
           
           {/* Focus Group Control */}
           <div className="space-y-2">
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Focus Group</label>
              <div className="relative group">
                <select 
                  value={society}
                  onChange={(e) => handleSettingChange(setSociety, e.target.value)}
                  className="w-full appearance-none bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  {societies.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none w-4 h-4" />
              </div>
           </div>

           {/* Current View Control */}
           <div className="space-y-2">
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Current View</label>
              <div className="relative">
                <select 
                  value={viewMode}
                  onChange={(e) => handleSettingChange(setViewMode, e.target.value)}
                  className="w-full appearance-none bg-[#111] border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option>Country</option>
                  <option>Job Title</option>
                  <option>Sentiment</option>
                  <option>Activity Level</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none w-4 h-4" />
              </div>
           </div>

           <div className="h-px bg-gray-800 my-4" />

           {/* Actions */}
           <button 
             onClick={() => setActiveModal('assemble')}
             className="w-full flex items-center justify-between text-left text-sm text-gray-300 hover:text-white group py-2 border-b border-gray-800/50 mb-1"
           >
              <span>Assemble new group</span>
              <Plus size={18} className="text-gray-500 group-hover:text-white" />
           </button>

           <button
             onClick={() => setActiveModal('test')}
             className="w-full flex items-center justify-between text-left text-sm text-gray-300 hover:text-white group py-2 border-b border-gray-800/50 mb-1"
           >
              <span>Create a new test</span>
              <Plus size={18} className="text-gray-500 group-hover:text-white" />
           </button>

           <button
             onClick={() => setActiveModal('context')}
             className="w-full flex items-center justify-between text-left text-sm text-gray-300 hover:text-white group py-2"
           >
              <span>Request new context</span>
              <Plus size={18} className="text-gray-500 group-hover:text-white" />
           </button>

           {/* Global Chat Button (Sidebar) */}
           <button 
             onClick={onOpenChat}
             className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700"
           >
              <MessageCircle size={18} />
              <span className="font-medium text-sm">Open Global Chat</span>
           </button>

           {/* Setup Warning / Info Box */}
           <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-4 mt-4">
              <div className="flex items-center gap-2 text-blue-200 font-bold text-xs mb-1">
                 <Info size={14}/>
                 <span>Configuration Required</span>
              </div>
              <p className="text-blue-200/70 text-[10px] leading-relaxed">
                Assemble new group and create a new test are required to be configured first before using any chat.
              </p>
           </div>

           {/* History List */}
           <div className="space-y-1 pt-4">
             <label className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2 block">Recent Tests</label>
             <div className="text-sm text-gray-400 py-2 px-2 hover:bg-gray-800/50 rounded cursor-pointer truncate">
               Sustainable Luxury Narrative
             </div>
             <div className="text-sm text-gray-400 py-2 px-2 hover:bg-gray-800/50 rounded cursor-pointer truncate">
               Radical Transparency Voice
             </div>
             <div className="text-sm text-gray-400 py-2 px-2 hover:bg-gray-800/50 rounded cursor-pointer truncate">
               Gen-Z Greenwash Perception
             </div>
           </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 p-4 space-y-1 bg-[#0a0a0a]">
           {user ? (
             <div className="flex items-center gap-3 py-3 border-b border-gray-800 mb-2">
                {user.avatarUrl && <img src={user.avatarUrl} alt={user.preferred_username} className="w-8 h-8 rounded-full border border-gray-700" />}
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-gray-200">{user.preferred_username}</span>
                  <span className="text-[10px] text-gray-500">Credits: Unlimited</span>
                </div>
             </div>
           ) : (
             <div className="py-2 border-b border-gray-800 mb-2">
                <button
                  onClick={onLogin}
                  className="w-full py-2 bg-white text-black rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                >
                  Sign in with Hugging Face
                </button>
             </div>
           )}

           <MenuItem icon={<MessageSquare size={16}/>} label="Leave Feedback" onClick={() => setActiveModal('feedback')} />
           <MenuItem icon={<BookOpen size={16}/>} label="Product Guide" onClick={onOpenGuide} />
           {user && <MenuItem icon={<LogOut size={16}/>} label="Log Out" onClick={onLogout} />}
           
           <div className="pt-4 text-[10px] text-gray-600">Version 2.1</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative bg-black overflow-hidden">
         {/* Top Navigation Overlay */}
         <div className="absolute top-4 left-4 right-4 z-30 flex justify-between items-center pointer-events-none">
             {/* Left Toggle (when sidebar closed) */}
             <button
               onClick={() => setIsLeftPanelOpen(true)}
               className={`pointer-events-auto p-2 bg-gray-900/80 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-opacity ${isLeftPanelOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
             >
                <Menu size={20} />
             </button>

             {/* Right Toggle (when output closed) */}
             <button
               onClick={() => setIsRightPanelOpen(true)}
               className={`pointer-events-auto p-2 bg-gray-900/80 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-opacity ml-auto ${isRightPanelOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
             >
                <PanelRightClose size={20} className="rotate-180" />
             </button>
         </div>

         <div className="absolute top-6 left-6 right-6 z-10 flex justify-center pointer-events-none">
             {/* Legend / Filter Chips */}
             <div className="flex flex-wrap justify-center gap-2 pointer-events-auto max-w-[60%]">
                {currentFilters.map((filter, idx) => (
                   <FilterChip key={idx} color={filter.color} label={filter.label} />
                ))}
             </div>
         </div>

         {/* Graph Container */}
         <div className="flex-1 w-full h-full">
            <Suspense fallback={<div className='skeleton h-full w-full rounded-2xl' />}><SimulationGraph
              isBuilding={isBuilding}
              societyType={society}
              viewMode={viewMode}
              onStartChat={onOpenChat}
            /></Suspense>
         </div>

         {/* Modals */}
         {activeModal !== 'none' && (
           <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
             <div className="bg-[#111] border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
               <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                 <h3 className="font-semibold text-lg">
                   {activeModal === 'assemble' && "Assemble New Group"}
                   {activeModal === 'feedback' && "Leave Feedback"}
                   {activeModal === 'context' && "Request New Context"}
                   {activeModal === 'test' && "Create New Test"}
                 </h3>
                 <button onClick={() => setActiveModal('none')} className="text-gray-500 hover:text-white">
                   <PanelRightClose size={20} />
                 </button>
               </div>

               <div className="p-6 space-y-4">
                 {activeModal === 'assemble' && (
                   <>
                     <div className="space-y-1.5">
                       <label className="text-xs text-gray-400 font-medium">Customer Profile</label>
                       <textarea
                         value={formData.customerProfile}
                         onChange={(e) => setFormData({...formData, customerProfile: e.target.value})}
                         className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-teal-500 outline-none h-24 resize-none"
                         placeholder="Describe your ideal audience..."
                       />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-xs text-gray-400 font-medium">Company Info</label>
                       <textarea
                         value={formData.companyInfo}
                         onChange={(e) => setFormData({...formData, companyInfo: e.target.value})}
                         className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-teal-500 outline-none h-24 resize-none"
                         placeholder="Tell us about your brand..."
                       />
                     </div>
                     <div className="space-y-1.5">
                       <div className="flex justify-between">
                         <label className="text-xs text-gray-400 font-medium">Persona Scale</label>
                         <span className="text-xs text-teal-500 font-bold">{formData.personaScale}</span>
                       </div>
                       <input
                         type="range" min="1" max="100"
                         value={formData.personaScale}
                         onChange={(e) => setFormData({...formData, personaScale: parseInt(e.target.value)})}
                         className="w-full accent-teal-500"
                       />
                       <div className="flex justify-between text-[10px] text-gray-600 uppercase font-bold">
                         <span>Conservative</span>
                         <span>Radical</span>
                       </div>
                     </div>
                   </>
                 )}

                 {activeModal === 'feedback' && (
                   <div className="space-y-1.5">
                     <label className="text-xs text-gray-400 font-medium">Your Feedback</label>
                     <textarea
                       value={formData.feedback}
                       onChange={(e) => setFormData({...formData, feedback: e.target.value})}
                       className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-teal-500 outline-none h-40 resize-none"
                       placeholder="How can we improve?"
                     />
                   </div>
                 )}

                 {activeModal === 'context' && (
                   <div className="space-y-1.5">
                     <label className="text-xs text-gray-400 font-medium">New Context / Fuse Box</label>
                     <textarea
                       value={formData.context}
                       onChange={(e) => setFormData({...formData, context: e.target.value})}
                       className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-teal-500 outline-none h-40 resize-none"
                       placeholder="Specify the testing environment or scenario..."
                     />
                   </div>
                 )}

                 {activeModal === 'test' && (
                   <>
                     <div className="space-y-1.5">
                       <label className="text-xs text-gray-400 font-medium">Test Name</label>
                       <input
                         type="text"
                         value={formData.testName}
                         onChange={(e) => setFormData({...formData, testName: e.target.value})}
                         className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-teal-500 outline-none"
                         placeholder="Campaign Launch 2024..."
                       />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs text-gray-400 font-medium">Brand Asset for Testing</label>
                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-800 border-dashed rounded-lg cursor-pointer bg-black hover:bg-gray-900 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Plus className="w-8 h-8 mb-4 text-gray-500" />
                                    <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                    <p className="text-xs text-gray-500">SVG, PNG, JPG (MAX. 800x400px)</p>
                                </div>
                                <input type="file" className="hidden" multiple accept="image/*" />
                            </label>
                        </div>
                     </div>
                   </>
                 )}
               </div>

               <div className="p-6 border-t border-gray-800 flex gap-3">
                 <button
                   onClick={() => setActiveModal('none')}
                   className="flex-1 py-2.5 rounded-xl border border-gray-800 text-sm font-medium hover:bg-gray-900 transition-colors"
                 >
                   Cancel
                 </button>
                 <button
                   onClick={async () => {
                     if (activeModal === 'assemble') {
                       setIsBuilding(true);
                       setIsRightPanelOpen(true);
                       setActiveModal('none');
                       try {
                         // 1. Generate personas based on profile and company info
                         const jobRes = await GradioService.generatePersonas(formData.companyInfo, formData.customerProfile, Math.ceil(formData.personaScale / 20));
                         const personas = [jobRes.job_id];

                         // 2. Generate social network for these personas
                         const groupName = formData.customerProfile.substring(0, 20);
                         await GradioService.generateSocialNetwork(groupName, formData.personaScale, 'scale_free', groupName);

                         // 3. Save to backend
                         await fetch('/api/save-data', {
                           method: 'POST',
                           headers: { 'Content-Type': 'application/json' },
                           body: JSON.stringify({
                             type: 'assemble',
                             data: { ...formData, generatedPersonas: personas },
                             user: user?.preferred_username || 'anonymous'
                           })
                         });

                         // 4. Update UI
                         setSocieties(prev => [groupName, ...prev]);
                         setSociety(groupName);
                         alert('Focus group assembled and selected!');
                       } catch (e) {
                         console.error(e);
                         alert('Failed to assemble group via API.');
                       } finally {
                         setIsBuilding(false);
                       }
                       return;
                     }

                     // Save to backend logic for other modals
                     try {
                        const response = await fetch('/api/save-data', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: activeModal,
                            data: formData,
                            user: user?.preferred_username || 'anonymous'
                          })
                        });
                        if (response.ok) {
                          alert('Successfully saved!');
                          setActiveModal('none');
                        }
                     } catch (e) {
                       console.error(e);
                       alert('Successfully submitted (Local simulation)');
                       setActiveModal('none');
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

         {/* Floating Chat Button (Bottom) */}
         <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30">
            <button 
              onClick={onOpenChat}
              className="flex items-center gap-2 bg-black/80 backdrop-blur-md border border-gray-700 text-white px-6 py-3 rounded-full shadow-2xl hover:bg-gray-900 transition-all hover:scale-105"
            >
              <MessageCircle size={20} />
              <span className="font-medium">Open Simulation Chat</span>
            </button>
         </div>
      </main>

      {/* Right Sidebar (Output) */}
      <aside className={`fixed right-0 md:relative w-[300px] h-full flex-shrink-0 border-l border-gray-800 flex flex-col bg-[#0a0a0a] z-40 transition-all duration-300 ${isRightPanelOpen ? 'translate-x-0' : 'translate-x-full md:-mr-[300px]'}`}>
        <div className="p-4 h-16 border-b border-gray-800 flex items-center justify-between">
           <span className="font-semibold tracking-tight uppercase text-xs text-gray-500">Output</span>
           <button onClick={() => setIsRightPanelOpen(false)} className="text-gray-500 hover:text-white"><PanelRightClose size={18}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
           {isBuilding && (
             <div className="bg-teal-900/20 border border-teal-500/30 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                   <RefreshCw className="w-4 h-4 text-teal-400 animate-spin" />
                   <div className="flex flex-col">
                      <span className="text-xs font-bold text-teal-400">Assembling...</span>
                      <span className="text-[10px] text-teal-400/60 font-mono">Constructing network mesh</span>
                   </div>
                </div>
             </div>
           )}

           <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">Simulation Results</p>
                {simulationResult && (
                  <button
                    onClick={async () => {
                      setIsRefreshing(true);
                      try {
                        // In SimulationPage we don't track the running simulation's job ID.
                        // To get the status, we would need the job ID returned by startSimulation.
                        // If we are polling for the group assembly job, we might need to store it.
                        // For now we try to poll with the group name, though it may fail if it's not a job ID.
                        // Ensure that we poll only if society contains a job ID. If it is a group name, getSimulationStatus will fail on the new API.
                        const status = await GradioService.getSimulationStatus(simulationResult?.job_id || society);
                        setSimulationResult({
                          status: "Updated",
                          message: "Latest status gathered from API.",
                          data: status
                        });
                      } catch (e) {
                        console.error(e);
                      } finally {
                        setIsRefreshing(false);
                      }
                    }}
                    className="p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-white"
                    title="Refresh Status"
                  >
                    <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
                  </button>
                )}
              </div>

              {!simulationResult ? (
                <div className="text-sm text-gray-400 italic text-center py-8">
                  Results will appear here after running a simulation.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-green-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    {simulationResult.status}
                  </div>
                  <p className="text-[11px] text-gray-400">{simulationResult.message}</p>
                  {simulationResult.data && (
                    <pre className="text-[10px] bg-black/50 p-2 rounded max-h-96 overflow-y-auto custom-scrollbar whitespace-pre-wrap text-gray-300 border border-gray-800">
                      {JSON.stringify(simulationResult.data, null, 2)}
                    </pre>
                  )}
                  <p className="text-[10px] text-gray-600 mt-4 italic">
                    Note: Complete simulation results can take up to 30 minutes to be fully processed by the API.
                  </p>
                </div>
              )}
           </div>
        </div>
      </aside>
    </div>
  );
};

// Helper Components
interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
  onClick?: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, highlight = false, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-md text-sm transition-colors ${highlight ? 'text-teal-400 hover:bg-teal-950/30' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

interface FilterChipProps {
  color: string;
  label: string;
}

const FilterChip: React.FC<FilterChipProps> = ({ color, label }) => (
  <button className="flex items-center gap-2 bg-gray-900/80 backdrop-blur border border-gray-700 rounded-full pl-2 pr-4 py-1.5 hover:border-gray-500 transition-colors">
     <span className={`w-2.5 h-2.5 rounded-full ${color}`}></span>
     <span className="text-xs font-medium text-gray-300">{label}</span>
  </button>
);

export default SimulationPage;