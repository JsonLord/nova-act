import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const data = [
  { name: 'SyncUsers', score: 82, color: '#ffffff' }, // White
  { name: 'Claude 3.7 Sonnet', score: 64, color: '#4b5563' }, // Gray-600
  { name: 'Gemini 1.5 pro', score: 63, color: '#4b5563' },
  { name: 'GPT-4o', score: 60, color: '#4b5563' },
  { name: 'GPT-3.5 Turbo', score: 54, color: '#4b5563' },
];

const Accuracy: React.FC = () => {
  return (
    <section id="accuracy" className="py-24 bg-black">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
           <div className="inline-block px-4 py-1.5 rounded-full border border-gray-700 text-sm text-gray-300 mb-8">Accuracy</div>
           <h2 className="text-3xl md:text-5xl font-semibold leading-tight mb-8">
             SyncUsers is <span className="text-white">30% more accurate</span> at predicting engagement than standard LLMs.
           </h2>
           
           <div className="bg-gray-900/30 border border-gray-800 rounded-2xl p-6 md:p-8">
             <h4 className="text-gray-400 mb-6">Success rate at picking winners from pairs of LinkedIn posts</h4>
             <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40 }}>
                   <XAxis type="number" hide />
                   <YAxis 
                     dataKey="name" 
                     type="category" 
                     width={150} 
                     tick={{ fill: '#9ca3af', fontSize: 12 }} 
                     axisLine={false}
                     tickLine={false}
                   />
                   <Tooltip 
                     cursor={{ fill: 'transparent' }}
                     contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }}
                   />
                   <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={32}>
                     {data.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.name === 'SyncUsers' ? 'url(#gradient)' : '#374151'} />
                     ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
               {/* Def for gradient */}
               <svg style={{ height: 0 }}>
                 <defs>
                   <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
                     <stop offset="0%" stopColor="#e5e7eb" />
                     <stop offset="100%" stopColor="#ffffff" />
                   </linearGradient>
                 </defs>
               </svg>
             </div>
             {/* Custom Labels overlay for scores since Recharts labels are tricky with layout vertical sometimes */}
             <div className="hidden"> 
                {/* Placeholder for accessibility */}
             </div>
           </div>
        </div>

        {/* Right 3D Visual */}
        <div className="relative h-[600px] flex items-end justify-center perspective-1000">
             {/* Abstract 3D Bar representation */}
             <div className="relative w-40 h-80 bg-teal-800 transform rotate-y-12 shadow-2xl translate-x-10 translate-y-10 z-10 opacity-90">
                <div className="absolute top-0 left-0 w-full h-10 bg-teal-400 transform -skew-x-[40deg] origin-top -translate-y-10"></div>
                <div className="absolute top-0 left-0 h-full w-10 bg-teal-900 transform skew-y-[50deg] origin-left -translate-x-10"></div>
             </div>
             
             <div className="relative w-24 h-40 bg-blue-900 transform rotate-y-12 shadow-xl -translate-x-10 translate-y-20 opacity-70">
                <div className="absolute top-0 left-0 w-full h-8 bg-blue-500 transform -skew-x-[40deg] origin-top -translate-y-8"></div>
                <div className="absolute top-0 left-0 h-full w-8 bg-blue-950 transform skew-y-[50deg] origin-left -translate-x-8"></div>
             </div>

             <div className="absolute top-20 right-20 text-9xl font-bold text-gray-800 opacity-20 select-none">
               Λ
             </div>
        </div>
      </div>
    </section>
  );
};

export default Accuracy;