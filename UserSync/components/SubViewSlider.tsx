import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface SubView<T extends string = string> {
  id: T;
  label: string;
  description: string;
}

interface SubViewSliderProps<T extends string = string> {
  views: SubView<T>[];
  activeView: T;
  onViewChange: (view: T) => void;
}

const SubViewSlider = <T extends string>({ views, activeView, onViewChange }: SubViewSliderProps<T>) => {
  const activeIndex = Math.max(0, views.findIndex((view) => view.id === activeView));
  const move = (direction: -1 | 1) => {
    const nextIndex = (activeIndex + direction + views.length) % views.length;
    onViewChange(views[nextIndex].id);
  };

  return (
    <div className="sticky top-[53px] z-40 border-b border-gray-800 bg-black/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3">
        <button
          aria-label="Previous view"
          onClick={() => move(-1)}
          className="rounded-full border border-gray-800 bg-gray-950 p-2 text-gray-300 transition hover:border-teal-500/50 hover:text-white"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {views.map((view, index) => {
            const active = view.id === activeView;
            return (
              <button
                key={view.id}
                onClick={() => onViewChange(view.id)}
                className={`min-w-[190px] rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? 'border-teal-400 bg-teal-500/10 shadow-lg shadow-teal-950/40'
                    : 'border-gray-800 bg-gray-950/70 hover:border-gray-700 hover:bg-gray-900'
                }`}
              >
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-gray-500">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {active && <span className="rounded-full bg-teal-400/20 px-2 py-0.5 text-teal-300">Active</span>}
                </div>
                <div className="mt-1 text-sm font-bold text-white">{view.label}</div>
                <div className="mt-1 line-clamp-2 text-xs text-gray-500">{view.description}</div>
              </button>
            );
          })}
        </div>
        <button
          aria-label="Next view"
          onClick={() => move(1)}
          className="rounded-full border border-gray-800 bg-gray-950 p-2 text-gray-300 transition hover:border-teal-500/50 hover:text-white"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default SubViewSlider;
