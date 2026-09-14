'use client';

import React, { useRef } from 'react';
import { Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { DeskCard } from './DeskCard';

export interface SpotlightsSectionProps {
  title?: string;
  onInfoClick?: () => void;
  children: React.ReactNode;
  isCarousel?: boolean;
  className?: string;
}

/**
 * SpotlightsSection: The standard top metric container with "Spotlights" title,
 * Info icon, and grid or scrollable carousel layout.
 */
export const SpotlightsSection: React.FC<SpotlightsSectionProps> = ({
  title = 'Spotlights',
  onInfoClick,
  children,
  isCarousel = false,
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <DeskCard className={`space-y-3.5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-800 font-semibold text-[14px]">
          <span>{title}</span>
          <Info
            onClick={onInfoClick}
            className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-600 transition-colors"
          />
        </div>

        {/* Carousel controls if carousel enabled */}
        {isCarousel && (
          <div className="flex items-center gap-1 text-slate-500">
            <button
              type="button"
              onClick={() => scrollCarousel('left')}
              className="p-1 hover:bg-slate-100 rounded-full cursor-pointer transition-colors border border-slate-200"
              title="Previous spotlights"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
            </button>
            <button
              type="button"
              onClick={() => scrollCarousel('right')}
              className="p-1 hover:bg-slate-100 rounded-full cursor-pointer transition-colors border border-slate-200"
              title="Next spotlights"
            >
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>
        )}
      </div>

      {/* Content Container */}
      {isCarousel ? (
        <div
          ref={scrollRef}
          className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none"
        >
          {children}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-center gap-3 sm:gap-4">
          {children}
        </div>
      )}
    </DeskCard>
  );
};
