import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DetectedIngredient,
  Dish,
  MealSelectionMode,
  MealSlot,
  PantryItem,
  PlannedMeal,
  PlanRelaxationOptions,
  PsgcDataset,
  SavedWeeklyPlan,
  UserProfile,
  WeeklyMealPlan,
} from './types';
import { getBrowserDataset } from './lib/datasetBrowser';
import { generateGroceryList } from './lib/grocery';
import { getTranslations } from './lib/i18n';
import {
  generateDeterministicWeeklyPlan,
  regenerateSingleMeal,
} from './lib/planner';
import { getDefaultPsgcDataset } from './lib/psgc';
import {
  createAutostartDemoProfile,
  createDefaultProfile,
  loadAppliedSwaps,
  loadCheckedGrocery,
  loadCustomPsgc,
  loadFavorites,
  loadProfile,
  loadSavedPlans,
  loadTheme,
  loadValidatedMealPlan,
  resetAllLocalData,
  saveAppliedSwaps,
  saveCheckedGrocery,
  saveCustomPsgc,
  saveFavorites,
  saveMealPlan,
  saveProfile,
  saveSavedPlans,
  saveTheme,
} from './lib/storage';
import { isCachedMealPlanValid } from './lib/variety';
import { GroceryView } from './components/GroceryView';
import { HomeView } from './components/HomeView';
import { Layout, type ActiveTab } from './components/Layout';
import { MealPlanView } from './components/MealPlanView';
import { OnboardingWizard } from './components/OnboardingWizard';
import { RecipeDetailModal } from './components/RecipeDetailModal';
import type { SettingsSectionId } from './components/SettingsView';

const PantryView = React.lazy(() =>
  import('./components/PantryView').then((m) => ({ default: m.PantryView }))
);
const SettingsView = React.lazy(() =>
  import('./components/SettingsView').then((m) => ({ default: m.SettingsView }))
);

export function App() {
  const dataset = useMemo(() => getBrowserDataset(), []);

  const [psgc, setPsgc] = useState<PsgcDataset>(
    () => loadCustomPsgc() ?? getDefaultPsgcDataset()
  );

  const [profile, setProfile] = useState<UserProfile>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const existing = loadProfile();
      if (existing.onboardingCompleted) return existing;
      const demo = createAutostartDemoProfile();
      saveProfile(demo);
      return demo;
    }
    return loadProfile();
  });

  const initialPlanLoad = useMemo(() => {
    const validated = loadValidatedMealPlan(profile, dataset);
    if (validated.plan) return validated;

    // If a stale invalid cached plan was cleared on load for a completed profile,
    // immediately generate a clean validated schedule using the local engine (preserving all user data).
    if (validated.invalidatedStaleCache && profile.onboardingCompleted) {
      const fresh = generateDeterministicWeeklyPlan(profile, dataset, {
        seed: Date.now(),
      });
      saveMealPlan(fresh);
      return { plan: fresh, invalidatedStaleCache: true };
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const demoProfile = loadProfile().onboardingCompleted
        ? loadProfile()
        : createAutostartDemoProfile();
      const seeded = generateDeterministicWeeklyPlan(demoProfile, dataset, {
        seed: 2026,
      });
      saveMealPlan(seeded);
      return { plan: seeded, invalidatedStaleCache: false };
    }
    return { plan: null, invalidatedStaleCache: validated.invalidatedStaleCache };
    // Run only once on initial boot with initial profile & dataset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [plan, setPlan] = useState<WeeklyMealPlan | null>(() => initialPlanLoad.plan);
  const [actionFeedback, setActionFeedback] = useState<string | null>(() =>
    initialPlanLoad.invalidatedStaleCache
      ? 'Cleared a previously cached invalid meal plan and refreshed your schedule while keeping your household profile, allergies, pantry, and settings intact.'
      : null
  );

  const [checkedGrocery, setCheckedGrocery] = useState<Record<string, boolean>>(() =>
    loadCheckedGrocery()
  );
  const [appliedSwaps, setAppliedSwaps] = useState<Record<string, string>>(() =>
    loadAppliedSwaps()
  );
  const [savedPlans, setSavedPlans] = useState<SavedWeeklyPlan[]>(() => loadSavedPlans());
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadTheme());
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [pantryInitialSubTab, setPantryInitialSubTab] = useState<'inventory' | 'scan'>('inventory');
  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSectionId | null>(
    null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<{
    dish: Dish;
    meal?: PlannedMeal;
  } | null>(null);

  const t = useMemo(() => getTranslations(profile.language), [profile.language]);

  // Sync theme to document root & localStorage
  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  // Auto-persist profile changes
  const updateProfile = useCallback((next: UserProfile) => {
    setProfile(next);
    saveProfile(next);
  }, []);

  // Derived grocery list always synced with plan, schedule, household, location, store, pantry & swaps
  const grocery = useMemo(
    () => generateGroceryList(plan, profile, dataset, appliedSwaps),
    [plan, profile, dataset, appliedSwaps]
  );

  // Request schedule-aware meal plan from backend Gemini API with deterministic offline/fallback guarantee
  const generateWeeklyPlan = useCallback(
    async (
      targetProfile: UserProfile,
      keepLockedFrom?: WeeklyMealPlan | null,
      options?: PlanRelaxationOptions & { optimizeForBudget?: boolean }
    ) => {
      setIsGenerating(true);
      setActionFeedback(null);
      const safeExistingPlan =
        keepLockedFrom && keepLockedFrom.validationStatus !== 'insufficient_recipes'
          ? keepLockedFrom
          : null;
      const relaxationOpts = {
        allowRelaxCookTime: Boolean(options?.allowRelaxCookTime),
        allowRelaxRegional: Boolean(options?.allowRelaxRegional),
        allowShorterPlan: Boolean(options?.allowShorterPlan),
      };
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 24000);
        const res = await fetch('/api/meal-plan/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: targetProfile,
            existingPlan: safeExistingPlan,
            optimizeForBudget: Boolean(options?.optimizeForBudget),
            ...relaxationOpts,
          }),
          signal: controller.signal,
        });
        window.clearTimeout(timer);

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        const data = (await res.json()) as { plan?: WeeklyMealPlan };
        if (!data.plan || !Array.isArray(data.plan.days) || data.plan.days.length !== 7) {
          throw new Error('Incomplete meal plan payload');
        }
        // Final client-side safety verification: never accept an invalid schedule from any source
        if (
          data.plan.validationStatus !== 'insufficient_recipes' &&
          !isCachedMealPlanValid(data.plan, targetProfile, dataset)
        ) {
          throw new Error('Received schedule failed local constraint verification');
        }
        setPlan(data.plan);
        saveMealPlan(data.plan);
        setAppliedSwaps({});
        saveAppliedSwaps({});
      } catch {
        const fallbackPlan = generateDeterministicWeeklyPlan(targetProfile, dataset, {
          existingPlan: safeExistingPlan,
          optimizeForBudget: Boolean(options?.optimizeForBudget),
          ...relaxationOpts,
          fallbackReason:
            'Generated locally using the verified UlamWise Filipino regional dataset.',
        });
        setPlan(fallbackPlan);
        saveMealPlan(fallbackPlan);
        setAppliedSwaps({});
        saveAppliedSwaps({});
      } finally {
        setIsGenerating(false);
      }
    },
    [dataset]
  );

  const handleCompleteOnboarding = async (finalProfile: UserProfile) => {
    updateProfile(finalProfile);
    setActiveTab('mealPlan');
    await generateWeeklyPlan(finalProfile, null);
  };

  const handleToggleLock = (dayIndex: number, slot: MealSlot) => {
    if (!plan) return;
    const next: WeeklyMealPlan = {
      ...plan,
      days: plan.days.map((d) =>
        d.dayIndex !== dayIndex
          ? d
          : {
              ...d,
              meals: d.meals.map((m) =>
                m.slot === slot ? { ...m, locked: !m.locked } : m
              ),
            }
      ),
    };
    setPlan(next);
    saveMealPlan(next);
  };

  const handleRegenerateSingleMeal = (dayIndex: number, slot: MealSlot) => {
    if (!plan) return;
    const res = regenerateSingleMeal(plan, dayIndex, slot, profile, dataset);
    if (res.replaced) {
      setActionFeedback(null);
      setPlan(res.plan);
      saveMealPlan(res.plan);
    } else if (res.message) {
      setActionFeedback(res.message);
    }
  };

  const handleSwapMeal = (dayIndex: number, slot: MealSlot, newDishId: string) => {
    if (!plan) return;
    const res = regenerateSingleMeal(plan, dayIndex, slot, profile, dataset, newDishId);
    if (res.replaced) {
      setActionFeedback(null);
      setPlan(res.plan);
      saveMealPlan(res.plan);
    } else if (res.message) {
      setActionFeedback(res.message);
    }
  };

  const handleChangeMode = (mode: MealSelectionMode) => {
    const next = { ...profile, mealMode: mode };
    updateProfile(next);
    if (plan) {
      void generateWeeklyPlan(next, plan);
    }
  };

  const handleToggleFavorite = (dishId: string) => {
    const next = favorites.includes(dishId)
      ? favorites.filter((id) => id !== dishId)
      : [...favorites, dishId];
    setFavorites(next);
    saveFavorites(next);
  };

  const handleSaveCurrentPlan = () => {
    if (!plan || plan.validationStatus === 'insufficient_recipes') return;
    const entry: SavedWeeklyPlan = {
      id: `saved-${Date.now()}`,
      title: `${profile.location.cityName} · ${profile.budgetPreset.charAt(0).toUpperCase() + profile.budgetPreset.slice(1)} Week`,
      savedAt: new Date().toISOString(),
      locationLabel: `${profile.location.cityName}, ${profile.location.provinceName}`,
      weeklyBudgetPhp: profile.weeklyBudgetPhp,
      estimatedTotalPhp: grocery.totalEstimatedPhp,
      plan,
    };
    const next = [entry, ...savedPlans].slice(0, 15);
    setSavedPlans(next);
    saveSavedPlans(next);
  };

  const handleLoadSavedPlan = (saved: SavedWeeklyPlan) => {
    if (!isCachedMealPlanValid(saved.plan, profile, dataset)) {
      setActionFeedback(
        'That saved plan no longer matches your current allergy, dietary, schedule, or variety rules. Generate a fresh valid plan instead.'
      );
      return;
    }
    setActionFeedback(null);
    setPlan(saved.plan);
    saveMealPlan(saved.plan);
    setAppliedSwaps({});
    saveAppliedSwaps({});
  };

  const handleDeleteSavedPlan = (id: string) => {
    const next = savedPlans.filter((p) => p.id !== id);
    setSavedPlans(next);
    saveSavedPlans(next);
  };

  const handleToggleGroceryChecked = (ingredientId: string) => {
    const next = { ...checkedGrocery, [ingredientId]: !checkedGrocery[ingredientId] };
    setCheckedGrocery(next);
    saveCheckedGrocery(next);
  };

  const handleApplyAllSwaps = () => {
    const next = { ...appliedSwaps };
    for (const rec of grocery.recommendedSwaps) {
      next[rec.fromIngredientId] = rec.toIngredientId;
    }
    setAppliedSwaps(next);
    saveAppliedSwaps(next);
  };

  const handleRevertSwaps = () => {
    setAppliedSwaps({});
    saveAppliedSwaps({});
  };

  const handleUpdatePantry = (nextPantry: PantryItem[]) => {
    updateProfile({ ...profile, pantry: nextPantry });
  };

  const handleAddScannedItemsToPantry = (items: DetectedIngredient[]) => {
    const existingIds = new Set(profile.pantry.map((p) => p.ingredientId).filter(Boolean));
    const existingNames = new Set(profile.pantry.map((p) => p.name.toLowerCase()));
    const additions: PantryItem[] = [];
    for (const it of items) {
      if (it.matchedIngredientId && existingIds.has(it.matchedIngredientId)) continue;
      if (existingNames.has(it.name.toLowerCase())) continue;
      additions.push({
        id: `p-scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ingredientId: it.matchedIngredientId,
        name: it.name,
        sufficient: true,
      });
    }
    if (additions.length > 0) {
      updateProfile({ ...profile, pantry: [...profile.pantry, ...additions] });
    }
  };

  const handleImportPsgc = (nextPsgc: PsgcDataset) => {
    setPsgc(nextPsgc);
    saveCustomPsgc(nextPsgc);
  };

  const handleResetAll = () => {
    resetAllLocalData();
    const fresh = createDefaultProfile();
    setProfile(fresh);
    setPlan(null);
    setCheckedGrocery({});
    setAppliedSwaps({});
    setSavedPlans([]);
    setFavorites([]);
    setActiveTab('home');
  };

  const openScheduleSettings = () => {
    setSettingsInitialSection('schedule');
    setActiveTab('settings');
  };

  const openFridgeScan = () => {
    setPantryInitialSubTab('scan');
    setActiveTab('pantry');
  };

  // Show multi-step Onboarding Wizard until completed
  if (!profile.onboardingCompleted) {
    return (
      <OnboardingWizard
        profile={profile}
        psgc={psgc}
        dataset={dataset}
        onUpdateProfile={updateProfile}
        onComplete={handleCompleteOnboarding}
        isGenerating={isGenerating}
      />
    );
  }

  return (
    <Layout
      activeTab={activeTab}
      onSelectTab={(tab) => {
        if (tab === 'pantry') setPantryInitialSubTab('inventory');
        if (tab === 'settings') setSettingsInitialSection(null);
        setActiveTab(tab);
      }}
      onPrimaryAction={() => {
        setActiveTab('mealPlan');
        void generateWeeklyPlan(profile, plan);
      }}
      primaryActionLabel={plan ? t.common.regenerateWeek : t.common.generatePlan}
      isGenerating={isGenerating}
      t={t}
    >
      {activeTab === 'home' && (
        <HomeView
          profile={profile}
          plan={plan}
          grocery={grocery}
          dataset={dataset}
          t={t}
          onGeneratePlan={() => {
            setActiveTab('mealPlan');
            void generateWeeklyPlan(profile, plan);
          }}
          onOpenMealPlan={() => setActiveTab('mealPlan')}
          onOpenGrocery={() => setActiveTab('grocery')}
          onOpenFridgeScan={openFridgeScan}
          onEditSchedule={openScheduleSettings}
          onSelectDish={(dish, meal) => setSelectedRecipe({ dish, meal })}
          isGenerating={isGenerating}
        />
      )}

      {activeTab === 'mealPlan' && (
        <MealPlanView
          profile={profile}
          plan={plan}
          dataset={dataset}
          t={t}
          isGenerating={isGenerating}
          favorites={favorites}
          savedPlans={savedPlans}
          actionFeedback={actionFeedback}
          onDismissActionFeedback={() => setActionFeedback(null)}
          onGenerateWeek={() => void generateWeeklyPlan(profile, plan)}
          onRetryRelaxCookTime={() =>
            void generateWeeklyPlan(profile, null, { allowRelaxCookTime: true })
          }
          onAcceptShorterPlan={() =>
            void generateWeeklyPlan(profile, null, {
              allowRelaxCookTime: Boolean(plan?.relaxedByUser?.cookTime),
              allowShorterPlan: true,
            })
          }
          onOpenSettings={() => {
            setSettingsInitialSection(null);
            setActiveTab('settings');
          }}
          onChangeMode={handleChangeMode}
          onEditSchedule={openScheduleSettings}
          onToggleLock={handleToggleLock}
          onRegenerateMeal={handleRegenerateSingleMeal}
          onSwapMeal={handleSwapMeal}
          onSelectDish={(dish, meal) => setSelectedRecipe({ dish, meal })}
          onToggleFavorite={handleToggleFavorite}
          onSaveCurrentPlan={handleSaveCurrentPlan}
          onLoadSavedPlan={handleLoadSavedPlan}
          onDeleteSavedPlan={handleDeleteSavedPlan}
        />
      )}

      {activeTab === 'grocery' && (
        <GroceryView
          grocery={grocery}
          profile={profile}
          checkedIds={checkedGrocery}
          appliedSwaps={appliedSwaps}
          t={t}
          isGenerating={isGenerating}
          onToggleChecked={handleToggleGroceryChecked}
          onApplyAllSwaps={handleApplyAllSwaps}
          onRevertSwaps={handleRevertSwaps}
          onOptimizePlanForBudget={() =>
            void generateWeeklyPlan(profile, plan, { optimizeForBudget: true })
          }
          onGeneratePlan={() => {
            setActiveTab('mealPlan');
            void generateWeeklyPlan(profile, plan);
          }}
        />
      )}

      {activeTab === 'pantry' && (
        <Suspense
          fallback={
            <div className="h-64 rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#EFE9DD]/60 dark:bg-[#18221E] animate-pulse" />
          }
        >
          <PantryView
            key={pantryInitialSubTab}
            profile={profile}
            dataset={dataset}
            t={t}
            initialSubTab={pantryInitialSubTab}
            onUpdatePantry={handleUpdatePantry}
            onAddScannedItemsToPantry={handleAddScannedItemsToPantry}
            onSelectDish={(dish) => setSelectedRecipe({ dish })}
          />
        </Suspense>
      )}

      {activeTab === 'settings' && (
        <Suspense
          fallback={
            <div className="h-64 rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#EFE9DD]/60 dark:bg-[#18221E] animate-pulse" />
          }
        >
          <SettingsView
            profile={profile}
            psgc={psgc}
            dataset={dataset}
            theme={theme}
            t={t}
            initialSection={settingsInitialSection}
            onUpdateProfile={updateProfile}
            onChangeTheme={setTheme}
            onImportPsgc={handleImportPsgc}
            onRegeneratePlan={() => {
              setActiveTab('mealPlan');
              void generateWeeklyPlan(profile, plan);
            }}
            onOpenPantryTab={() => {
              setPantryInitialSubTab('inventory');
              setActiveTab('pantry');
            }}
            onResetAll={handleResetAll}
          />
        </Suspense>
      )}

      {/* Recipe Detail Sheet / Modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          dish={selectedRecipe.dish}
          meal={selectedRecipe.meal}
          profile={profile}
          dataset={dataset}
          t={t}
          isFavorite={favorites.includes(selectedRecipe.dish.dish_id)}
          onToggleFavorite={handleToggleFavorite}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </Layout>
  );
}

export default App;
