
import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js';

const RealNetworkGraph: React.FC = () => {
  const graphDiv = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!graphDiv.current) return;

    // --- Data Generation Logic ---
    const N = 80; // Node count
    const radius = 0.22; // Connection threshold
    const nodes = [];

    // 1. Create nodes
    for (let i = 0; i < N; i++) {
      nodes.push({
        x: Math.random(),
        y: Math.random(),
        connections: 0
      });
    }

    // 2. Create edges
    const edgeX: (number | null)[] = [];
    const edgeY: (number | null)[] = [];
    
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < radius) {
          nodes[i].connections++;
          nodes[j].connections++;
          edgeX.push(nodes[i].x, nodes[j].x, null);
          edgeY.push(nodes[i].y, nodes[j].y, null);
        }
      }
    }

    const nodeX = nodes.map(n => n.x);
    const nodeY = nodes.map(n => n.y);
    const nodeColor = nodes.map(n => n.connections);

    // --- Plotly Configuration ---
    
    const edgeTrace = {
      x: edgeX,
      y: edgeY,
      mode: 'lines',
      line: { width: 0.5, color: '#4b5563' }, // gray-600
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
        colorscale: 'Viridis', 
        color: nodeColor,
        size: 8,
        line: { width: 0 }
      },
      type: 'scatter'
    };

    const layout = {
      showlegend: false,
      hovermode: false,
      margin: { b: 0, l: 0, r: 0, t: 0 },
      xaxis: { 
        showgrid: false, 
        zeroline: false, 
        showticklabels: false, 
        range: [-0.05, 1.05],
        fixedrange: true 
      },
      yaxis: { 
        showgrid: false, 
        zeroline: false, 
        showticklabels: false, 
        range: [-0.05, 1.05],
        fixedrange: true
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      autosize: true,
      dragmode: false
    };

    const config = { 
      staticPlot: true, // Disables all interactions for a cleaner background look
      displayModeBar: false, 
      responsive: true 
    };

    // @ts-ignore - Plotly types can be tricky with ESM imports
    Plotly.newPlot(graphDiv.current, [edgeTrace, nodeTrace], layout, config);

    // Handle Resize
    const resizeObserver = new ResizeObserver(() => {
        if (graphDiv.current) {
            // @ts-ignore
            Plotly.Plots.resize(graphDiv.current);
        }
    });
    resizeObserver.observe(graphDiv.current);

    return () => {
        resizeObserver.disconnect();
        // @ts-ignore
        if (graphDiv.current) Plotly.purge(graphDiv.current);
    };
  }, []);

  return (
    <div ref={graphDiv} className="w-full h-full" />
  );
};

export default RealNetworkGraph;
