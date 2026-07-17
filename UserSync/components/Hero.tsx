
import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import RealNetworkGraph from './RealNetworkGraph';

interface HeroProps {
  onStart?: () => void;
}

const Hero: React.FC<HeroProps> = ({ onStart }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev === 0 ? 1 : 0));
    }, 6000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* Left Content - Animated Transitions */}
        <div className="space-y-8 relative h-[400px]">
          {/* Slide 1 */}
          <div className={`absolute top-0 left-0 w-full transition-all duration-1000 ease-in-out transform ${currentSlide === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'}`}>
             <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              Branding Simulation <span className="text-gray-400">API</span> for Global Teams
            </h1>
            <p className="text-xl text-gray-400 mt-6 max-w-lg">
              Programmatically test your brand narratives. Integrate accurate audience simulation into your creative workflow. Free for developers.
            </p>
            <div className="flex flex-wrap gap-4 mt-8">
              <Button variant="primary" size="lg" onClick={onStart}>Try Branding Simulation</Button>
              <Button variant="outline" size="lg" onClick={() => window.location.href='#features'}>How it Works</Button>
            </div>
          </div>

          {/* Slide 2 */}
          <div className={`absolute top-0 left-0 w-full transition-all duration-1000 ease-in-out transform ${currentSlide === 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              Test your Brand. <span className="bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">Before you launch.</span>
            </h1>
            <p className="text-xl text-gray-400 mt-6 max-w-lg">
              Validate brand voice and campaign ideas with AI-generated focus groups. The new standard for agentic brand testing and narrative validation.
            </p>
            <div className="flex flex-wrap gap-4 mt-8">
              <Button variant="primary" size="lg" onClick={onStart}>Start Building</Button>
              <Button variant="outline" size="lg" onClick={() => window.location.href='#docs'}>Documentation</Button>
            </div>
          </div>
        </div>

        {/* Right Visuals - Real Network Graph */}
        <div className="relative h-[500px] w-full flex items-center justify-center">
           <div 
             className="w-full h-full opacity-80"
             style={{ 
               maskImage: 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)',
               WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)'
             }}
           >
              <RealNetworkGraph />
           </div>
           
           {/* Overlay Elements for depth */}
           <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black via-transparent to-transparent"></div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
