import React from 'react';
import { CheckCircle, Timer, Clock, ClipboardCheck, Smile, Gauge } from 'lucide-react';

const TrustedBy: React.FC = () => {
  const metrics = [
    {
      icon: <CheckCircle size={20} />,
      category: "Task Success Rate",
      question: "Do users complete their goals?",
      outcome: "Identify drop-off points in critical flows."
    },
    {
      icon: <Timer size={20} />,
      category: "Time-on-Task",
      question: "How quickly do they finish?",
      outcome: "Benchmark efficiency against previous versions."
    },
    {
      icon: <Clock size={20} />,
      category: "Session Duration",
      question: "How long do they stay engaged?",
      outcome: "Balance retention with efficient task completion."
    },
    {
      icon: <ClipboardCheck size={20} />,
      category: "System Usability Scale",
      question: "Is the product usable?",
      outcome: "Standardized scoring for overall usability."
    },
    {
      icon: <Smile size={20} />,
      category: "Customer Satisfaction",
      question: "Are users happy with the experience?",
      outcome: "Predict long-term retention and loyalty."
    },
    {
      icon: <Gauge size={20} />,
      category: "Customer Effort Score",
      question: "Is it easy to get things done?",
      outcome: "Reduce friction to increase conversion."
    }
  ];

  return (
    <section className="py-24 border-t border-gray-800 bg-black">
      <div className="max-w-7xl mx-auto px-6">
        <h3 className="text-center text-3xl md:text-4xl font-semibold text-white mb-6">
          Quantify your UX quality programmatically.
        </h3>
        <p className="text-center text-gray-400 mb-16 max-w-2xl mx-auto text-lg">
           Developers use SyncUsers to predict performance on core metrics without waiting for live traffic data.
        </p>

        {/* UX Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24">
           {metrics.map((item, idx) => (
             <div key={idx} className="group p-8 rounded-2xl border border-gray-800 bg-gray-900/20 hover:border-teal-900/50 hover:bg-gray-900/40 transition-all duration-300">
                <div className="flex items-center gap-3 mb-5 text-gray-500 group-hover:text-teal-400 transition-colors">
                   {item.icon}
                   <span className="text-xs font-mono uppercase tracking-widest">{item.category}</span>
                </div>
                <div className="text-xl font-medium text-white mb-3 group-hover:translate-x-1 transition-transform duration-300">
                  {item.question}
                </div>
                <p className="text-sm text-gray-500 leading-relaxed group-hover:text-gray-400 transition-colors">
                  {item.outcome}
                </p>
             </div>
           ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {[
            { value: "2,000+", label: "Persona Database ready", color: "border-blue-900" },
            { value: "REST & GraphQL", label: "API Available", color: "border-teal-900" },
          ].map((stat, idx) => (
            <div key={idx} className={`relative flex flex-col items-center justify-center py-16 rounded-full border border-t-2 ${stat.color} bg-gradient-to-b from-gray-900 to-black`}>
              <h4 className="text-4xl md:text-5xl font-bold text-white mb-2">{stat.value}</h4>
              <p className="text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustedBy;