import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { NAV_LINKS } from '../constants';
import Button from './ui/Button';

interface NavbarProps {
  onStart?: () => void;
  onLogin?: () => void;
  user?: any;
}

const Navbar: React.FC<NavbarProps> = ({ onStart, onLogin, user }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-black/80 backdrop-blur-md py-3 border-b border-gray-800' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
          <div className="w-8 h-8 flex items-center justify-center font-bold text-xl text-white">
            {/* Stylized Logo Mockup */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
              <path d="M12 2L2 22h20L12 2z" className="text-gray-400" />
              <path d="M12 6L6 20h12L12 6z" className="text-white fill-white" />
            </svg>
          </div>
          <span className="font-semibold text-lg tracking-tight">SyncUsers</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a 
              key={link.label} 
              href={link.href} 
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-full px-4 py-1.5">
               {user.avatarUrl && <img src={user.avatarUrl} alt={user.preferred_username} className="w-6 h-6 rounded-full" />}
               <span className="text-sm font-medium text-gray-300">{user.preferred_username}</span>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={onLogin}>Sign in with HF</Button>
          )}
          <Button variant="primary" size="sm" onClick={onStart}>Start Building</Button>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden text-gray-300 hover:text-white"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-black border-t border-gray-800 p-6 absolute top-full left-0 right-0">
          <div className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <a 
                key={link.label} 
                href={link.href} 
                className="text-lg font-medium text-gray-300 hover:text-white"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 flex flex-col gap-3">
              {user ? (
                <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                   {user.avatarUrl && <img src={user.avatarUrl} alt={user.preferred_username} className="w-8 h-8 rounded-full" />}
                   <span className="font-medium text-gray-300">{user.preferred_username}</span>
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => { setIsMobileMenuOpen(false); if(onLogin) onLogin(); }}>Sign in with HF</Button>
              )}
              <Button variant="primary" className="w-full" onClick={() => { setIsMobileMenuOpen(false); if(onStart) onStart(); }}>Start Building</Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;