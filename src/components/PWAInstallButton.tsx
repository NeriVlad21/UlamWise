import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return (
      <span className="text-xs text-[#4E7A68] dark:text-[#86B8A3]">
        Installed on device
      </span>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#1B4D3E] text-[#FAF8F4] font-medium hover:bg-[#143B2F] dark:bg-[#2B7A5C] dark:hover:bg-[#24664D] transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Install UlamWise App</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowIOSGuide(true)}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] text-[#1E2421] dark:text-[#F2EFE9] font-medium hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27] transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
        }`}
      >
        <Smartphone className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{isIOS ? 'Install on iPhone / iPad' : 'Install as Mobile App'}</span>
      </button>

      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install UlamWise on your device"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#18221E] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-[#1E2421] dark:text-[#F2EFE9]">
                Install UlamWise
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Close install instructions"
                className="min-h-[44px] min-w-[44px] -mt-2 -mr-2 flex items-center justify-center rounded-xl text-[#535E58] hover:bg-[#F3EFE6] dark:text-[#A6B5AE] dark:hover:bg-[#1F2C27]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-[#535E58] dark:text-[#A6B5AE] leading-relaxed">
              {isIOS
                ? '1. Tap the Share button in Safari.\n2. Scroll down and tap "Add to Home Screen".'
                : 'Open your browser menu (⋮) and choose "Add to Home screen" or "Install app" for offline palengke access.'}
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-[#1B4D3E] text-[#FAF8F4] text-sm font-medium hover:bg-[#143B2F] dark:bg-[#2B7A5C]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
