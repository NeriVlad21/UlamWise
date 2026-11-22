import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  MessageSquareShare,
  Package,
  Printer,
  RotateCcw,
  Search,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { GroceryListSummary, UserProfile } from '../types';
import { formatGroceryListText } from '../lib/grocery';
import type { Translations } from '../lib/i18n';
import { formatPhp, formatPhpCompact } from '../lib/pricing';
import { STORE_MULTIPLIERS } from '../lib/storeConfig';

interface GroceryViewProps {
  grocery: GroceryListSummary;
  profile: UserProfile;
  checkedIds: Record<string, boolean>;
  appliedSwaps: Record<string, string>;
  t: Translations;
  isGenerating?: boolean;
  onToggleChecked: (ingredientId: string) => void;
  onApplyAllSwaps: () => void;
  onRevertSwaps: () => void;
  onOptimizePlanForBudget: () => void;
  onGeneratePlan: () => void;
}

export const GroceryView: React.FC<GroceryViewProps> = ({
  grocery,
  profile,
  checkedIds,
  appliedSwaps,
  t,
  isGenerating = false,
  onToggleChecked,
  onApplyAllSwaps,
  onRevertSwaps,
  onOptimizePlanForBudget,
  onGeneratePlan,
}) => {
  const [copiedMode, setCopiedMode] = useState<'plain' | 'messenger' | null>(null);
  const [showPantryList, setShowPantryList] = useState(false);
  const [showBulkPlans, setShowBulkPlans] = useState(true);
  const [showLeftoverList, setShowLeftoverList] = useState(false);
  const [showSwapsPanel, setShowSwapsPanel] = useState(grocery.status === 'over');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const storeCfg = STORE_MULTIPLIERS[profile.preferredStore] ?? STORE_MULTIPLIERS.palengke;
  const allBuyItems = useMemo(
    () => grocery.sections.flatMap((s) => s.items),
    [grocery.sections]
  );
  const boughtCount = allBuyItems.filter((i) => checkedIds[i.ingredientId]).length;
  const hasAppliedSwaps = Object.keys(appliedSwaps).length > 0;

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return grocery.sections
      .filter((sec) => selectedSection === 'ALL' || sec.section === selectedSection)
      .map((sec) => {
        if (!q) return sec;
        const matched = sec.items.filter(
          (item) =>
            item.nameFil.toLowerCase().includes(q) ||
            item.nameEn.toLowerCase().includes(q) ||
            sec.section.toLowerCase().includes(q)
        );
        return {
          ...sec,
          items: matched,
          subtotalPhp: Number(
            matched.reduce((sum, i) => sum + i.estimatedCostPhp, 0).toFixed(2)
          ),
        };
      })
      .filter((sec) => sec.items.length > 0);
  }, [grocery.sections, searchQuery, selectedSection]);

  const statusText =
    grocery.status === 'over'
      ? t.grocery.overBudget
      : grocery.status === 'approaching'
      ? t.grocery.approachingBudget
      : t.grocery.underBudget;

  const barColor =
    grocery.status === 'over'
      ? 'bg-red-600 dark:bg-red-500'
      : grocery.status === 'approaching'
      ? 'bg-[#C9972B]'
      : 'bg-[#1B4D3E] dark:bg-[#34926F]';

  const handleCopy = async (mode: 'plain' | 'messenger') => {
    const text = formatGroceryListText(grocery, profile, checkedIds, mode);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedMode(mode);
    setTimeout(() => setCopiedMode(null), 2200);
  };

  const toggleSectionCollapse = (sectionName: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  if (allBuyItems.length === 0 && grocery.pantryCoveredItems.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-10 text-center space-y-4">
        <h1 className="text-2xl font-semibold">{t.grocery.emptyTitle}</h1>
        <p className="text-sm text-[#535E58] dark:text-[#A6B5AE] max-w-md mx-auto">
          {t.grocery.emptyDesc}
        </p>
        <button
          type="button"
          onClick={onGeneratePlan}
          className="min-h-[48px] px-6 rounded-xl bg-[#1B4D3E] text-[#FAF8F4] text-sm font-semibold"
        >
          {t.common.generatePlan}
        </button>
      </div>
    );
  }

  const totalRecommendedSavings = Number(
    grocery.recommendedSwaps.reduce((s, r) => s + r.savingsPhp, 0).toFixed(2)
  );

  return (
    <div className="space-y-6">
      {/* Print-only Header */}
      <div className="hidden print-only border-b border-gray-300 pb-3 mb-4">
        <h1 className="text-xl font-bold">UlamWise Weekly Palengke &amp; Grocery List</h1>
        <p className="text-xs">
          {profile.location.cityName}, {profile.location.provinceName} · {storeCfg.name} ·{' '}
          {grocery.plannedDaysCount} planned days · Weekly Budget: {formatPhp(grocery.weeklyBudgetPhp)} · Est. Total:{' '}
          {formatPhp(grocery.totalEstimatedPhp)}
        </p>
      </div>

      {/* Header + Export Actions */}
      <div className="no-print flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{t.grocery.title}</h1>
          <p className="mt-1 text-sm text-[#535E58] dark:text-[#A6B5AE]">
            {storeCfg.name} ({storeCfg.multiplier.toFixed(2)}×)
            {grocery.storeIsProvisional ? ` · ${t.grocery.provisionalBadge}` : ' · Dataset baseline'} ·{' '}
            {grocery.plannedDaysCount} planned {grocery.plannedDaysCount === 1 ? 'day' : 'days'} ·{' '}
            {t.grocery.boughtProgress}: {boughtCount}/{allBuyItems.length}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleCopy('plain')}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] text-xs sm:text-sm font-medium hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]"
          >
            {copiedMode === 'plain' ? (
              <Check className="w-4 h-4 text-[#1B4D3E]" />
            ) : (
              <Clipboard className="w-4 h-4" />
            )}
            <span>{copiedMode === 'plain' ? t.grocery.copied : t.grocery.copyPlain}</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy('messenger')}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] text-xs sm:text-sm font-medium hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]"
          >
            {copiedMode === 'messenger' ? (
              <Check className="w-4 h-4 text-[#1B4D3E]" />
            ) : (
              <MessageSquareShare className="w-4 h-4" />
            )}
            <span>{copiedMode === 'messenger' ? t.grocery.copied : t.grocery.copyMessenger}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] dark:bg-[#2B7A5C] text-[#FAF8F4] text-xs sm:text-sm font-medium"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>{t.grocery.printList}</span>
          </button>
        </div>
      </div>

      {/* Live Budget Summary Dashboard */}
      <section className="print-card rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-4 sm:p-5 space-y-4">
        {/* Three Distinct Reconciled Grocery Figures */}
        <div
          aria-label="Three-part grocery cost breakdown"
          className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-4 border-b border-[#EFE9DD] dark:border-[#2A3B34]"
        >
          <div className="rounded-xl border border-[#1B4D3E]/25 dark:border-[#34926F]/35 bg-[#1B4D3E]/5 dark:bg-[#1B4D3E]/15 p-3.5">
            <p className="text-xs font-medium text-[#1B4D3E] dark:text-[#86B8A3]">
              1. Est. Actual Grocery Checkout
            </p>
            <p className="mt-1 text-2xl font-semibold font-mono-tabular text-[#1B4D3E] dark:text-[#86B8A3]">
              {formatPhp(grocery.totalCheckoutCostPhp)}
            </p>
            <p className="mt-1 text-[11px] text-[#535E58] dark:text-[#A6B5AE]">
              Provisional retail pack prices at {storeCfg.name}
              {grocery.bulkSavingsPhp > 0 ? ` · saves ~${formatPhp(grocery.bulkSavingsPhp)} via bulk` : ''}
            </p>
          </div>

          <div className="rounded-xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] p-3.5">
            <p className="text-xs font-medium text-[#535E58] dark:text-[#A6B5AE]">
              2. Est. Recipe Consumption Cost
            </p>
            <p className="mt-1 text-2xl font-semibold font-mono-tabular text-[#1E2421] dark:text-[#F2EFE9]">
              {formatPhp(grocery.totalConsumptionCostPhp)}
            </p>
            <p className="mt-1 text-[11px] text-[#535E58] dark:text-[#A6B5AE]">
              Exact value of ingredients consumed this week (after pantry deductions)
            </p>
          </div>

          <div className="rounded-xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] p-3.5">
            <p className="text-xs font-medium text-[#535E58] dark:text-[#A6B5AE]">
              3. Expected Remaining Inventory
            </p>
            <p className="mt-1 text-2xl font-semibold font-mono-tabular text-[#8C6514] dark:text-[#E5BC5E]">
              {formatPhp(grocery.totalLeftoverInventoryValuePhp)}
            </p>
            <p className="mt-1 text-[11px] text-[#535E58] dark:text-[#A6B5AE]">
              {grocery.leftoverInventoryItems.length}{' '}
              {grocery.leftoverInventoryItems.length === 1 ? 'item' : 'items'} carried over for next week&apos;s pantry
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <div>
            <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">{t.home.weeklyBudget}</p>
            <p className="mt-1 text-lg sm:text-xl font-semibold font-mono-tabular">
              {formatPhpCompact(grocery.weeklyBudgetPhp)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">{t.home.remainingBudget}</p>
            <p
              className={`mt-1 text-lg sm:text-xl font-semibold font-mono-tabular ${
                grocery.remainingBudgetPhp < 0 ? 'text-red-700 dark:text-red-400' : ''
              }`}
            >
              {formatPhp(grocery.remainingBudgetPhp)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">Budget Used</p>
            <p className="mt-1 text-lg sm:text-xl font-semibold font-mono-tabular">
              {grocery.percentConsumed}%
            </p>
          </div>
          <div>
            <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">Avg / Planned Day</p>
            <p className="mt-1 text-lg sm:text-xl font-semibold font-mono-tabular">
              {formatPhp(grocery.averageSpendPerPlannedDayPhp)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">Est. / Member</p>
            <p className="mt-1 text-lg sm:text-xl font-semibold font-mono-tabular">
              {formatPhp(grocery.estimatedCostPerMemberPhp)}
            </p>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
            <span className="font-semibold">{statusText}</span>
            <span className="text-[#535E58] dark:text-[#A6B5AE]">
              Budget bar tracks actual retail checkout spend. Bought checkboxes track shopping progress.
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.min(100, Math.round(grocery.percentConsumed))}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Grocery budget progress"
            className="h-3 w-full rounded-full bg-[#EFE9DD] dark:bg-[#24332C] overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
              style={{ width: `${Math.min(100, Math.max(0, grocery.percentConsumed))}%` }}
            />
          </div>
        </div>
      </section>

      {/* Smart Bulk Buying & Portion Allocation Panel */}
      {grocery.bulkPlans.length > 0 && (
        <section
          aria-label="Smart bulk buying and portion allocation"
          className="print-card rounded-2xl border border-[#1B4D3E]/25 dark:border-[#34926F]/35 bg-[#FAF8F4] dark:bg-[#18221E] overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setShowBulkPlans((v) => !v)}
            aria-expanded={showBulkPlans}
            className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left min-h-[52px]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Package className="w-4 h-4 text-[#1B4D3E] dark:text-[#86B8A3] shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-semibold text-[#1E2421] dark:text-[#F2EFE9]">
                  Smart Bulk Buying &amp; Weekly Portion Allocation ({grocery.bulkPlans.length})
                </h2>
                <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                  Consolidated retail bundles across your week&apos;s meals
                  {grocery.bulkSavingsPhp > 0 ? ` · est. ${formatPhp(grocery.bulkSavingsPhp)} saved` : ''} · provisional prices
                </p>
              </div>
            </div>
            {showBulkPlans ? (
              <ChevronUp className="w-4 h-4 text-[#535E58] shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#535E58] shrink-0" aria-hidden="true" />
            )}
          </button>

          {showBulkPlans && (
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 border-t border-[#E4DDD0] dark:border-[#2A3B34] grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {grocery.bulkPlans.map((bp) => (
                <div
                  key={bp.id}
                  className="rounded-xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#111815] p-4 space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-[#1E2421] dark:text-[#F2EFE9]">
                        {bp.title}
                      </h3>
                      <p className="text-[#1B4D3E] dark:text-[#86B8A3] font-medium mt-0.5">
                        Buy: {bp.retailPackageLabel}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono-tabular text-sm font-semibold text-[#1E2421] dark:text-[#F2EFE9]">
                        {formatPhp(bp.estimatedBulkCostPhp)}
                      </p>
                      {bp.estimatedSavingsPhp > 0 && (
                        <p className="font-mono-tabular text-[11px] font-medium text-[#1B4D3E] dark:text-[#86B8A3]">
                          Saves ~{formatPhp(bp.estimatedSavingsPhp)}
                        </p>
                      )}
                    </div>
                  </div>

                  {(bp.edibleYieldLabel || bp.bonesOrByproductNote) && (
                    <div className="rounded-lg bg-[#F3EFE6]/80 dark:bg-[#18221E] px-3 py-2 space-y-0.5 text-[11px] text-[#535E58] dark:text-[#A6B5AE]">
                      {bp.edibleYieldLabel && <p>Yield: {bp.edibleYieldLabel}</p>}
                      {bp.bonesOrByproductNote && <p>Bonus: {bp.bonesOrByproductNote}</p>}
                    </div>
                  )}

                  {bp.allocations.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-medium text-[#1E2421] dark:text-[#F2EFE9]">
                        Portion allocation ({bp.allocations.length}{' '}
                        {bp.allocations.length === 1 ? 'use' : 'dishes'}):
                      </p>
                      <ul className="space-y-0.5 text-[#535E58] dark:text-[#A6B5AE]">
                        {bp.allocations.slice(0, 5).map((al) => (
                          <li key={al.dishId} className="flex items-center justify-between gap-2">
                            <span className="truncate">{al.dishName}</span>
                            <span className="font-mono-tabular shrink-0">{al.displayQty}</span>
                          </li>
                        ))}
                        {bp.allocations.length > 5 && (
                          <li className="text-[11px] italic text-[#535E58]/80 dark:text-[#A6B5AE]/80 pt-0.5">
                            + {bp.allocations.length - 5} more dishes across the week
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#EFE9DD] dark:border-[#24332C] space-y-1 text-[11px] text-[#535E58] dark:text-[#A6B5AE]">
                    {bp.leftoverLabel && bp.leftoverLabel !== 'None' && (
                      <p>
                        Expected leftover: <strong className="text-[#1E2421] dark:text-[#F2EFE9]">{bp.leftoverLabel}</strong>
                        {bp.leftoverValuePhp > 0 ? ` (est. ${formatPhp(bp.leftoverValuePhp)})` : ''}
                      </p>
                    )}
                    <p>Storage: {bp.storageNote}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Over-Budget Diagnostic & 1-Click Budget Optimization Panel */}
      {grocery.status === 'over' && (
        <section
          role="region"
          aria-label="Over-budget optimization guidance"
          className="no-print rounded-2xl border border-red-300/70 dark:border-red-900/70 bg-red-50/70 dark:bg-red-950/25 p-5 space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle
                className="w-5 h-5 text-red-700 dark:text-red-400 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-base font-semibold text-red-900 dark:text-red-200">
                  Over Weekly Budget by {formatPhp(grocery.overBudgetAmountPhp)}
                </h2>
                <p className="text-xs text-red-800/90 dark:text-red-300/90 mt-0.5">
                  Re-optimize unlocked meals with tipid Filipino ingredients, or apply allergen-safe ingredient swaps below.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOptimizePlanForBudget}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] dark:bg-[#2B7A5C] text-[#FAF8F4] text-xs sm:text-sm font-semibold disabled:opacity-60"
            >
              <Wand2 className="w-4 h-4" aria-hidden="true" />
              <span>{isGenerating ? 'Optimizing...' : 'Optimize Plan for Budget'}</span>
            </button>
          </div>

          {grocery.mostExpensiveItems.length > 0 && (
            <div className="pt-3 border-t border-red-200/70 dark:border-red-900/50 space-y-2">
              <p className="text-xs font-semibold text-red-900 dark:text-red-200">
                Top Cost Drivers This Week
              </p>
              <div className="flex flex-wrap gap-2">
                {grocery.mostExpensiveItems.map((item) => (
                  <span
                    key={item.ingredientId}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 dark:bg-[#18221E] border border-red-200/80 dark:border-red-900/50 px-2.5 py-1 text-xs"
                  >
                    <span className="font-medium text-[#1E2421] dark:text-[#F2EFE9]">
                      {item.nameFil}
                    </span>
                    <span className="font-mono-tabular font-semibold text-red-700 dark:text-red-300">
                      {formatPhp(item.estimatedCostPhp)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Collapsible Budget-Saving Substitutions Panel */}
      {(grocery.recommendedSwaps.length > 0 || hasAppliedSwaps) && (
        <section className="no-print rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#F3EFE6]/70 dark:bg-[#18221E] overflow-hidden">
          <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowSwapsPanel((v) => !v)}
              aria-expanded={showSwapsPanel}
              className="flex items-center gap-2 text-left min-h-[44px] flex-1 min-w-[200px]"
            >
              <Sparkles className="w-4 h-4 text-[#C9972B] shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-sm sm:text-base font-semibold">
                  {t.grocery.recommendedSwapsTitle}
                  {grocery.recommendedSwaps.length > 0
                    ? ` · Save est. ${formatPhp(totalRecommendedSavings)}`
                    : ''}
                </h2>
                <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                  {grocery.recommendedSwaps.length > 0
                    ? `${grocery.recommendedSwaps.length} allergen-safe Filipino ingredient swaps available`
                    : 'Budget-saving swaps are currently applied to your list.'}
                </p>
              </div>
              {showSwapsPanel ? (
                <ChevronUp className="w-4 h-4 text-[#535E58] shrink-0 ml-auto" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#535E58] shrink-0 ml-auto" aria-hidden="true" />
              )}
            </button>

            <div className="flex items-center gap-2">
              {hasAppliedSwaps && (
                <button
                  type="button"
                  onClick={onRevertSwaps}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#111815] text-xs font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t.grocery.revertSwaps}</span>
                </button>
              )}
              {grocery.recommendedSwaps.length > 0 && (
                <button
                  type="button"
                  onClick={onApplyAllSwaps}
                  className="min-h-[44px] px-4 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] dark:bg-[#2B7A5C] text-[#FAF8F4] text-xs sm:text-sm font-semibold"
                >
                  {t.grocery.applyAllSwaps}
                </button>
              )}
            </div>
          </div>

          {showSwapsPanel && grocery.recommendedSwaps.length > 0 && (
            <ul className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-2 text-xs border-t border-[#E4DDD0] dark:border-[#2A3B34] pt-3">
              {grocery.recommendedSwaps.map((rec) => (
                <li
                  key={rec.id}
                  className="rounded-xl bg-white dark:bg-[#111815] border border-[#E4DDD0] dark:border-[#2A3B34] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-medium">{rec.fromName}</span> →{' '}
                    <strong className="text-[#1B4D3E] dark:text-[#86B8A3]">{rec.toName}</strong>
                    <span className="block text-[#535E58] dark:text-[#A6B5AE] mt-0.5">{rec.note}</span>
                  </div>
                  <span className="font-mono-tabular font-semibold text-[#1B4D3E] dark:text-[#86B8A3]">
                    Save {formatPhp(rec.savingsPhp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Search + Section Filter Bar */}
      <div className="no-print space-y-3">
        <div className="relative">
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#535E58]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ingredients (e.g., manok, bawang, bigas)..."
            aria-label="Search grocery ingredients"
            className="w-full min-h-[46px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] pl-10 pr-4 text-sm"
          />
        </div>

        <div
          role="tablist"
          aria-label="Filter by market section"
          className="flex gap-1.5 overflow-x-auto pb-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedSection === 'ALL'}
            onClick={() => setSelectedSection('ALL')}
            className={`min-h-[40px] px-3.5 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              selectedSection === 'ALL'
                ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                : 'border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]'
            }`}
          >
            All ({allBuyItems.length})
          </button>
          {grocery.sections.map((sec) => {
            const active = selectedSection === sec.section;
            return (
              <button
                key={sec.section}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedSection(sec.section)}
                className={`min-h-[40px] px-3.5 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                    : 'border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]'
                }`}
              >
                {sec.section} ({sec.items.length})
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsible Grouped Grocery Sections */}
      {filteredSections.length === 0 ? (
        <div className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-8 text-center text-sm text-[#535E58] dark:text-[#A6B5AE]">
          No grocery items match &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {filteredSections.map((sec) => {
            const isCollapsed = Boolean(collapsedSections[sec.section]);
            const secBought = sec.items.filter((i) => checkedIds[i.ingredientId]).length;
            return (
              <section
                key={sec.section}
                className="print-card rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleSectionCollapse(sec.section)}
                  aria-expanded={!isCollapsed}
                  className="w-full px-5 py-3.5 bg-[#F3EFE6]/70 dark:bg-[#1F2C27] border-b border-[#E4DDD0] dark:border-[#2A3B34] flex items-center justify-between gap-2 text-left min-h-[52px]"
                >
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold truncate">{sec.section}</h2>
                    <p className="text-[11px] text-[#535E58] dark:text-[#A6B5AE]">
                      {secBought}/{sec.items.length} bought
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-tabular text-sm font-semibold text-[#1B4D3E] dark:text-[#86B8A3]">
                      {formatPhp(sec.subtotalPhp)}
                    </span>
                    {isCollapsed ? (
                      <ChevronDown className="w-4 h-4 text-[#535E58]" aria-hidden="true" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-[#535E58]" aria-hidden="true" />
                    )}
                  </div>
                </button>

                {!isCollapsed && (
                  <ul className="divide-y divide-[#EFE9DD] dark:divide-[#2A3B34]">
                    {sec.items.map((item) => {
                      const isBought = Boolean(checkedIds[item.ingredientId]);
                      return (
                        <li key={item.ingredientId}>
                          <label
                            className={`flex items-start gap-3.5 px-4 sm:px-5 py-3.5 cursor-pointer hover:bg-[#FAF8F4] dark:hover:bg-[#151E1A] transition-colors min-h-[60px] ${
                              isBought ? 'opacity-60' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isBought}
                              onChange={() => onToggleChecked(item.ingredientId)}
                              className="mt-1 h-5 w-5 accent-[#1B4D3E] shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-sm font-medium ${
                                  isBought
                                    ? 'line-through text-[#535E58] dark:text-[#A6B5AE]'
                                    : 'text-[#1E2421] dark:text-[#F2EFE9]'
                                }`}
                              >
                                {item.nameFil}
                                {item.nameEn.toLowerCase() !== item.nameFil.toLowerCase() && (
                                  <span className="text-xs font-normal text-[#535E58] dark:text-[#A6B5AE]">
                                    {' '}
                                    · {item.nameEn}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs font-medium text-[#1B4D3E] dark:text-[#86B8A3] mt-0.5">
                                Buy: {item.retailPackageLabel}
                              </p>
                              <p className="text-[11px] font-mono-tabular text-[#535E58] dark:text-[#A6B5AE] mt-0.5">
                                Recipe needs {item.displayQty} {item.displayUnit} (est. {formatPhp(item.consumptionCostPhp)})
                                {item.leftoverBaseQty > 0.01 &&
                                  ` · leftover ~${item.leftoverDisplayLabel} (${formatPhp(item.leftoverValuePhp)})`}
                                {item.pantryDeductedBaseQty > 0 && ' · pantry deducted'}
                                {item.swappedFromName && ` · swapped from ${item.swappedFromName}`}
                              </p>
                              {item.bulkNote && (
                                <p className="text-[11px] text-[#8C6514] dark:text-[#E5BC5E] mt-0.5">
                                  {item.bulkNote}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="block font-mono-tabular text-sm font-semibold text-[#1E2421] dark:text-[#F2EFE9]">
                                {formatPhp(item.packageCostPhp)}
                              </span>
                              <span className="block text-[10px] text-[#535E58] dark:text-[#A6B5AE]">
                                est. pack
                              </span>
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Expected Leftover Pantry Inventory Drawer */}
      {grocery.leftoverInventoryItems.length > 0 && (
        <section className="no-print rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#18221E] p-4">
          <button
            type="button"
            onClick={() => setShowLeftoverList((v) => !v)}
            aria-expanded={showLeftoverList}
            className="w-full flex items-center justify-between gap-2 text-left min-h-[44px]"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#8C6514] dark:text-[#E5BC5E]">
              <Package className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                Expected Remaining Pantry Inventory ({grocery.leftoverInventoryItems.length} items · est.{' '}
                {formatPhp(grocery.totalLeftoverInventoryValuePhp)})
              </span>
            </span>
            <span className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
              {showLeftoverList ? 'Hide' : 'Show'}
            </span>
          </button>

          {showLeftoverList && (
            <div className="mt-3 pt-3 border-t border-[#E4DDD0] dark:border-[#2A3B34] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {grocery.leftoverInventoryItems.map((left) => (
                <div
                  key={left.ingredientId}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-[#111815] border border-[#E4DDD0] dark:border-[#2A3B34] px-3 py-2"
                >
                  <span className="truncate font-medium text-[#1E2421] dark:text-[#F2EFE9]">
                    {left.nameFil}
                  </span>
                  <span className="font-mono-tabular text-[#535E58] dark:text-[#A6B5AE] shrink-0">
                    ~{left.leftoverDisplayLabel} · {formatPhp(left.leftoverValuePhp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Pantry-Covered Items Summary */}
      {grocery.pantryCoveredItems.length > 0 && (
        <section className="no-print rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#EDF3EF]/60 dark:bg-[#18221E] p-4">
          <button
            type="button"
            onClick={() => setShowPantryList((v) => !v)}
            aria-expanded={showPantryList}
            className="w-full flex items-center justify-between gap-2 text-left min-h-[44px]"
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#1B4D3E] dark:text-[#86B8A3]">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {t.grocery.pantryDeductedTitle} ({grocery.pantryCoveredItems.length})
              </span>
            </span>
            <span className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
              {showPantryList ? 'Hide' : 'Show'}
            </span>
          </button>

          {showPantryList && (
            <div className="mt-3 pt-3 border-t border-[#D8CFC0] dark:border-[#2A3B34] flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[#535E58] dark:text-[#A6B5AE]">
              {grocery.pantryCoveredItems.map((item) => (
                <span key={item.ingredientId}>
                  {item.nameFil} ({item.displayQty} {item.displayUnit})
                </span>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
