import React from 'react';
import {
  CalendarDays,
  Home,
  Package,
  Settings,
  ShoppingBasket,
  WifiOff,
} from 'lucide-react';
import type { Translations } from '../lib/i18n';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export type ActiveTab = 'home' | 'mealPlan' | 'grocery' | 'pantry' | 'settings';

interface LayoutProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onPrimaryAction: () => void;
  primaryActionLabel: string;
  isGenerating: boolean;
  t: Translations;
  children: React.ReactNode;
}

export const UlamWiseLogoMark: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
    <rect width="40" height="40" rx="10" className="fill-[#1B4D3E] dark:fill-[#2B7A5C]" />
    <path d="M9.5 22h21c0 5.8-4.7 10.5-10.5 10.5S9.5 27.8 9.5 22z" fill="#FAF8F4" />
    <rect x="8" y="19.5" width="24" height="2.8" rx="1.4" fill="#EAB949" />
    <path
      d="M14.5 16.5c0-2 1.5-2.6 1.5-4.5M20 15.8c0-2.3 1.5-3 1.5-5M25.5 16.5c0-2 1.5-2.6 1.5-4.5"
      stroke="#FAF8F4"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const Layout: React.FC<LayoutProps> = ({
  activeTab,
  onSelectTab,
  onPrimaryAction,
  primaryActionLabel,
  isGenerating,
  t,
  children,
}) => {
  const isOnline = useOnlineStatus();

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    mobileLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'home', label: t.nav.home, mobileLabel: t.nav.home, icon: Home },
    { id: 'mealPlan', label: t.nav.mealPlan, mobileLabel: 'Plan', icon: CalendarDays },
    { id: 'grocery', label: t.nav.grocery, mobileLabel: t.nav.grocery, icon: ShoppingBasket },
    { id: 'pantry', label: t.nav.pantry ?? 'Pantry', mobileLabel: t.nav.pantry ?? 'Pantry', icon: Package },
    { id: 'settings', label: t.nav.settings, mobileLabel: t.nav.settings, icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4] text-[#1E2421] dark:bg-[#111815] dark:text-[#F2EFE9]">
      {/* Desktop & Mobile Compact Top Bar — Strict 3-Zone Contract */}
      <header className="no-print sticky top-0 z-30 border-b border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4]/95 dark:bg-[#111815]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-4 md:gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className="inline-flex items-center gap-2 text-left whitespace-nowrap shrink-0 min-h-[44px] focus-visible:outline-2 focus-visible:outline-[#1B4D3E]"
          >
            <UlamWiseLogoMark className="w-7 h-7 shrink-0" />
            <span className="font-display text-lg font-semibold tracking-tight text-[#1B4D3E] dark:text-[#F2EFE9]">
              UlamWise
            </span>
          </button>

          {/* Zone 2: Clean Single-Line Nav Links (Desktop) */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors min-h-[44px] flex items-center ${
                    active
                      ? 'text-[#1B4D3E] dark:text-[#E5B54A]'
                      : 'text-[#535E58] hover:text-[#1E2421] dark:text-[#A6B5AE] dark:hover:text-[#F2EFE9]'
                  }`}
                >
                  <span>{item.label}</span>
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-1.5 left-0 right-0 h-0.5 rounded-full bg-[#1B4D3E] dark:bg-[#E5B54A]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action (visually secondary on Meal Plan so cards lead) */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={onPrimaryAction}
              disabled={isGenerating}
              className={`inline-flex items-center justify-center rounded-xl px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-[44px] disabled:opacity-60 ${
                activeTab === 'mealPlan'
                  ? 'border border-[#1B4D3E] dark:border-[#34926F] text-[#1B4D3E] dark:text-[#86B8A3] hover:bg-[#1B4D3E]/8'
                  : 'bg-[#1B4D3E] hover:bg-[#143B2F] text-[#FAF8F4] dark:bg-[#2B7A5C] dark:hover:bg-[#23654B]'
              }`}
            >
              {isGenerating ? t.common.loading : primaryActionLabel}
            </button>
          </div>
        </div>
      </header>

      {/* Offline Banner */}
      {!isOnline && (
        <div
          role="status"
          className="no-print bg-[#C9972B]/15 border-b border-[#C9972B]/40 text-[#6F4F09] dark:text-[#F0CB73] px-4 py-2 text-xs font-medium flex items-center justify-center gap-2"
        >
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Offline Mode — Local Filipino dataset, meal plans, and grocery checklist remain available.</span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-5 md:py-8 pb-24 md:pb-12">
        {children}
      </main>

      {/* Required Footer Disclaimer */}
      <footer className="no-print border-t border-[#E4DDD0] dark:border-[#2A3B34] bg-[#F3EFE6]/60 dark:bg-[#151E1A] pb-20 md:pb-8 pt-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] leading-relaxed max-w-3xl">
            {t.disclaimers.footer}
          </p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar — Fixed Thumb Zone (Home, Meal Plan, Grocery, Pantry, Settings) */}
      <nav
        aria-label="Mobile navigation"
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4]/95 dark:bg-[#111815]/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 min-h-[48px] px-1 py-1.5 transition-colors ${
                  active
                    ? 'text-[#1B4D3E] dark:text-[#E5B54A] font-semibold'
                    : 'text-[#535E58] dark:text-[#A6B5AE]'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span className="text-[11px] leading-tight truncate max-w-full">
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
