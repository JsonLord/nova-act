import React from 'react';
import { Book, Code, Terminal, Zap } from 'lucide-react';
import Button from './ui/Button';

const Documentation: React.FC = () => {
  return (
    <section id="docs" className="py-24 bg-black border-t border-gray-900">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div>
            <div className="inline-block px-4 py-1.5 rounded-full border border-gray-700 text-sm text-gray-300 mb-6">
              Developers First
            </div>
            <h2 className="text-3xl md:text-5xl font-semibold mb-4">
              Build with our API
            </h2>
            <p className="text-gray-400 text-lg max-w-xl">
              Integrate user simulation directly into your CI/CD pipeline or product workflow. 
              Get started for free.
            </p>
          </div>
          <Button variant="outline">View Full Documentation</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Code Snippet Card */}
            <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 md:p-8 font-mono text-sm overflow-hidden relative group">
                <div className="absolute top-4 right-4 flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                </div>
                <div className="text-gray-500 mb-2"># Install the SDK</div>
                <div className="text-teal-400 mb-6">$ npm install @aux/sdk</div>
                
                <div className="text-gray-500 mb-2"># Run a simulation</div>
                <div className="text-purple-300">import</div> <div className="text-white inline">{`{ AuxClient }`}</div> <div className="text-purple-300 inline">from</div> <div className="text-green-300 inline">'@aux/sdk'</div>;
                <br/>
                <br/>
                <div className="text-purple-300">const</div> <div className="text-white inline">client</div> = <div className="text-purple-300 inline">new</div> <div className="text-yellow-300 inline">AuxClient</div>({`{ apiKey: '...' }`});
                <br/>
                <br/>
                <div className="text-purple-300">const</div> <div className="text-white inline">result</div> = <div className="text-purple-300 inline">await</div> client.simulation.<div className="text-blue-300 inline">create</div>({`{`}
                <br/>
                &nbsp;&nbsp;audience: <div className="text-green-300 inline">'tech-founders'</div>,
                <br/>
                &nbsp;&nbsp;content: <div className="text-green-300 inline">'https://myapp.com/launch'</div>
                <br/>
                {`}`});
            </div>

            {/* Docs Links Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-900/20 border border-gray-800 p-6 rounded-xl hover:bg-gray-900/40 transition-colors cursor-pointer group">
                    <Book className="w-8 h-8 text-teal-500 mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-white font-medium mb-2">Quick Start Guide</h3>
                    <p className="text-gray-500 text-sm">Deploy your first simulation in under 5 minutes.</p>
                </div>
                <div className="bg-gray-900/20 border border-gray-800 p-6 rounded-xl hover:bg-gray-900/40 transition-colors cursor-pointer group">
                    <Terminal className="w-8 h-8 text-purple-500 mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-white font-medium mb-2">API Reference</h3>
                    <p className="text-gray-500 text-sm">Detailed endpoints, parameters, and response types.</p>
                </div>
                <div className="bg-gray-900/20 border border-gray-800 p-6 rounded-xl hover:bg-gray-900/40 transition-colors cursor-pointer group">
                    <Code className="w-8 h-8 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-white font-medium mb-2">SDKs & Libraries</h3>
                    <p className="text-gray-500 text-sm">Official libraries for Node.js, Python, and Go.</p>
                </div>
                <div className="bg-gray-900/20 border border-gray-800 p-6 rounded-xl hover:bg-gray-900/40 transition-colors cursor-pointer group">
                    <Zap className="w-8 h-8 text-yellow-500 mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="text-white font-medium mb-2">Webhooks</h3>
                    <p className="text-gray-500 text-sm">Real-time event notifications for your integrations.</p>
                </div>
            </div>
        </div>
      </div>
    </section>
  );
};

export default Documentation;