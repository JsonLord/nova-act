import React, { useState } from 'react';
import { Database, Download, FileText, CheckCircle, RefreshCw, Layers } from 'lucide-react';

export default function NovaActExtraction() {
  const [schema, setSchema] = useState(`{
  "product_name": "string",
  "pricing": "number",
  "features": ["string"]
}`);
  const [extractedData, setExtractedData] = useState<string>('');
  const [extracting, setExtracting] = useState(false);

  const handleExtract = () => {
    setExtracting(true);
    setExtractedData('');

    setTimeout(() => {
      setExtractedData(JSON.stringify({
        "product_name": "Nova Enterprise Cloud",
        "pricing": 299,
        "features": [
          "Interactive Simulation",
          "Automated UI Quality Assurance",
          "Structured Competitor Data Extraction"
        ]
      }, null, 2));
      setExtracting(false);
    }, 1500);
  };

  return (
    <div className="bg-black text-white min-h-screen p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Layers className="text-purple-400 w-8 h-8" />
            <h1 className="text-3xl font-bold tracking-tight">Structured Data Extraction & Research</h1>
          </div>
          <p className="text-gray-400 max-w-3xl">
            Siphon deep intelligence from landing pages, docs, or web apps. Provide a structured schema blueprint, and Nova Act will query target interfaces, parse their content, and return deterministic JSON datasets.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Schema Input */}
          <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Database className="text-purple-400 w-5 h-5" /> Target Blueprint Schema
            </h2>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium uppercase">JSON Schema Template</label>
              <textarea
                value={schema}
                onChange={e => setSchema(e.target.value)}
                className="w-full h-64 bg-black border border-gray-800 rounded-xl p-4 font-mono text-xs focus:border-purple-500 outline-none resize-none leading-relaxed text-purple-200"
              />
            </div>

            <button
              onClick={handleExtract}
              disabled={extracting}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              {extracting ? (
                <>
                  <RefreshCw className="animate-spin w-4 h-4" /> Extracting payload...
                </>
              ) : (
                <>
                  <Download size={16} /> Execute Extraction Workflow
                </>
              )}
            </button>
          </div>

          {/* Results Output */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-900">
                <span className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1.5"><FileText size={14} /> Extraction Results JSON</span>
                {extractedData && <span className="text-xs text-green-400 font-bold flex items-center gap-1"><CheckCircle size={12} /> Synthesized</span>}
              </div>

              {!extractedData && !extracting && (
                <div className="text-center py-20 text-gray-600 text-sm italic">
                  Run extraction on the left to display captured structured records.
                </div>
              )}

              {extracting && (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-gray-900 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-900 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-900 rounded w-full"></div>
                </div>
              )}

              {extractedData && (
                <pre className="text-xs bg-black/60 p-4 border border-gray-900 rounded-xl font-mono text-gray-200 overflow-y-auto max-h-96 whitespace-pre-wrap">
                  {extractedData}
                </pre>
              )}
            </div>

            <div className="text-[10px] text-gray-600 leading-relaxed pt-4 mt-4 border-t border-gray-900">
              Extracted structured outputs can easily be downloaded or converted into simulation focus group models automatically.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
