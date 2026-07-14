import React, { useState, useEffect } from 'react';
import { Users, Plus, Save, Trash, AlertCircle, Sparkles, Sliders, MapPin, Briefcase, Heart } from 'lucide-react';

interface FocusGroup {
  id: string;
  name: string;
  customerProfile: string;
  companyInfo: string;
  personaScale: number;
  demographics: {
    country: string;
    jobTitle: string;
    sentiment: string;
    activityLevel: string;
  };
}

const INITIAL_GROUPS: FocusGroup[] = [
  {
    id: '1',
    name: 'Sustainable Tech Advocates',
    customerProfile: 'Environmentally conscious tech enthusiasts aged 25-40.',
    companyInfo: 'A solar-powered IoT appliance manufacturer.',
    personaScale: 85,
    demographics: {
      country: 'United States',
      jobTitle: 'Product Manager',
      sentiment: 'Positive',
      activityLevel: 'Power User'
    }
  },
  {
    id: '2',
    name: 'Frugal SaaS Founders',
    customerProfile: 'Indie hackers looking for cheap API integrations.',
    companyInfo: 'A pay-as-you-go visual database service.',
    personaScale: 30,
    demographics: {
      country: 'Netherlands',
      jobTitle: 'Founder',
      sentiment: 'Neutral',
      activityLevel: 'Daily Active'
    }
  }
];

const PersonaBuilderTab: React.FC = () => {
  const [groups, setGroups] = useState<FocusGroup[]>([]);
  const [name, setName] = useState('');
  const [customerProfile, setCustomerProfile] = useState('');
  const [companyInfo, setCompanyInfo] = useState('');
  const [personaScale, setPersonaScale] = useState(50);
  const [country, setCountry] = useState('United States');
  const [jobTitle, setJobTitle] = useState('Founder');
  const [sentiment, setSentiment] = useState('Positive');
  const [activityLevel, setActivityLevel] = useState('Daily Active');

  const [selectedGroup, setSelectedGroup] = useState<FocusGroup | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const loaded = localStorage.getItem('focus_groups');
    if (loaded) {
      try {
        setGroups(JSON.parse(loaded));
      } catch (e) {
        setGroups(INITIAL_GROUPS);
      }
    } else {
      setGroups(INITIAL_GROUPS);
      localStorage.setItem('focus_groups', JSON.stringify(INITIAL_GROUPS));
    }
  }, []);

  const saveGroups = (updated: FocusGroup[]) => {
    setGroups(updated);
    localStorage.setItem('focus_groups', JSON.stringify(updated));
  };

  const handleCreate = () => {
    if (!name.trim() || !customerProfile.trim()) {
      alert('Focus Group Name and Customer Profile are required.');
      return;
    }

    setIsGenerating(true);
    // Simulate API logic
    setTimeout(() => {
      const newGroup: FocusGroup = {
        id: Date.now().toString(),
        name,
        customerProfile,
        companyInfo,
        personaScale,
        demographics: {
          country,
          jobTitle,
          sentiment,
          activityLevel
        }
      };
      const updated = [newGroup, ...groups];
      saveGroups(updated);
      setSelectedGroup(newGroup);

      // Clear form
      setName('');
      setCustomerProfile('');
      setCompanyInfo('');
      setPersonaScale(50);
      setIsGenerating(false);
      alert('Focus Group assembled and saved to persistent database!');
    }, 1200);
  };

  const handleDelete = (id: string) => {
    const updated = groups.filter(g => g.id !== id);
    saveGroups(updated);
    if (selectedGroup?.id === id) {
      setSelectedGroup(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 text-white grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* List of focus groups */}
      <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 h-fit space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-teal-400" size={20} />
            <h2 className="font-bold text-base">Focus Groups</h2>
          </div>
          <span className="text-xs bg-gray-900 border border-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
            {groups.length} Groups
          </span>
        </div>

        <div className="space-y-2">
          {groups.map((group) => (
            <div
              key={group.id}
              onClick={() => setSelectedGroup(group)}
              className={`p-4 rounded-xl cursor-pointer border transition-all flex justify-between items-start ${
                selectedGroup?.id === group.id
                  ? 'bg-teal-900/10 border-teal-500/50 text-white'
                  : 'bg-black/40 border-gray-900 hover:border-gray-800 text-gray-300'
              }`}
            >
              <div className="space-y-1 max-w-[80%]">
                <h4 className="font-semibold text-sm truncate">{group.name}</h4>
                <p className="text-xs text-gray-500 truncate">{group.customerProfile}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(group.id);
                }}
                className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-gray-900"
              >
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-blue-950/20 border border-blue-500/10 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
            <AlertCircle size={14} />
            <span>Feeds Simulation Engine</span>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Assembled groups are immediately accessible from Tab 2 (Simulation Dashboard) and Tab 3 (Content Chat) to run full interactive campaign trials.
          </p>
        </div>
      </div>

      {/* Builder Form */}
      <div className="lg:col-span-2 bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 space-y-6">
        <div className="border-b border-gray-800 pb-4">
          <h2 className="font-bold text-lg">Assemble Focus Group</h2>
          <p className="text-xs text-gray-400">Configure parameters to generate a synthetic user base.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm focus:border-teal-500 outline-none text-white"
              placeholder="e.g. Fintech Power Users"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Persona Scale</label>
            <div className="flex items-center gap-4 bg-black border border-gray-800 rounded-xl px-4 py-2">
              <Sliders size={16} className="text-teal-400" />
              <input
                type="range"
                min="0"
                max="100"
                value={personaScale}
                onChange={(e) => setPersonaScale(Number(e.target.value))}
                className="w-full accent-teal-500"
              />
              <span className="text-xs font-mono font-bold text-teal-400 w-8 text-right">{personaScale}</span>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Customer Profile / Persona Mandate</label>
            <textarea
              value={customerProfile}
              onChange={(e) => setCustomerProfile(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm focus:border-teal-500 outline-none h-24 resize-none text-white"
              placeholder="Describe your ideal demographics, core pain points, and product usage behaviors..."
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Company Information / Brand Guidelines</label>
            <textarea
              value={companyInfo}
              onChange={(e) => setCompanyInfo(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm focus:border-teal-500 outline-none h-24 resize-none text-white"
              placeholder="Define product details, brand voice, core features, or competitive positioning..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Primary Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm focus:border-teal-500 outline-none text-white"
            >
              <option>United States</option>
              <option>United Kingdom</option>
              <option>Netherlands</option>
              <option>France</option>
              <option>India</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Default Job Title</label>
            <select
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm focus:border-teal-500 outline-none text-white"
            >
              <option>Founder</option>
              <option>Product Manager</option>
              <option>Engineer</option>
              <option>Investor</option>
              <option>Designer</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-800/60">
          <button
            onClick={handleCreate}
            disabled={isGenerating}
            className="px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-teal-900/20 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Sparkles className="animate-spin" size={14} />
                Generating Synthetic Personas...
              </>
            ) : (
              <>
                <Save size={14} />
                Assemble Group
              </>
            )}
          </button>
        </div>

        {/* Selected group detail view */}
        {selectedGroup && (
          <div className="bg-black/50 border border-gray-900 rounded-xl p-5 space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center border-b border-gray-900 pb-2">
              <h3 className="font-bold text-sm text-teal-400">{selectedGroup.name} Details</h3>
              <span className="text-[10px] bg-teal-500/10 text-teal-400 px-2.5 py-0.5 rounded-full font-bold">
                Persona Scale {selectedGroup.personaScale}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-gray-500">Country</span>
                <p className="text-gray-300 font-medium flex items-center gap-1"><MapPin size={12} /> {selectedGroup.demographics.country}</p>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">Job Title</span>
                <p className="text-gray-300 font-medium flex items-center gap-1"><Briefcase size={12} /> {selectedGroup.demographics.jobTitle}</p>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">Sentiment</span>
                <p className="text-gray-300 font-medium flex items-center gap-1"><Heart size={12} /> {selectedGroup.demographics.sentiment}</p>
              </div>
              <div className="space-y-1">
                <span className="text-gray-500">Activity Level</span>
                <p className="text-gray-300 font-medium">{selectedGroup.demographics.activityLevel}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonaBuilderTab;