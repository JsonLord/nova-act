import React, { useState } from 'react';
import { Database, FileCode, Play, Send, RefreshCw, Layers, CheckCircle2, Copy } from 'lucide-react';

const DataExtractionTab: React.FC = () => {
  const [url, setUrl] = useState('https://news.ycombinator.com');
  const [schema, setSchema] = useState(
    JSON.stringify({
      title: 'Hacker News Scrape',
      selectors: {
        stories: '.athing',
        title: '.titleline > a',
        score: '.score'
      }
    }, null, 2)
  );
  const [isScraping, setIsScraping] = useState(false);
  const [results, setResults] = useState('');
  const [isImported, setIsImported] = useState(false);

  const handleScrape = () => {
    if (!url.trim()) {
      alert('Please enter a target URL.');
      return;
    }

    setIsScraping(true);
    setResults('');

    setTimeout(() => {
      setIsScraping(false);
      setResults(JSON.stringify({
        status: 'success',
        extracted_at: new Date().toISOString(),
        data: {
          items_scraped: 3,
          competitors: [
            { name: "NovaAgent", price_tier: "$49/mo", reviews: "Positive" },
            { name: "SyncUsers Pro", price_tier: "$99/mo", reviews: "Highly Engaged" },
            { name: "SaaS Simulator", price_tier: "$15/mo", reviews: "Neutral" }
          ]
        }
      }, null, 2));
    }, 1500);
  };

  const handleExportToUserSync = () => {
    setIsImported(true);
    setTimeout(() => {
      setIsImported(false);
      alert('Scraped competitive profiles successfully mapped and imported into Tab 4 (Persona Builder) database!');
    }, 1000);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 text-white grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Scraper Configuration Form */}
      <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 space-y-6 h-fit">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Database className="text-indigo-400" size={20} />
            Nova Act Data Extraction Studio
          </h2>
          <p className="text-xs text-gray-400">Define extraction selectors & structured JSON schemas to gather competitor intelligence.</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Target URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none text-white font-mono"
            placeholder="e.g. https://news.ycombinator.com"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <FileCode size={14} /> Schema Blueprint (JSON Format)
          </label>
          <textarea
            value={schema}
            onChange={(e) => setSchema(e.target.value)}
            className="w-full bg-black border border-gray-800 rounded-xl p-4 text-xs focus:border-indigo-500 outline-none h-48 resize-none text-indigo-300 font-mono leading-relaxed"
          />
        </div>

        <button
          onClick={handleScrape}
          disabled={isScraping}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 disabled:opacity-50"
        >
          {isScraping ? (
            <>
              <RefreshCw className="animate-spin" size={14} />
              Executing Scraping Action...
            </>
          ) : (
            <>
              <Play size={14} />
              Execute Structured Scrape
            </>
          )}
        </button>
      </div>

      {/* Scraper Output & UserSync Mapping */}
      <div className="bg-[#0c0c0c] border border-gray-800 rounded-2xl p-6 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="border-b border-gray-800 pb-4">
            <h3 className="font-bold text-sm text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <Layers size={16} />
              Extracted Scrape Payload
            </h3>
            <p className="text-xs text-gray-400">Structured competitor attributes fetched from target HTML DOM.</p>
          </div>

          {!results ? (
            <div className="text-sm text-gray-500 italic text-center py-24">
              Configure scraping selectors and tap "Execute Structured Scrape" to generate structured data.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-black/50 border border-gray-900 rounded-xl p-4">
                <div className="flex justify-between items-center text-[10px] text-indigo-400/80 font-bold uppercase tracking-wider mb-2">
                  <span>Structured Response Object</span>
                  <button className="flex items-center gap-1 hover:text-white transition-colors">
                    <Copy size={10} /> Copy Scrape Data
                  </button>
                </div>
                <pre className="text-xs text-gray-300 leading-relaxed font-mono overflow-y-auto max-h-[250px] whitespace-pre">
                  {results}
                </pre>
              </div>
            </div>
          )}
        </div>

        {results && (
          <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4 mt-6 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-indigo-400 font-bold uppercase">Feed UserSync Personas</span>
              <p className="text-[11px] text-gray-400">Import these scraped SaaS prices and reviews into synthetic buyer focus groups.</p>
            </div>
            <button
              onClick={handleExportToUserSync}
              className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs font-bold text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all flex items-center gap-1.5"
            >
              <Send size={12} />
              Export to UserSync
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataExtractionTab;