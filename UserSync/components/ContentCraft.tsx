import React, { useState } from 'react';
import { Sparkles, Wand2, RefreshCw, Copy, Check, CheckSquare } from 'lucide-react';

export default function ContentCraft() {
  const [content, setContent] = useState('');
  const [variation, setVariation] = useState('social media post');
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCraft = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const response = await fetch('/api/craft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, variation })
      });
      const data = await response.json();
      if (response.ok && data.result) {
        // Parse results out into distinct options if separated by numbers or blocks
        const splitText = data.result
          .split(/\d+\.\s+/)
          .map((t: string) => t.trim())
          .filter(Boolean);
        setResults(splitText.length > 0 ? splitText : [data.result]);
      } else {
        setResults([data.error || 'Failed to craft variants. Please check your BLABLADOR_API_KEY.']);
      }
    } catch (e) {
      setResults(['Error calling Blablador copywriting service. Operating in local sandbox offline mode.']);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="bg-black text-white min-h-screen p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="text-pink-400 w-8 h-8 animate-pulse" />
            <h1 className="text-3xl font-bold tracking-tight">Content Craft & Variant Studio</h1>
          </div>
          <p className="text-gray-400 max-w-2xl">
            Unleash advanced copywriting AI (powered by Helmholtz Blablador) to generate engaging variations of your value propositions, blog posts, or marketing scripts instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Creator inputs */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Wand2 className="text-pink-400 w-5 h-5" /> Copywriter Dashboard
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium uppercase">Source Concept / Value Proposition</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Paste the core idea, technical copy, or message draft you want to optimize..."
                className="w-full h-40 bg-black border border-gray-800 rounded-xl p-4 text-sm focus:border-pink-500 outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium uppercase">Format / Style Target</label>
              <select
                value={variation}
                onChange={e => setVariation(e.target.value)}
                className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm focus:border-pink-500 outline-none"
              >
                <option value="social media post">Social Media Post (LinkedIn, X)</option>
                <option value="newsletter intro">Email Newsletter Introduction</option>
                <option value="landing page hero">Landing Page Hero H1/H2 Copy</option>
                <option value="product announcement">Product Launch Release Copy</option>
                <option value="short ad campaign">Ad Creative Copywriting</option>
              </select>
            </div>

            <button
              onClick={handleCraft}
              disabled={loading || !content.trim()}
              className="w-full py-3 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin w-4 h-4" /> Synthesizing variants...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Generate Copy Options
                </>
              )}
            </button>
          </div>

          {/* Results workspace */}
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-900/20 border border-gray-800/80 rounded-xl px-6 py-3">
              <h3 className="text-sm font-semibold uppercase text-gray-400 tracking-wider">AI Variations Generated</h3>
            </div>

            {results.length === 0 && !loading && (
              <div className="bg-gray-950 border border-gray-900 rounded-2xl p-12 text-center text-gray-600 italic text-sm">
                Enter copy concept on the left and click Generate to see options here.
              </div>
            )}

            {loading && (
              <div className="space-y-3">
                {[1, 2].map(n => (
                  <div key={n} className="bg-gray-950/40 border border-gray-900 rounded-xl p-5 animate-pulse space-y-3">
                    <div className="h-4 bg-gray-800 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-900 rounded w-full"></div>
                    <div className="h-3 bg-gray-900 rounded w-4/5"></div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4">
              {results.map((text, idx) => (
                <div key={idx} className="bg-gray-950 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-pink-400 font-mono font-bold uppercase">Variant #{idx + 1}</span>
                    <button
                      onClick={() => handleCopy(text, idx)}
                      className="text-gray-500 hover:text-white transition-colors p-1"
                    >
                      {copiedIndex === idx ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
