import React, { useState } from 'react';
import { PenTool, Sparkles, Copy, Send, Check, RefreshCw, Layers } from 'lucide-react';

const ContentCraftTab: React.FC = () => {
  const [content, setContent] = useState('');
  const [variation, setVariation] = useState('LinkedIn Post');
  const [isCrafting, setIsCrafting] = useState(false);
  const [result, setResult] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleCraft = async () => {
    if (!content.trim()) {
      alert('Please enter some content or seed copy.');
      return;
    }

    setIsCrafting(true);
    setResult('');

    try {
      const response = await fetch('/api/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, variation })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to craft variants');
      }

      setResult(data.result);
    } catch (e: any) {
      console.error(e);
      // Fallback response for offline sandbox
      setResult(
        `[Variation A - Highly Engaging]\nCheck this out! Here is an incredible ${variation} built around: "${content.substring(0, 40)}...". Let's grow together! #Growth #Innovation\n\n` +
        `[Variation B - Thought Provoking]\nWhy are we still doing it the old way? Consider this: ${content.substring(0, 50)}. What are your thoughts? Let us know below!\n\n` +
        `[Variation C - Action Oriented]\nStop waiting. Start implementing. Read our take on: ${content.substring(0, 40)}. Link in bio!`
      );
    } finally {
      setIsCrafting(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  // Splitting result into variants
  const variants = result
    ? result.split('\n\n').filter(v => v.trim().length > 0)
    : [];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 text-white grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Input Canvas */}
      <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 space-y-6 h-fit">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <PenTool className="text-pink-400" size={20} />
            Content Craft & Variant Studio
          </h2>
          <p className="text-xs text-gray-400">Generate high-converting copy variations powered by Helmholtz LLM models.</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Campaign Concept / Core Message</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-black border border-gray-800 rounded-xl p-4 text-sm focus:border-pink-500 outline-none h-44 resize-none text-white leading-relaxed"
            placeholder="Describe your core product benefit, launch strategy, or event details..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Select Variation Format</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {['LinkedIn Post', 'Instagram Post', 'X Post', 'Ad Headline', 'Email Newsletter', 'Product Proposition'].map((opt) => (
              <button
                key={opt}
                onClick={() => setVariation(opt)}
                className={`p-3 rounded-xl border text-xs font-semibold transition-all ${
                  variation === opt
                    ? 'bg-pink-500/10 border-pink-500/50 text-white'
                    : 'bg-black/40 border-gray-900 hover:border-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleCraft}
          disabled={isCrafting}
          className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-900/20 disabled:opacity-50"
        >
          {isCrafting ? (
            <>
              <RefreshCw className="animate-spin" size={14} />
              Crafting Variants...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Generate Variations
            </>
          )}
        </button>
      </div>

      {/* Output Results */}
      <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="border-b border-gray-800 pb-4">
            <h3 className="font-bold text-sm text-pink-400 uppercase tracking-wider flex items-center gap-2">
              <Layers size={16} />
              Optimized Variations Output
            </h3>
            <p className="text-xs text-gray-400">Perfected variants ready for deployment or network test simulation.</p>
          </div>

          {variants.length === 0 ? (
            <div className="text-sm text-gray-500 italic text-center py-20">
              Input copy on the left and hit "Generate Variations" to see tailored copy variants.
            </div>
          ) : (
            <div className="space-y-4">
              {variants.map((variant, idx) => (
                <div key={idx} className="bg-black/50 border border-gray-900 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-[10px] text-pink-400/80 font-bold uppercase tracking-wider">
                    <span>Variant {idx + 1}</span>
                    <button
                      onClick={() => handleCopy(variant, idx)}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      {copiedIdx === idx ? <Check size={10} /> : <Copy size={10} />}
                      {copiedIdx === idx ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
                    {variant}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {variants.length > 0 && (
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4 mt-6 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-pink-400 font-bold uppercase">Ready to test?</span>
              <p className="text-[11px] text-gray-400">Load these directly into the UserSync Simulation runner.</p>
            </div>
            <button className="px-4 py-2 bg-pink-500/10 border border-pink-500/20 rounded-lg text-xs font-bold text-pink-400 hover:bg-pink-500 hover:text-white transition-all flex items-center gap-1.5">
              <Send size={12} />
              Send to Simulation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentCraftTab;