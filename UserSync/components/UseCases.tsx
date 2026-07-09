import React from 'react';
import { USE_CASES } from '../constants';

const UseCases: React.FC = () => {
  return (
    <section id="use-cases" className="py-24 bg-black">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-center mb-8">
           <span className="px-4 py-1.5 rounded-full border border-gray-700 text-sm text-gray-300">Use Cases</span>
        </div>
        <h2 className="text-3xl md:text-5xl font-semibold text-center mb-20">Solve high-stakes branding challenges</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {USE_CASES.map((useCase, idx) => (
            <div key={idx} className="group p-8 border border-gray-800 rounded-2xl bg-gradient-to-br from-gray-900/50 to-black hover:border-gray-600 transition-all duration-300 hover:shadow-lg hover:shadow-gray-900/20">
              <div className="mb-6">
                 <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800 text-xs font-medium text-gray-300 border border-gray-700">
                    <span className={`w-2 h-2 rounded-full ${useCase.color}`}></span>
                    {useCase.category}
                 </span>
              </div>
              <h3 className="text-2xl font-semibold mb-3 group-hover:text-white transition-colors">{useCase.title}</h3>
              <p className="text-gray-400 leading-relaxed text-sm">{useCase.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default UseCases;