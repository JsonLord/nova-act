
import React from 'react';
import { TESTIMONIALS } from '../constants';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const Testimonials: React.FC = () => {
  return (
    <section className="py-24 bg-black border-y border-gray-900">
       <div className="max-w-7xl mx-auto px-6">
         <div className="flex justify-center mb-8">
           <span className="px-4 py-1.5 rounded-full border border-gray-700 text-sm text-gray-300">Testimonials</span>
         </div>
         <h2 className="text-3xl md:text-5xl font-semibold text-center mb-16 max-w-3xl mx-auto">
           Join thousands using Agentic User Experience (AUX) to run simulations and test ideas
         </h2>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, idx) => (
              <div key={idx} className="bg-gray-900/30 border border-gray-800 p-8 rounded-2xl flex flex-col justify-between h-full">
                 <p className="text-xl leading-relaxed text-gray-200 mb-8 font-light">"{t.quote}"</p>
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center font-bold text-lg">
                      {t.company[0]}
                    </div>
                    <div>
                      <div className="font-semibold">{t.company}</div>
                      <div className="text-sm text-gray-400">{t.author} • {t.role}</div>
                    </div>
                 </div>
              </div>
            ))}
         </div>

         <div className="flex justify-center gap-4 mt-12">
            <button className="w-12 h-12 rounded-full border border-gray-700 flex items-center justify-center hover:bg-white hover:text-black transition-colors">
              <ArrowLeft size={20} />
            </button>
            <button className="w-12 h-12 rounded-full border border-gray-700 flex items-center justify-center hover:bg-white hover:text-black transition-colors">
              <ArrowRight size={20} />
            </button>
         </div>
       </div>
    </section>
  );
};

export default Testimonials;
