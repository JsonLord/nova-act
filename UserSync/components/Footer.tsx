import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="py-12 bg-black border-t border-gray-900 text-sm text-gray-500">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center font-bold text-white bg-gray-800 rounded">Λ</div>
            <span className="text-white font-semibold">SyncUsers</span>
        </div>
        
        <div className="flex gap-8">
          <a href="#" className="hover:text-white transition-colors">Twitter</a>
          <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
          <a href="#" className="hover:text-white transition-colors">Terms</a>
        </div>

        <div>
          © 2024 SyncUsers Inc.
        </div>
      </div>
    </footer>
  );
};

export default Footer;