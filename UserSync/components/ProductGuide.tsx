import React, { useState } from 'react';
import { Book, Code, Terminal, Zap, ChevronRight, CheckCircle, Info } from 'lucide-react';

const ProductGuide: React.FC = () => {
  return (
    <div className="bg-black min-h-screen text-white p-8 md:p-16 max-w-5xl mx-auto font-sans">
      <h1 className="text-4xl md:text-6xl font-bold mb-8 bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
        Product Guide & Documentation
      </h1>

      <p className="text-xl text-gray-400 mb-12 leading-relaxed">
        Welcome to Branding Content Testing. This guide will help you understand how to use our agentic simulation platform to validate your brand narratives and marketing content before going live.
      </p>

      <div className="space-y-16">
        {/* Section 1 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/50 flex items-center justify-center text-teal-400">
               <Zap size={20} />
            </div>
            <h2 className="text-2xl font-bold">Getting Started</h2>
          </div>
          <div className="prose prose-invert max-w-none text-gray-300 space-y-4">
            <p>
              To start using the platform, you must first authenticate with your Hugging Face account. This allows you to save your simulations, custom focus groups, and results.
            </p>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-500" />
                Step 1: Sign in with Hugging Face
              </h3>
              <p className="text-sm">Click the "Sign in with Hugging Face" button in the sidebar or navbar. You will be redirected to Hugging Face to authorize the application.</p>
            </div>
          </div>
        </section>

        {/* Section 2 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/50 flex items-center justify-center text-blue-400">
               <Book size={20} />
            </div>
            <h2 className="text-2xl font-bold">Core Concepts</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#0a0a0a] border border-gray-800 p-6 rounded-2xl">
               <h3 className="text-lg font-bold mb-3">Focus Groups</h3>
               <p className="text-sm text-gray-400">AI-generated collectives of personas that mirror specific real-world audiences. You can create your own by describing your target customer and company profile.</p>
            </div>
            <div className="bg-[#0a0a0a] border border-gray-800 p-6 rounded-2xl">
               <h3 className="text-lg font-bold mb-3">Simulations</h3>
               <p className="text-sm text-gray-400">The process of running your content through a Focus Group to gather sentiment, engagement predictions, and feedback.</p>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/50 flex items-center justify-center text-purple-400">
               <Terminal size={20} />
            </div>
            <h2 className="text-2xl font-bold">How to Create a Focus Group</h2>
          </div>
          <ul className="space-y-4 text-gray-400">
            <li className="flex items-start gap-3">
              <ChevronRight size={18} className="text-teal-500 mt-1" />
              <span><strong>Customer Profile:</strong> Describe who your ideal customer is (e.g., "Tech founders in Europe interested in sustainability").</span>
            </li>
            <li className="flex items-start gap-3">
              <ChevronRight size={18} className="text-teal-500 mt-1" />
              <span><strong>Company Info:</strong> Provide context about your brand and what you offer.</span>
            </li>
            <li className="flex items-start gap-3">
              <ChevronRight size={18} className="text-teal-500 mt-1" />
              <span><strong>Persona Scale:</strong> Adjust the scale (1-100) to determine how many unique personas should be generated for the group.</span>
            </li>
          </ul>
        </section>

        {/* FAQ Section */}
        <section className="bg-teal-950/10 border border-teal-900/30 rounded-3xl p-8 md:p-12">
          <h2 className="text-3xl font-bold mb-8">Frequently Asked Questions</h2>
          <div className="space-y-8">
            <div>
              <h4 className="text-teal-400 font-semibold mb-2">How long does a simulation take?</h4>
              <p className="text-gray-400">Simulations run asynchronously and can take up to 30 minutes to fully process. Use the "Gather Results" button to fetch updates.</p>
            </div>
            <div>
              <h4 className="text-teal-400 font-semibold mb-2">Can I upload images?</h4>
              <p className="text-gray-400">Yes! You can upload local images or provide web image links to test visual brand assets and website layouts.</p>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-20 pt-12 border-t border-gray-900 text-center">
         <p className="text-gray-500 text-sm mb-6">Need more help? Join our community or contact support.</p>
         <div className="flex justify-center gap-4">
            <div className="px-6 py-2 bg-white text-black rounded-full font-bold text-sm cursor-pointer hover:bg-gray-200 transition-colors">Contact Support</div>
            <div className="px-6 py-2 border border-gray-700 rounded-full font-bold text-sm cursor-pointer hover:bg-gray-800 transition-colors">API Docs</div>
         </div>
      </div>
    </div>
  );
};

export default ProductGuide;
