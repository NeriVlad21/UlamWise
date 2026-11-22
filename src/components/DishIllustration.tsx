import React from 'react';
import type { Dish } from '../types';

interface DishIllustrationProps {
  dish: Dish;
  size?: 'sm' | 'md';
}

/**
 * Lightweight, domain-authentic Filipino culinary vector illustration.
 * Uses zero external image hosts for instant rendering on low-end Android devices
 * and slow Philippine mobile networks.
 */
export const DishIllustration: React.FC<DishIllustrationProps> = ({ dish, size = 'md' }) => {
  const method = dish.method.toLowerCase();
  const protein = dish.main_protein.toLowerCase();

  let bgClass = 'bg-[#EDF3EF] dark:bg-[#1E2E27]';
  let accentStroke = '#1B4D3E';
  let warmFill = '#EAB949';

  if (protein === 'fish' || protein === 'seafood') {
    bgClass = 'bg-[#E9F2F0] dark:bg-[#1A2C2B]';
    accentStroke = '#1E5B53';
    warmFill = '#D9A73E';
  } else if (protein === 'plant' || protein === 'veg' || protein === 'legume') {
    bgClass = 'bg-[#EDF4EA] dark:bg-[#1C2D21]';
    accentStroke = '#2E6240';
    warmFill = '#C8A236';
  } else if (protein === 'snack' || protein === 'grain') {
    bgClass = 'bg-[#F8F1E1] dark:bg-[#2B251A]';
    accentStroke = '#8C6214';
    warmFill = '#E5B23F';
  } else if (protein === 'beef' || protein === 'pork') {
    bgClass = 'bg-[#F4EEE4] dark:bg-[#2A231D]';
    accentStroke = '#6E4726';
    warmFill = '#D99E30';
  }

  const isSoup = method.includes('soup') || method.includes('porridge') || method.includes('noodle');
  const isFish = protein === 'fish' || protein === 'seafood';
  const isGrillOrFry = method.includes('fry') || method.includes('grill');
  const isVeg = protein === 'plant' || protein === 'veg' || protein === 'legume';

  const dim = size === 'sm' ? 'w-14 h-14' : 'w-16 h-16';

  return (
    <div
      aria-hidden="true"
      className={`${dim} ${bgClass} rounded-xl shrink-0 flex items-center justify-center border border-[#E4DDD0]/70 dark:border-[#2A3B34]`}
    >
      <svg viewBox="0 0 64 64" className="w-10 h-10" fill="none">
        {isSoup ? (
          <>
            <path d="M12 32h40c0 12-9 20-20 20s-20-8-20-20z" fill={accentStroke} fillOpacity="0.16" stroke={accentStroke} strokeWidth="2.4" strokeLinejoin="round" />
            <ellipse cx="32" cy="32" rx="20" ry="4.5" fill={warmFill} fillOpacity="0.45" stroke={accentStroke} strokeWidth="2.2" />
            <path d="M23 21c0-4 3-5 3-9M32 19c0-4 3-5 3-9M41 21c0-4 3-5 3-9" stroke={accentStroke} strokeWidth="2.2" strokeLinecap="round" />
          </>
        ) : isFish ? (
          <>
            <path d="M12 34c7-11 22-14 34-4l8-6v20l-8-6c-12 10-27 7-34-4z" fill={accentStroke} fillOpacity="0.18" stroke={accentStroke} strokeWidth="2.4" strokeLinejoin="round" />
            <circle cx="21" cy="32" r="2" fill={accentStroke} />
            <path d="M28 28c2 4 2 8 0 12M35 28c2 4 2 8 0 12" stroke={warmFill} strokeWidth="2.2" strokeLinecap="round" />
          </>
        ) : isVeg ? (
          <>
            <path d="M16 44c0-16 14-26 32-26-2 18-12 30-28 30-2 0-4-2-4-4z" fill={accentStroke} fillOpacity="0.18" stroke={accentStroke} strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M14 48L42 22" stroke={accentStroke} strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="24" cy="24" r="4.5" fill={warmFill} fillOpacity="0.65" />
          </>
        ) : isGrillOrFry ? (
          <>
            <circle cx="32" cy="34" r="18" fill={accentStroke} fillOpacity="0.12" stroke={accentStroke} strokeWidth="2.4" />
            <circle cx="32" cy="34" r="11" fill={warmFill} fillOpacity="0.4" stroke={accentStroke} strokeWidth="2" />
            <path d="M26 30l12 8M26 38l12-8" stroke={accentStroke} strokeWidth="2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M14 33h36v3c0 10-8 16-18 16s-18-6-18-16v-3z" fill={accentStroke} fillOpacity="0.18" stroke={accentStroke} strokeWidth="2.4" />
            <path d="M18 33c2-7 8-12 14-12s12 5 14 12" fill={warmFill} fillOpacity="0.4" stroke={accentStroke} strokeWidth="2.2" />
            <circle cx="32" cy="18" r="3" fill={accentStroke} />
          </>
        )}
      </svg>
    </div>
  );
};
