import React, { useState } from 'react';
import { FAQS } from '../constants';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-24 bg-black">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div>
          <div className="inline-block px-4 py-1.5 rounded-full border border-gray-700 text-sm text-gray-300 mb-8">FAQ</div>
          <h2 className="text-3xl md:text-5xl font-semibold mb-6">
            We simulated what questions you need answering
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Explore quick solutions to common questions. Need more? Feel free to contact our <u className="text-white cursor-pointer">support team</u>.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => (
            <div 
              key={idx} 
              className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/20"
            >
              <button 
                className="w-full flex justify-between items-center p-6 text-left hover:bg-gray-900/50 transition-colors"
                onClick={() => toggleFAQ(idx)}
              >
                <span className="font-medium text-lg">{faq.question}</span>
                {openIndex === idx ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
              </button>
              
              <div 
                className={`transition-all duration-300 ease-in-out overflow-hidden ${openIndex === idx ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <div className="p-6 pt-0 text-gray-400 leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;