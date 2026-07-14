import React, { useState } from 'react';
import { Users, Plus, UserPlus, Shield, Sparkles, Smile, MessageSquare, Trash2, CheckCircle } from 'lucide-react';

interface Persona {
  id: string;
  name: string;
  role: string;
  country: string;
  sentiment: string;
  activity: string;
  bio: string;
}

const INITIAL_PERSONAS: Persona[] = [
  { id: '1', name: 'Alex Rivera', role: 'Founder', country: 'United States', sentiment: 'Positive', activity: 'Power User', bio: 'Tech optimist, looks for radical transparency and scalability in developer tooling.' },
  { id: '2', name: 'Siddharth Mehta', role: 'Engineer', country: 'India', sentiment: 'Mixed', activity: 'Daily Active', bio: 'Pragmatic system architect, highly critical of greenwashing or fluffy marketing.' },
  { id: '3', name: 'Emma de Jong', role: 'Designer', country: 'Netherlands', sentiment: 'Neutral', activity: 'Weekly Active', bio: 'UI enthusiast, cares deeply about seamless UX flows and authentic brand aesthetics.' }
];

export default function PersonaBuilder() {
  const [personas, setPersonas] = useState<Persona[]>(INITIAL_PERSONAS);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Product Manager');
  const [country, setCountry] = useState('United States');
  const [sentiment, setSentiment] = useState('Neutral');
  const [activity, setActivity] = useState('Daily Active');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleAddPersona = () => {
    if (!name.trim()) return;
    const newPersona: Persona = {
      id: Date.now().toString(),
      name,
      role,
      country,
      sentiment,
      activity,
      bio: bio.trim() || 'A custom constructed focus group persona.'
    };
    setPersonas([newPersona, ...personas]);
    setName('');
    setBio('');
  };

  const handleDeletePersona = (id: string) => {
    setPersonas(personas.filter(p => p.id !== id));
  };

  const handleSaveToGroup = async () => {
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      const response = await fetch('/api/save-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'focus_group',
          data: { personas },
          user: 'developer'
        })
      });
      if (response.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-black text-white min-h-screen p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Users className="text-teal-400 w-8 h-8" />
            <h1 className="text-3xl font-bold tracking-tight">Persona & Focus Group Builder</h1>
          </div>
          <p className="text-gray-400 max-w-3xl">
            Design diverse buyer personas and configure highly tailored focus groups. These personas automatically seed the simulation dashboard and are used for content validation tests.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Creator panel */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4 h-fit">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <UserPlus className="text-teal-400 w-5 h-5" /> Construct New Persona
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium uppercase">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Liam Sterling"
                className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-teal-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium uppercase">Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-teal-500 outline-none"
                >
                  <option>Founder</option>
                  <option>Product Manager</option>
                  <option>Engineer</option>
                  <option>Investor</option>
                  <option>Designer</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium uppercase">Country</label>
                <select
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-teal-500 outline-none"
                >
                  <option>United States</option>
                  <option>United Kingdom</option>
                  <option>Netherlands</option>
                  <option>France</option>
                  <option>India</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium uppercase">Initial Sentiment</label>
                <select
                  value={sentiment}
                  onChange={e => setSentiment(e.target.value)}
                  className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-teal-500 outline-none"
                >
                  <option>Positive</option>
                  <option>Neutral</option>
                  <option>Mixed</option>
                  <option>Negative</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium uppercase">Activity Level</label>
                <select
                  value={activity}
                  onChange={e => setActivity(e.target.value)}
                  className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-teal-500 outline-none"
                >
                  <option>Power User</option>
                  <option>Daily Active</option>
                  <option>Weekly Active</option>
                  <option>Lurker</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium uppercase">Psychographic Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="What drives this person? What values, skepticisms, and habits do they have?"
                className="w-full h-24 bg-black border border-gray-800 rounded-lg p-3 text-sm focus:border-teal-500 outline-none resize-none"
              />
            </div>

            <button
              onClick={handleAddPersona}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Add to Focus Group
            </button>
          </div>

          {/* Group display */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center bg-gray-900/30 border border-gray-800/80 rounded-xl px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold">Active Focus Group List</h3>
                <p className="text-xs text-gray-500">Currently configured group size: {personas.length} personas</p>
              </div>
              <button
                onClick={handleSaveToGroup}
                disabled={isSaving || personas.length === 0}
                className="px-4 py-2 bg-white text-black hover:bg-gray-200 disabled:opacity-50 font-semibold text-sm rounded-xl transition-all flex items-center gap-2"
              >
                {isSaving ? 'Saving...' : 'Deploy focus group'}
                {savedSuccess && <CheckCircle size={14} className="text-green-600" />}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {personas.map((persona) => (
                <div key={persona.id} className="bg-gray-950 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-base text-gray-100">{persona.name}</h4>
                        <span className="text-xs text-teal-400 font-mono">{persona.role} ({persona.country})</span>
                      </div>
                      <button
                        onClick={() => handleDeletePersona(persona.id)}
                        className="text-gray-500 hover:text-red-400 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed italic mt-3">"{persona.bio}"</p>
                  </div>

                  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-900/50">
                    <span className="text-[10px] bg-teal-950/40 border border-teal-800/30 text-teal-300 px-2 py-0.5 rounded-full font-semibold">
                      {persona.sentiment} Sentiment
                    </span>
                    <span className="text-[10px] bg-gray-900 border border-gray-800 text-gray-300 px-2 py-0.5 rounded-full font-semibold">
                      {persona.activity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
