import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type {
  AllergenId,
  BudgetPreset,
  DietaryPrefId,
  EquipmentId,
  LanguageCode,
  PantryItem,
  PsgcDataset,
  StoreId,
  UlamWiseDataset,
  UserProfile,
} from '../types';
import { ALLERGEN_LIST, DIETARY_PREFS_LIST } from '../lib/allergens';
import { getTranslations } from '../lib/i18n';
import {
  calculateHouseholdServings,
  calculateMemberCalorieTarget,
} from '../lib/nutrition';
import { formatPhp, formatPhpCompact } from '../lib/pricing';
import {
  getCitiesForProvince,
  getProvincesForRegion,
  resolveRegionalContext,
} from '../lib/psgc';
import { ensureMemberSchedules } from '../lib/schedule';
import { createHouseholdMember, QUICK_PANTRY_CHIPS } from '../lib/storage';
import { STORE_LIST, STORE_MULTIPLIERS } from '../lib/storeConfig';
import { UlamWiseLogoMark } from './Layout';
import { MemberNutritionCard } from './MemberNutritionCard';
import { WeeklyScheduleEditor } from './WeeklyScheduleEditor';

interface OnboardingWizardProps {
  profile: UserProfile;
  psgc: PsgcDataset;
  dataset: UlamWiseDataset;
  onUpdateProfile: (next: UserProfile) => void;
  onComplete: (finalProfile: UserProfile) => void;
  isGenerating: boolean;
}

const TOTAL_STEPS = 9;

const EQUIPMENT_OPTIONS: Array<{ id: EquipmentId; label: string }> = [
  { id: 'gas_stove', label: 'Gas stove' },
  { id: 'one_burner_stove', label: 'One-burner stove' },
  { id: 'rice_cooker', label: 'Rice cooker' },
  { id: 'air_fryer', label: 'Air fryer' },
  { id: 'turbo_broiler', label: 'Turbo broiler' },
  { id: 'oven', label: 'Oven' },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  profile,
  psgc,
  dataset,
  onUpdateProfile,
  onComplete,
  isGenerating,
}) => {
  const step = Math.min(TOTAL_STEPS, Math.max(1, profile.onboardingStep || 1));
  const t = getTranslations(profile.language);

  const [dislikesInput, setDislikesInput] = useState(profile.dislikes.join(', '));
  const [customPantryName, setCustomPantryName] = useState('');
  const [customPantryQty, setCustomPantryQty] = useState('');
  const [customPantryUnit, setCustomPantryUnit] = useState<'g' | 'ml' | 'pc' | 'kg' | 'L'>('g');
  const [customPantrySufficient, setCustomPantrySufficient] = useState(true);
  const [stepError, setStepError] = useState<string | null>(null);

  const provinces = useMemo(
    () => getProvincesForRegion(psgc, profile.location.regionCode),
    [psgc, profile.location.regionCode]
  );

  const cities = useMemo(
    () => getCitiesForProvince(psgc, profile.location.provinceCode),
    [psgc, profile.location.provinceCode]
  );

  const regionalPreview = useMemo(
    () => resolveRegionalContext(profile.location, dataset),
    [profile.location, dataset]
  );

  const portionEquivalents = useMemo(
    () => calculateHouseholdServings(profile.household),
    [profile.household]
  );

  const ensuredSchedule = useMemo(
    () => ensureMemberSchedules(profile.weeklySchedule, profile.household, profile.includeMerienda),
    [profile.weeklySchedule, profile.household, profile.includeMerienda]
  );

  const plannedDaysCount = ensuredSchedule.selectedDays.length;

  const goToStep = (target: number) => {
    setStepError(null);
    if (target > step) {
      if (
        step === 1 &&
        (!profile.location.regionCode ||
          !profile.location.provinceCode ||
          !profile.location.cityCode)
      ) {
        setStepError('Please select your region, province, and city/municipality to continue.');
        return;
      }
      if (step === 3 && profile.household.length === 0) {
        setStepError('Please include at least one household member.');
        return;
      }
      if (step === 4 && ensuredSchedule.selectedDays.length === 0) {
        setStepError('Please select at least one day of the week to plan meals for.');
        return;
      }
      if (step === 5 && (!profile.weeklyBudgetPhp || profile.weeklyBudgetPhp < 200)) {
        setStepError('Please enter a weekly budget of at least ₱200.');
        return;
      }
    }
    onUpdateProfile({
      ...profile,
      weeklySchedule: ensuredSchedule,
      onboardingStep: Math.min(TOTAL_STEPS, Math.max(1, target)),
    });
  };

  const handleRegionChange = (regionCode: string) => {
    const reg = psgc.regions.find((r) => r.code === regionCode);
    if (!reg) return;
    const nextProvinces = getProvincesForRegion(psgc, regionCode);
    const firstProv = nextProvinces[0];
    const nextCities = firstProv ? getCitiesForProvince(psgc, firstProv.code) : [];
    const firstCity = nextCities[0];

    const isBarmm = reg.regionKey === 'barmm';
    const nextDietary =
      isBarmm && !profile.dietaryPrefs.includes('halal')
        ? [...profile.dietaryPrefs, 'halal' as DietaryPrefId]
        : profile.dietaryPrefs;

    onUpdateProfile({
      ...profile,
      dietaryPrefs: nextDietary,
      location: {
        regionCode: reg.code,
        regionName: reg.name,
        regionKey: reg.regionKey,
        provinceCode: firstProv?.code ?? '',
        provinceName: firstProv?.name ?? '',
        cityCode: firstCity?.c ?? '',
        cityName: firstCity?.n ?? '',
      },
    });
  };

  const handleProvinceChange = (provinceCode: string) => {
    const prov = provinces.find((p) => p.code === provinceCode);
    if (!prov) return;
    const nextCities = getCitiesForProvince(psgc, provinceCode);
    const firstCity = nextCities[0];
    onUpdateProfile({
      ...profile,
      location: {
        ...profile.location,
        provinceCode: prov.code,
        provinceName: prov.name,
        cityCode: firstCity?.c ?? '',
        cityName: firstCity?.n ?? '',
      },
    });
  };

  const handleCityChange = (cityCode: string) => {
    const city = cities.find((c) => c.c === cityCode);
    if (!city) return;
    onUpdateProfile({
      ...profile,
      location: {
        ...profile.location,
        cityCode: city.c,
        cityName: city.n,
      },
    });
  };

  const handleAddMember = () => {
    const newMember = createHouseholdMember({
      id: `m-${Date.now()}`,
      label: `Member ${profile.household.length + 1}`,
      age: 26,
    });
    const nextHousehold = [...profile.household, newMember];
    const nextSchedule = ensureMemberSchedules(
      profile.weeklySchedule,
      nextHousehold,
      profile.includeMerienda
    );
    onUpdateProfile({
      ...profile,
      household: nextHousehold,
      weeklySchedule: nextSchedule,
    });
  };

  const handleUpdateMember = (updated: UserProfile['household'][number]) => {
    onUpdateProfile({
      ...profile,
      household: profile.household.map((m) => (m.id === updated.id ? updated : m)),
    });
  };

  const handleRemoveMember = (memberId: string) => {
    if (profile.household.length <= 1) return;
    const nextHousehold = profile.household.filter((m) => m.id !== memberId);
    const nextSchedule = ensureMemberSchedules(
      profile.weeklySchedule,
      nextHousehold,
      profile.includeMerienda
    );
    onUpdateProfile({
      ...profile,
      household: nextHousehold,
      weeklySchedule: nextSchedule,
    });
  };

  const toggleAllergy = (id: AllergenId) => {
    const exists = profile.allergies.includes(id);
    onUpdateProfile({
      ...profile,
      allergies: exists
        ? profile.allergies.filter((a) => a !== id)
        : [...profile.allergies, id],
    });
  };

  const toggleDietary = (id: DietaryPrefId) => {
    const exists = profile.dietaryPrefs.includes(id);
    onUpdateProfile({
      ...profile,
      dietaryPrefs: exists
        ? profile.dietaryPrefs.filter((d) => d !== id)
        : [...profile.dietaryPrefs, id],
    });
  };

  const toggleEquipment = (id: EquipmentId) => {
    const exists = profile.equipment.includes(id);
    const next = exists
      ? profile.equipment.filter((e) => e !== id)
      : [...profile.equipment, id];
    onUpdateProfile({
      ...profile,
      equipment: next.length > 0 ? next : [id],
    });
  };

  const toggleQuickPantryChip = (chip: (typeof QUICK_PANTRY_CHIPS)[number]) => {
    const exists = profile.pantry.some(
      (p) =>
        (chip.ingredientId && p.ingredientId === chip.ingredientId) ||
        p.name.toLowerCase() === chip.label.toLowerCase()
    );
    if (exists) {
      onUpdateProfile({
        ...profile,
        pantry: profile.pantry.filter(
          (p) =>
            !(
              (chip.ingredientId && p.ingredientId === chip.ingredientId) ||
              p.name.toLowerCase() === chip.label.toLowerCase()
            )
        ),
      });
    } else {
      const nextItem: PantryItem = {
        id: `p-${Date.now()}-${chip.label}`,
        ingredientId: chip.ingredientId,
        name: chip.label,
        unit: chip.defaultUnit,
        sufficient: true,
      };
      onUpdateProfile({ ...profile, pantry: [...profile.pantry, nextItem] });
    }
  };

  const handleAddCustomPantry = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customPantryName.trim();
    if (!trimmed) return;
    const qtyNum = Number(customPantryQty);
    const item: PantryItem = {
      id: `p-${Date.now()}`,
      name: trimmed,
      quantity:
        !customPantrySufficient && Number.isFinite(qtyNum) && qtyNum > 0
          ? qtyNum
          : undefined,
      unit: customPantryUnit,
      sufficient: customPantrySufficient,
    };
    onUpdateProfile({ ...profile, pantry: [...profile.pantry, item] });
    setCustomPantryName('');
    setCustomPantryQty('');
  };

  const handleFinish = () => {
    const finalDislikes = dislikesInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    onComplete({
      ...profile,
      weeklySchedule: ensuredSchedule,
      dislikes: finalDislikes,
      onboardingCompleted: true,
      onboardingStep: TOTAL_STEPS,
    });
  };

  const progressPct = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <div className="min-h-screen bg-[#FAF8F4] dark:bg-[#111815] text-[#1E2421] dark:text-[#F2EFE9] flex flex-col">
      {/* Compact Header */}
      <header className="border-b border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4]/95 dark:bg-[#111815]/95 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <UlamWiseLogoMark className="w-7 h-7" />
            <span className="font-display text-lg font-semibold text-[#1B4D3E] dark:text-[#F2EFE9]">
              UlamWise
            </span>
          </div>
          <span className="text-xs font-medium text-[#535E58] dark:text-[#A6B5AE] tabular-nums">
            {t.onboarding.stepOf
              .replace('{current}', String(step))
              .replace('{total}', String(TOTAL_STEPS))}
          </span>
        </div>
        <div className="h-1 bg-[#E4DDD0] dark:bg-[#2A3B34]">
          <div
            className="h-full bg-[#1B4D3E] dark:bg-[#34926F] transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6">
          <p className="text-xs text-[#4E7A68] dark:text-[#86B8A3] font-medium">
            {t.appTagline} · {t.onboarding.resumeNotice}
          </p>
        </div>

        {/* Step Container */}
        <section className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-5 sm:p-8">
          {/* STEP 1: LOCATION */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#1E2421] dark:text-[#F2EFE9]">
                  {t.onboarding.steps.location.title}
                </h1>
                <p className="mt-2 text-sm text-[#535E58] dark:text-[#A6B5AE]">
                  {t.onboarding.steps.location.desc}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="onb-region" className="block text-sm font-medium mb-1.5">
                    {t.onboarding.steps.location.region}
                  </label>
                  <select
                    id="onb-region"
                    value={profile.location.regionCode}
                    onChange={(e) => handleRegionChange(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3.5 text-sm"
                  >
                    {psgc.regions.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.regionName} — {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="onb-province" className="block text-sm font-medium mb-1.5">
                    {t.onboarding.steps.location.province}
                  </label>
                  <select
                    id="onb-province"
                    value={profile.location.provinceCode}
                    onChange={(e) => handleProvinceChange(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3.5 text-sm"
                  >
                    {provinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="onb-city" className="block text-sm font-medium mb-1.5">
                    {t.onboarding.steps.location.city}
                  </label>
                  <select
                    id="onb-city"
                    value={profile.location.cityCode}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3.5 text-sm"
                  >
                    {cities.map((c) => (
                      <option key={c.c} value={c.c}>
                        {c.n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl bg-[#F3EFE6] dark:bg-[#1F2C27] p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#1B4D3E] dark:text-[#86B8A3]">
                  <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {regionalPreview.region.region_name} · Cuisine zone:{' '}
                    {regionalPreview.primaryCuisineZone} · {regionalPreview.coastalProfile}
                  </span>
                </div>
                <p className="text-sm text-[#1E2421] dark:text-[#F2EFE9]">
                  {regionalPreview.localFoodNotes}
                </p>
                {regionalPreview.priceNotes && (
                  <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                    Market note: {regionalPreview.priceNotes}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: LANGUAGE */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">
                  {t.onboarding.steps.language.title}
                </h1>
                <p className="mt-2 text-sm text-[#535E58] dark:text-[#A6B5AE]">
                  {t.onboarding.steps.language.desc}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(
                  [
                    { code: 'en', title: 'English', sample: 'Plan smarter. Shop tipid.' },
                    {
                      code: 'tl',
                      title: 'Tagalog',
                      sample: 'Magplano nang matalino. Mamili nang tipid.',
                    },
                    {
                      code: 'taglish',
                      title: 'Taglish',
                      sample: 'Swak na ulam plans at tipid grocery list.',
                    },
                  ] as Array<{ code: LanguageCode; title: string; sample: string }>
                ).map((opt) => {
                  const active = profile.language === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => onUpdateProfile({ ...profile, language: opt.code })}
                      aria-pressed={active}
                      className={`text-left rounded-xl p-4 border transition-colors min-h-[96px] flex flex-col justify-between ${
                        active
                          ? 'border-[#1B4D3E] bg-[#1B4D3E]/8 dark:border-[#34926F] dark:bg-[#2B7A5C]/20'
                          : 'border-[#E4DDD0] dark:border-[#2A3B34] hover:bg-[#FAF8F4] dark:hover:bg-[#1F2C27]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-base">{opt.title}</span>
                        {active && <Check className="w-4 h-4 text-[#1B4D3E] dark:text-[#86B8A3]" />}
                      </div>
                      <span className="text-xs text-[#535E58] dark:text-[#A6B5AE] mt-2">
                        {opt.sample}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: HOUSEHOLD MEMBERS & INDIVIDUAL NUTRITION PROFILES */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">
                  {t.onboarding.steps.household.title}
                </h1>
                <p className="mt-2 text-sm text-[#535E58] dark:text-[#A6B5AE]">
                  Add each household member with their own age, portion preference, daily calorie target, and personal allergies.
                </p>
              </div>

              <div className="space-y-3">
                {profile.household.map((member, idx) => (
                  <MemberNutritionCard
                    key={member.id}
                    member={member}
                    canRemove={profile.household.length > 1}
                    defaultExpanded={idx === 0}
                    onChange={handleUpdateMember}
                    onRemove={() => handleRemoveMember(member.id)}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#1B4D3E] dark:border-[#34926F] px-4 py-2.5 text-sm font-medium text-[#1B4D3E] dark:text-[#86B8A3] min-h-[44px] hover:bg-[#1B4D3E]/5"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>{t.onboarding.steps.household.addMember}</span>
                </button>
                <div className="text-sm text-[#535E58] dark:text-[#A6B5AE] tabular-nums">
                  {t.onboarding.steps.household.totalPortions}:{' '}
                  <strong className="text-[#1E2421] dark:text-[#F2EFE9]">
                    {portionEquivalents} {t.common.servings}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: WEEKLY EATING SCHEDULE & INDIVIDUAL AVAILABILITY */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">
                  Weekly Eating Schedule
                </h1>
                <p className="mt-2 text-sm text-[#535E58] dark:text-[#A6B5AE]">
                  Tell us which days you cook at home and who eats each meal. UlamWise only generates meals and grocery quantities for scheduled attendance.
                </p>
              </div>

              <WeeklyScheduleEditor
                household={profile.household}
                schedule={ensuredSchedule}
                language={profile.language}
                includeMeriendaDefault={profile.includeMerienda}
                onChange={(nextSched) =>
                  onUpdateProfile({ ...profile, weeklySchedule: nextSched })
                }
              />
            </div>
          )}

          {/* STEP 5: WEEKLY BUDGET */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">
                  {t.onboarding.steps.budget.title}
                </h1>
                <p className="mt-2 text-sm text-[#535E58] dark:text-[#A6B5AE]">
                  {t.onboarding.steps.budget.desc}
                </p>
              </div>

              <div>
                <label htmlFor="onb-budget" className="block text-sm font-medium mb-1.5">
                  {t.onboarding.steps.budget.weeklyLabel}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-[#535E58]">
                    ₱
                  </span>
                  <input
                    id="onb-budget"
                    type="number"
                    min={200}
                    max={50000}
                    step={50}
                    value={profile.weeklyBudgetPhp}
                    onChange={(e) =>
                      onUpdateProfile({
                        ...profile,
                        weeklyBudgetPhp: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full min-h-[52px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] pl-9 pr-4 text-xl font-semibold tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-xl bg-[#F3EFE6] dark:bg-[#1F2C27] p-4">
                <div>
                  <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                    Per planned day ({plannedDaysCount}d)
                  </p>
                  <p className="mt-1 text-base sm:text-lg font-semibold font-mono-tabular">
                    {formatPhp(profile.weeklyBudgetPhp / Math.max(1, plannedDaysCount))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                    {t.onboarding.steps.budget.perMember}
                  </p>
                  <p className="mt-1 text-base sm:text-lg font-semibold font-mono-tabular">
                    {formatPhp(profile.weeklyBudgetPhp / Math.max(1, profile.household.length))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">Household</p>
                  <p className="mt-1 text-base sm:text-lg font-semibold tabular-nums">
                    {profile.household.length} ({portionEquivalents} srv)
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2.5">
                  {t.onboarding.steps.budget.presetsTitle}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(
                    [
                      {
                        id: 'tipid',
                        title: 'Tipid',
                        desc: 'Prioritize affordable ulam, gulay, itlog, tilapia, and budget staples.',
                      },
                      {
                        id: 'balanced',
                        title: 'Balanced',
                        desc: 'Mix of everyday budget meals, nutritious vegetables, and classic meats.',
                      },
                      {
                        id: 'sagana',
                        title: 'Sagana',
                        desc: 'More variety and specialty dishes while respecting your peso cap.',
                      },
                    ] as Array<{ id: BudgetPreset; title: string; desc: string }>
                  ).map((preset) => {
                    const active = profile.budgetPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => onUpdateProfile({ ...profile, budgetPreset: preset.id })}
                        aria-pressed={active}
                        className={`text-left rounded-xl p-4 border transition-colors ${
                          active
                            ? 'border-[#1B4D3E] bg-[#1B4D3E]/8 dark:border-[#34926F] dark:bg-[#2B7A5C]/20'
                            : 'border-[#E4DDD0] dark:border-[#2A3B34] hover:bg-[#FAF8F4] dark:hover:bg-[#1F2C27]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{preset.title}</span>
                          {active && (
                            <Check className="w-4 h-4 text-[#1B4D3E] dark:text-[#86B8A3]" />
                          )}
                        </div>
                        <p className="mt-1.5 text-xs text-[#535E58] dark:text-[#A6B5AE] leading-relaxed">
                          {preset.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: PREFERRED STORE */}
          {step === 6 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">
                  {t.onboarding.steps.store.title}
                </h1>
                <p className="mt-2 text-sm text-[#535E58] dark:text-[#A6B5AE]">
                  {t.onboarding.steps.store.desc}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STORE_LIST.map((store) => {
                  const active = profile.preferredStore === store.id;
                  return (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() =>
                        onUpdateProfile({ ...profile, preferredStore: store.id as StoreId })
                      }
                      aria-pressed={active}
                      className={`text-left rounded-xl p-4 border transition-colors ${
                        active
                          ? 'border-[#1B4D3E] bg-[#1B4D3E]/8 dark:border-[#34926F] dark:bg-[#2B7A5C]/20'
                          : 'border-[#E4DDD0] dark:border-[#2A3B34] hover:bg-[#FAF8F4] dark:hover:bg-[#1F2C27]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">{store.name}</span>
                        <span className="text-xs font-mono-tabular text-[#4E7A68] dark:text-[#86B8A3]">
                          {store.multiplier.toFixed(2)}×
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#535E58] dark:text-[#A6B5AE]">
                        {store.description[profile.language]}
                      </p>
                    </button>
                  );
                })}
              </div>

              {STORE_MULTIPLIERS[profile.preferredStore]?.isProvisional && (
                <div className="rounded-xl border border-[#C9972B]/40 bg-[#C9972B]/10 p-3.5 text-xs text-[#6F4F09] dark:text-[#F0CB73]">
                  {t.onboarding.steps.store.provisionalNotice}
                </div>
              )}
            </div>
          )}

          {/* STEP 7: HOUSEHOLD ALLERGIES & DIETARY */}
          {step === 7 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">
                  {t.onboarding.steps.allergies.title}
                </h1>
                <p className="mt-2 text-sm text-[#535E58] dark:text-[#A6B5AE]">
                  Set household-wide allergies and dietary preferences. Per-member allergies set in Step 3 are also automatically enforced for meals they eat.
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2.5">
                  {t.onboarding.steps.allergies.allergiesLabel}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ALLERGEN_LIST.map((a) => {
                    const checked = profile.allergies.includes(a.id);
                    return (
                      <label
                        key={a.id}
                        className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer min-h-[56px] transition-colors ${
                          checked
                            ? 'border-[#1B4D3E] bg-[#1B4D3E]/8 dark:border-[#34926F] dark:bg-[#2B7A5C]/20'
                            : 'border-[#E4DDD0] dark:border-[#2A3B34] hover:bg-[#FAF8F4] dark:hover:bg-[#1F2C27]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAllergy(a.id)}
                          className="mt-1 h-4 w-4 accent-[#1B4D3E]"
                        />
                        <div>
                          <span className="text-sm font-medium block">
                            {a.labelEn} · {a.labelFil}
                          </span>
                          <span className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                            {a.examples}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2.5">
                  {t.onboarding.steps.allergies.dietaryLabel}
                </p>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_PREFS_LIST.map((d) => {
                    const active = profile.dietaryPrefs.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDietary(d.id)}
                        aria-pressed={active}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors ${
                          active
                            ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                            : 'border-[#D8CFC0] dark:border-[#2A3B34] text-[#1E2421] dark:text-[#F2EFE9] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]'
                        }`}
                      >
                        {d.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="onb-dislikes" className="block text-sm font-medium mb-1.5">
                  {t.onboarding.steps.allergies.dislikesLabel}
                </label>
                <input
                  id="onb-dislikes"
                  type="text"
                  value={dislikesInput}
                  onChange={(e) => {
                    setDislikesInput(e.target.value);
                    onUpdateProfile({
                      ...profile,
                      dislikes: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    });
                  }}
                  placeholder={t.onboarding.steps.allergies.dislikesPlaceholder}
                  className="w-full min-h-[48px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3.5 text-sm"
                />
              </div>

              <div className="flex items-start gap-2.5 rounded-xl bg-[#EDF3EF] dark:bg-[#1B2B24] p-3.5 text-xs text-[#1B4D3E] dark:text-[#A8D5C0]">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{t.onboarding.steps.allergies.deterministicNote}</span>
              </div>
            </div>
          )}

          {/* STEP 8: KITCHEN EQUIPMENT & COOKING TIME */}
          {step === 8 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">
                  {t.onboarding.steps.kitchen.title}
                </h1>
                <p className="mt-2 text-sm text-[#535E58] dark:text-[#A6B5AE]">
                  {t.onboarding.steps.kitchen.desc}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2.5">
                  {t.onboarding.steps.kitchen.equipmentLabel}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {EQUIPMENT_OPTIONS.map((eq) => {
                    const active = profile.equipment.includes(eq.id);
                    return (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => toggleEquipment(eq.id)}
                        aria-pressed={active}
                        className={`min-h-[48px] px-3.5 py-2.5 rounded-xl border text-sm font-medium text-left flex items-center justify-between transition-colors ${
                          active
                            ? 'border-[#1B4D3E] bg-[#1B4D3E]/8 text-[#1B4D3E] dark:border-[#34926F] dark:bg-[#2B7A5C]/20 dark:text-[#F2EFE9]'
                            : 'border-[#E4DDD0] dark:border-[#2A3B34] hover:bg-[#FAF8F4] dark:hover:bg-[#1F2C27]'
                        }`}
                      >
                        <span>{eq.label}</span>
                        {active && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-3">
                  {t.onboarding.steps.kitchen.maxTimeLabel}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(['B', 'L', 'D'] as const).map((slotKey) => (
                    <div key={slotKey}>
                      <label htmlFor={`time-${slotKey}`} className="block text-xs font-medium mb-1">
                        {t.slots[slotKey]}
                      </label>
                      <select
                        id={`time-${slotKey}`}
                        value={profile.maxCookTime[slotKey]}
                        onChange={(e) =>
                          onUpdateProfile({
                            ...profile,
                            maxCookTime: {
                              ...profile.maxCookTime,
                              [slotKey]: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full min-h-[46px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm tabular-nums"
                      >
                        <option value={20}>Up to 20 min</option>
                        <option value={30}>Up to 30 min</option>
                        <option value={45}>Up to 45 min</option>
                        <option value={60}>Up to 60 min</option>
                        <option value={90}>Up to 90 min</option>
                        <option value={150}>No limit (150+ min)</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 9: PANTRY & CONFIRMATION SUMMARY */}
          {step === 9 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">
                  {t.onboarding.steps.pantry.title}
                </h1>
                <p className="mt-2 text-sm text-[#535E58] dark:text-[#A6B5AE]">
                  {t.onboarding.steps.pantry.desc}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">
                  {t.onboarding.steps.pantry.quickAdd}
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PANTRY_CHIPS.map((chip) => {
                    const active = profile.pantry.some(
                      (p) =>
                        (chip.ingredientId && p.ingredientId === chip.ingredientId) ||
                        p.name.toLowerCase() === chip.label.toLowerCase()
                    );
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => toggleQuickPantryChip(chip)}
                        aria-pressed={active}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                          active
                            ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                            : 'border-[#D8CFC0] dark:border-[#2A3B34] hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                        <span>{chip.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form
                onSubmit={handleAddCustomPantry}
                className="space-y-3 rounded-xl border border-[#E4DDD0] dark:border-[#2A3B34] p-4 bg-[#FAF8F4] dark:bg-[#111815]"
              >
                <p className="text-xs font-semibold text-[#535E58] dark:text-[#A6B5AE]">
                  {t.onboarding.steps.pantry.addCustom}
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={customPantryName}
                    onChange={(e) => setCustomPantryName(e.target.value)}
                    placeholder="e.g., Patis, Paminta, Kangkong"
                    aria-label="Custom pantry ingredient name"
                    className="flex-1 min-w-[160px] min-h-[44px] rounded-lg border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] px-3 text-sm"
                  />
                  {!customPantrySufficient && (
                    <>
                      <input
                        type="number"
                        min={1}
                        value={customPantryQty}
                        onChange={(e) => setCustomPantryQty(e.target.value)}
                        placeholder="Qty"
                        aria-label="Pantry quantity"
                        className="w-24 min-h-[44px] rounded-lg border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] px-3 text-sm tabular-nums"
                      />
                      <select
                        value={customPantryUnit}
                        onChange={(e) =>
                          setCustomPantryUnit(e.target.value as 'g' | 'ml' | 'pc' | 'kg' | 'L')
                        }
                        aria-label="Pantry unit"
                        className="w-20 min-h-[44px] rounded-lg border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] px-2 text-sm"
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="L">L</option>
                        <option value="pc">pc</option>
                      </select>
                    </>
                  )}
                  <button
                    type="submit"
                    className="min-h-[44px] px-4 rounded-lg bg-[#1B4D3E] text-[#FAF8F4] text-sm font-medium hover:bg-[#143B2F] dark:bg-[#2B7A5C]"
                  >
                    Add
                  </button>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-[#535E58] dark:text-[#A6B5AE] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customPantrySufficient}
                    onChange={(e) => setCustomPantrySufficient(e.target.checked)}
                    className="accent-[#1B4D3E]"
                  />
                  <span>{t.onboarding.steps.pantry.sufficientLabel}</span>
                </label>
              </form>

              {profile.pantry.length > 0 && (
                <div className="space-y-1.5">
                  {profile.pantry.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-sm py-2 px-3 rounded-lg border border-[#E4DDD0] dark:border-[#2A3B34]"
                    >
                      <span>
                        <strong>{item.name}</strong>{' '}
                        <span className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                          ·{' '}
                          {item.sufficient
                            ? 'Sufficient quantity'
                            : `${item.quantity ?? 0} ${item.unit ?? 'g'}`}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateProfile({
                            ...profile,
                            pantry: profile.pantry.filter((p) => p.id !== item.id),
                          })
                        }
                        aria-label={`Remove ${item.name} from pantry`}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#535E58] hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirmation Summary */}
              <div className="rounded-xl bg-[#F3EFE6] dark:bg-[#1F2C27] p-4 space-y-2 border border-[#E4DDD0] dark:border-[#2A3B34]">
                <h2 className="text-base font-semibold text-[#1B4D3E] dark:text-[#86B8A3]">
                  {t.onboarding.steps.pantry.summaryTitle}
                </h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <div>
                    <dt className="inline text-[#535E58] dark:text-[#A6B5AE]">Location: </dt>
                    <dd className="inline font-medium">
                      {profile.location.cityName}, {profile.location.provinceName}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-[#535E58] dark:text-[#A6B5AE]">Schedule: </dt>
                    <dd className="inline font-medium">
                      {plannedDaysCount} {plannedDaysCount === 1 ? 'day' : 'days'} / week
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-[#535E58] dark:text-[#A6B5AE]">Budget: </dt>
                    <dd className="inline font-medium font-mono-tabular">
                      {formatPhpCompact(profile.weeklyBudgetPhp)}/wk ({profile.budgetPreset}) ·{' '}
                      {STORE_MULTIPLIERS[profile.preferredStore]?.shortName}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-[#535E58] dark:text-[#A6B5AE]">Household: </dt>
                    <dd className="inline font-medium">
                      {profile.household.length} members ({portionEquivalents} base srv)
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="inline text-[#535E58] dark:text-[#A6B5AE]">
                      Individual Targets (Est.):{' '}
                    </dt>
                    <dd className="inline font-medium font-mono-tabular">
                      {profile.household
                        .map((m) => `${m.label} ${calculateMemberCalorieTarget(m).dailyTargetKcal} kcal`)
                        .join(' · ')}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="inline text-[#535E58] dark:text-[#A6B5AE]">
                      Household Allergies &amp; Diet:{' '}
                    </dt>
                    <dd className="inline font-medium">
                      {profile.allergies.length > 0 ? profile.allergies.join(', ') : 'None'}
                      {profile.dietaryPrefs.length > 0 ? ` · ${profile.dietaryPrefs.join(', ')}` : ''}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {stepError && (
            <div
              role="alert"
              className="mt-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900 p-3 text-sm text-red-800 dark:text-red-200"
            >
              {stepError}
            </div>
          )}

          {/* Wizard Navigation Footer */}
          <div className="mt-8 pt-5 border-t border-[#E4DDD0] dark:border-[#2A3B34] flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              disabled={step === 1}
              className="inline-flex items-center gap-2 min-h-[48px] px-4 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] text-sm font-medium disabled:opacity-35 hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>{t.common.back}</span>
            </button>

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={() => goToStep(step + 1)}
                className="inline-flex items-center gap-2 min-h-[48px] px-6 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] dark:bg-[#2B7A5C] dark:hover:bg-[#23654B] text-[#FAF8F4] text-sm font-semibold transition-colors"
              >
                <span>{t.common.next}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 min-h-[48px] px-6 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] dark:bg-[#2B7A5C] dark:hover:bg-[#23654B] text-[#FAF8F4] text-sm font-semibold transition-colors disabled:opacity-60"
              >
                <span>{isGenerating ? t.common.loading : t.onboarding.finishCta}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
