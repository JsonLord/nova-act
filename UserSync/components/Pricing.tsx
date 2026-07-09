import React, { useState } from 'react';
import Button from './ui/Button';
import { Check } from 'lucide-react';

const Pricing: React.FC = () => {
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      name: "Free",
      price: "$0",
      desc: "No cost to run your first experiments",
      features: ["Access all features", "Configure your own focus groups", "3 Starting simulation credits"],
      cta: "Select Free",
      featured: false
    },
    {
      name: "Pro",
      price: "$55",
      period: "/ mo",
      desc: "Billed monthly",
      features: ["Everything in Free", "Unlimited focus groups", "Unlimited simulation credits"],
      cta: "Select Pro",
      featured: true
    },
    {
      name: "Enterprise",
      price: "Get in Touch",
      desc: "Custom builds for businesses",
      features: ["Custom audience builds", "Custom contexts & segments", "Data & CRM integration", "API Access", "Dedicated Account Manager"],
      cta: "Enquire",
      featured: false
    }
  ];

  return (
    <section id="pricing" className="py-24 bg-black">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
           <h2 className="text-4xl md:text-5xl font-semibold mb-6">Get started today</h2>
           
           {/* Toggle */}
           <div className="inline-flex items-center bg-gray-900 rounded-full p-1 border border-gray-800 relative">
              <button 
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${!isYearly ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setIsYearly(false)}
              >
                Monthly
              </button>
              <button 
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${isYearly ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setIsYearly(true)}
              >
                Yearly
              </button>
              <span className="absolute -top-3 -right-6 bg-teal-900 text-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-700">
                -30%
              </span>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col p-8 rounded-2xl border ${plan.featured ? 'border-gray-600 bg-gray-900/40 relative' : 'border-gray-800 bg-black'}`}
            >
               <div className="mb-8">
                 <h3 className="text-lg font-medium text-white mb-2">{plan.name}</h3>
                 <p className="text-gray-500 text-sm">{plan.name === 'Free' ? 'Get started with simulations' : plan.name === 'Pro' ? 'For founders, creators and builders' : 'Custom builds for businesses'}</p>
               </div>
               
               <div className="mb-8">
                 <div className="flex items-baseline">
                   <span className="text-4xl font-bold text-white">{plan.price}</span>
                   {plan.period && <span className="text-gray-400 ml-1">{plan.period}</span>}
                 </div>
                 <p className="text-gray-500 text-sm mt-2">{plan.desc}</p>
               </div>

               <div className="flex-grow space-y-4 mb-8">
                 {plan.features.map((feature, fIdx) => (
                   <div key={fIdx} className="flex items-start gap-3">
                     <Check className="w-5 h-5 text-white shrink-0" />
                     <span className="text-gray-300 text-sm">{feature}</span>
                   </div>
                 ))}
               </div>

               <Button 
                  variant={plan.featured ? 'primary' : 'outline'} 
                  className="w-full"
                >
                  {plan.cta}
                </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;