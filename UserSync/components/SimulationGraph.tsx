import React, { useEffect, useRef, useState } from 'react';
import Plotly from 'plotly.js';
import { X, Linkedin, Globe, MapPin, User, Briefcase, Users, Loader2 } from 'lucide-react';
import Button from './ui/Button';
import { GradioService } from '../services/gradioService';

interface SimulationGraphProps {
  isBuilding: boolean;
  societyType: string;
  viewMode: string;
  onStartChat?: () => void;
}

const SimulationGraph: React.FC<SimulationGraphProps> = ({ isBuilding, societyType, viewMode, onStartChat }) => {
  const graphDiv = useRef<HTMLDivElement>(null);
  const [selectedProfile, setSelectedProfile] = useState<{ x: number, y: number, data: any } | null>(null);

  // Close popup if building starts
  useEffect(() => {
    if (isBuilding) setSelectedProfile(null);
  }, [isBuilding]);

  useEffect(() => {
    const renderGraph = async () => {
      if (!graphDiv.current || isBuilding) return;

      let nodes: any[] = [];
      let edges: any[] = [];

      try {
        // Attempt to fetch real network data if societyType is provided
        const networkData = societyType ? await GradioService.getNetworkGraph(societyType) : null;
        if (networkData && networkData.nodes) {
          nodes = networkData.nodes.map((n: any) => ({
            ...n,
            x: n.x || Math.random(),
            y: n.y || Math.random(),
            role: n.name || n.id || 'Persona',
            location: n.location || 'Unknown'
          }));
          edges = networkData.edges || [];
        }
      } catch (e) {
        console.warn("Failed to fetch real network, falling back to mock.");
      }

      // Fallback to mock data if no real data
      if (nodes.length === 0) {
        const safeSocietyType = typeof societyType === 'string' ? societyType : '';
        const isTech = safeSocietyType.includes('Tech') || safeSocietyType.includes('Founders');
        const N = isTech ? 120 : 80;
        const radius = isTech ? 0.18 : 0.22;

        for (let i = 0; i < N; i++) {
          nodes.push({
            x: Math.random(),
            y: Math.random(),
            connections: 0,
            role: isTech ? ['Founder', 'CTO', 'Product Lead', 'VC'][Math.floor(Math.random() * 4)] : ['Journalist', 'Reader', 'Editor', 'Subscriber'][Math.floor(Math.random() * 4)],
            location: ['New York, USA', 'London, UK', 'Berlin, DE', 'Paris, FR'][Math.floor(Math.random() * 4)]
          });
        }

        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius) {
              nodes[i].connections++;
              nodes[j].connections++;
              edges.push({ source: i, target: j });
            }
          }
        }
      }

      const edgeX: (number | null)[] = [];
      const edgeY: (number | null)[] = [];
      edges.forEach(edge => {
        const source = nodes[edge.source];
        const target = nodes[edge.target];
        if (source && target) {
          edgeX.push(source.x, target.x, null);
          edgeY.push(source.y, target.y, null);
        }
      });

      const nodeX = nodes.map(n => n.x);
      const nodeY = nodes.map(n => n.y);

      // Determine node colors based on viewMode
      const nodeColor = nodes.map(n => {
        if (viewMode === 'Sentiment') {
           const s = n.sentiment || 'Neutral';
           if (s === 'Positive') return 1;
           if (s === 'Negative') return 2;
           if (s === 'Mixed') return 3;
           return 0; // Neutral
        }
        if (viewMode === 'Activity Level') {
           const a = n.activity || 'Lurker';
           if (a === 'Power User') return 1;
           if (a === 'Daily Active') return 2;
           if (a === 'Weekly Active') return 3;
           return 0;
        }
        if (viewMode === 'Job Title') {
           // Assign numeric index based on role string hash or predefined mapping
           const roles = ["Founder", "Product Manager", "Engineer", "Investor", "Designer"];
           const idx = roles.indexOf(n.role);
           return idx >= 0 ? idx : (n.role ? n.role.length % 5 : 0);
        }
        if (viewMode === 'Country') {
           const countries = ["United States", "United Kingdom", "Netherlands", "France", "India"];
           const loc = n.location || '';
           const idx = countries.findIndex(c => loc.includes(c));
           return idx >= 0 ? idx : (loc ? loc.length % 5 : 0);
        }
        return n.connections || 0;
      });

      const edgeTrace = {
        x: edgeX,
        y: edgeY,
        mode: 'lines',
        line: { width: 0.5, color: '#4b5563' },
        hoverinfo: 'none',
        type: 'scatter'
      };

      const nodeTrace = {
        x: nodeX,
        y: nodeY,
        mode: 'markers',
        hoverinfo: 'none',
        marker: {
          showscale: false,
          colorscale: 'Electric',
          color: nodeColor,
          size: 10,
          line: { width: 0 }
        },
        type: 'scatter'
      };

      const layout = {
        showlegend: false,
        hovermode: 'closest',
        margin: { b: 0, l: 0, r: 0, t: 0 },
        xaxis: { showgrid: false, zeroline: false, showticklabels: false, range: [-0.05, 1.05], fixedrange: true },
        yaxis: { showgrid: false, zeroline: false, showticklabels: false, range: [-0.05, 1.05], fixedrange: true },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true,
        dragmode: false
      };

      const config = { staticPlot: false, displayModeBar: false, responsive: true };

      // @ts-ignore
      Plotly.newPlot(graphDiv.current, [edgeTrace, nodeTrace], layout, config).then((gd) => {
        // @ts-ignore
        gd.on('plotly_click', (data) => {
          const point = data.points[0];
          if (point) {
            const nodeIndex = point.pointNumber;
            const nodeData = nodes[nodeIndex];
            setSelectedProfile({ x: point.x, y: point.y, data: nodeData });
          }
        });
      });
    };

    renderGraph();
  }, [isBuilding, societyType, viewMode]);

  return (
    <div className="relative w-full h-full bg-black">
      {/* The Graph */}
      <div ref={graphDiv} className="w-full h-full" />

      {/* Profile Popup */}
      {selectedProfile && !isBuilding && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-40 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex justify-between items-start">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                    {selectedProfile.data.role[0]}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{selectedProfile.data.role}</h3>
                    <p className="text-gray-400 text-xs">Head of Product at BrightCore</p>
                  </div>
               </div>
               <button 
                 onClick={() => setSelectedProfile(null)}
                 className="text-gray-500 hover:text-white"
               >
                 <X size={16} />
               </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
               <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>Built from</span>
                  <Linkedin size={14} className="text-[#0077b5]" />
                  <Globe size={14} className="text-gray-300" />
               </div>

               <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300">
                    <MapPin size={12} /> {selectedProfile.data.location}
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300">
                    <User size={12} /> Millennial
                  </div>
                   <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300">
                    <Briefcase size={12} /> Mid Level
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300">
                    <Users size={12} /> Creative & Design
                  </div>
               </div>
            </div>

            {/* Footer */}
            <div className="p-4 pt-0">
               <Button 
                 className="w-full text-sm py-2"
                 onClick={onStartChat}
               >
                 Start Conversation
               </Button>
            </div>
        </div>
      )}
    </div>
  );
};

export default SimulationGraph;