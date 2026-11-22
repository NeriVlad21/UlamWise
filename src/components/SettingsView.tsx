import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  Flame,
  MapPin,
  Moon,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  Users,
  Wallet,
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
import type { Translations } from '../lib/i18n';
import { calculateHouseholdServings } from '../lib/nutrition';
import {
  getCitiesForProvince,
  getProvincesForRegion,
  parseImportedPsgcJson,
} from '../lib/psgc';
import { ensureMemberSchedules } from '../lib/schedule';
import { createHouseholdMember, QUICK_PANTRY_CHIPS } from '../lib/storage';
import { STORE_LIST } from '../lib/storeConfig';
import { MemberNutritionCard } from './MemberNutritionCard';
import { PWAInstallButton } from './PWAInstallButton';
import { WeeklyScheduleEditor } from './WeeklyScheduleEditor';

export type SettingsSectionId =
  | 'appearance'
  | 'location'
  | 'household'
  | 'schedule'
  | 'allergies'
  | 'dislikes'
  | 'kitchen'
  | 'pantry'
  | 'budget'
  | 'advanced';

interface SettingsViewProps {
  profile: UserProfile;
  psgc: PsgcDataset;
  dataset: UlamWiseDataset;
  theme: 'light' | 'dark';
  t: Translations;
  initialSection?: SettingsSectionId | null;
  onUpdateProfile: (next: UserProfile) => void;
  onChangeTheme: (next: 'light' | 'dark') => void;
  onImportPsgc: (next: PsgcDataset) => void;
  onRegeneratePlan: () => void;
  onOpenPantryTab: () => void;
  onResetAll: () => void;
}

const EQUIPMENT_OPTIONS: Array<{ id: EquipmentId; label: string }> = [
  { id: 'gas_stove', label: 'Gas stove' },
  { id: 'one_burner_stove', label: 'One-burner stove' },
  { id: 'rice_cooker', label: 'Rice cooker' },
  { id: 'air_fryer', label: 'Air fryer' },
  { id: 'turbo_broiler', label: 'Turbo broiler' },
  { id: 'oven', label: 'Oven' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  psgc,
  dataset,
  theme,
  t,
  initialSection = null,
  onUpdateProfile,
  onChangeTheme,
  onImportPsgc,
  onRegeneratePlan,
  onOpenPantryTab,
  onResetAll,
}) => {
  const [openSections, setOpenSections] = useState<Record<SettingsSectionId, boolean>>({
    appearance: true,
    location: false,
    household: initialSection === 'household' || true,
    schedule: initialSection === 'schedule' || true,
    allergies: false,
    dislikes: false,
    kitchen: false,
    pantry: false,
    budget: true,
    advanced: false,
  });

  const [confirmReset, setConfirmReset] = useState(false);
  const [psgcMessage, setPsgcMessage] = useState<string | null>(null);
  const [newPantryName, setNewPantryName] = useState('');
  const [dislikesText, setDislikesText] = useState(profile.dislikes.join(', '));
  const [scheduleChanged, setScheduleChanged] = useState(false);

  useEffect(() => {
    if (!initialSection) return;
    setOpenSections((prev) => ({ ...prev, [initialSection]: true }));
    const el = document.getElementById(`settings-section-${initialSection}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [initialSection]);

  const toggleSection = (id: SettingsSectionId) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const provinces = useMemo(
    () => getProvincesForRegion(psgc, profile.location.regionCode),
    [psgc, profile.location.regionCode]
  );
  const cities = useMemo(
    () => getCitiesForProvince(psgc, profile.location.provinceCode),
    [psgc, profile.location.provinceCode]
  );

  const portions = useMemo(() => calculateHouseholdServings(profile.household), [profile.household]);
  const ensuredSchedule = useMemo(
    () => ensureMemberSchedules(profile.weeklySchedule, profile.household, profile.includeMerienda),
    [profile.weeklySchedule, profile.household, profile.includeMerienda]
  );

  const handleRegionChange = (regionCode: string) => {
    const reg = psgc.regions.find((r) => r.code === regionCode);
    if (!reg) return;
    const nextProvs = getProvincesForRegion(psgc, regionCode);
    const firstProv = nextProvs[0];
    const nextCities = firstProv ? getCitiesForProvince(psgc, firstProv.code) : [];
    const firstCity = nextCities[0];
    onUpdateProfile({
      ...profile,
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
    setScheduleChanged(true);
  };

  const handleUpdateMember = (updated: UserProfile['household'][number]) => {
    const nextHousehold = profile.household.map((m) => (m.id === updated.id ? updated : m));
    onUpdateProfile({
      ...profile,
      household: nextHousehold,
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
    setScheduleChanged(true);
  };

  const handlePsgcUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseImportedPsgcJson(String(reader.result || ''));
      if (res.ok) {
        onImportPsgc(res.data);
        setPsgcMessage(
          `Imported PSGC dataset: ${res.data.regions.length} regions, ${res.data.cities.length} cities/municipalities.`
        );
      } else {
        setPsgcMessage(`Import failed: ${res.error}`);
      }
    };
    reader.readAsText(file);
  };

  const handleAddPantry = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPantryName.trim();
    if (!trimmed) return;
    const item: PantryItem = {
      id: `p-${Date.now()}`,
      name: trimmed,
      sufficient: true,
    };
    onUpdateProfile({ ...profile, pantry: [...profile.pantry, item] });
    setNewPantryName('');
  };

  const renderAccordionHeader = (
    id: SettingsSectionId,
    title: string,
    summary: string,
    icon: React.ReactNode
  ) => {
    const isOpen = openSections[id];
    return (
      <button
        type="button"
        onClick={() => toggleSection(id)}
        aria-expanded={isOpen}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left min-h-[60px] hover:bg-[#FAF8F4]/70 dark:hover:bg-[#1F2C27]/50 transition-colors"
      >
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-[#1B4D3E] dark:text-[#86B8A3] shrink-0 mt-0.5">{icon}</span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-snug text-[#1E2421] dark:text-[#F2EFE9]">
              {title}
            </h2>
            <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] mt-0.5 line-clamp-2">{summary}</p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-[#535E58] shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#535E58] shrink-0" aria-hidden="true" />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{t.settings.title}</h1>
          <p className="mt-1 text-sm text-[#535E58] dark:text-[#A6B5AE]">
            {t.settings.subtitle}
          </p>
        </div>
        <PWAInstallButton />
      </div>

      {/* Prompt to regenerate plan after schedule/member edits */}
      {scheduleChanged && (
        <div className="rounded-2xl border border-[#1B4D3E]/40 bg-[#EDF3EF] dark:bg-[#1B2B24] p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-[#1B4D3E] dark:text-[#A8D5C0] font-medium">
            Your household or weekly eating schedule changed. Regenerate your plan to apply the updated attendance and portions.
          </p>
          <button
            type="button"
            onClick={() => {
              setScheduleChanged(false);
              onRegeneratePlan();
            }}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-[#1B4D3E] dark:bg-[#2B7A5C] text-[#FAF8F4] text-xs sm:text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>Regenerate Plan Now</span>
          </button>
        </div>
      )}

      {/* 1. Appearance & Language */}
      <section
        id="settings-section-appearance"
        className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] overflow-hidden"
      >
        {renderAccordionHeader(
          'appearance',
          '1. Appearance & Language',
          `${theme === 'dark' ? 'Dark' : 'Light'} mode · ${profile.language.toUpperCase()}`,
          theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />
        )}
        {openSections.appearance && (
          <div className="px-5 pb-5 pt-2 border-t border-[#EFE9DD] dark:border-[#2A3B34] grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#535E58] dark:text-[#A6B5AE]">
                {t.settings.appearance}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onChangeTheme('light')}
                  aria-pressed={theme === 'light'}
                  className={`flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-medium ${
                    theme === 'light'
                      ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4]'
                      : 'border-[#D8CFC0] dark:border-[#2A3B34]'
                  }`}
                >
                  <Sun className="w-4 h-4" aria-hidden="true" />
                  <span>{t.settings.lightMode}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTheme('dark')}
                  aria-pressed={theme === 'dark'}
                  className={`flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-medium ${
                    theme === 'dark'
                      ? 'border-[#2B7A5C] bg-[#2B7A5C] text-[#FAF8F4]'
                      : 'border-[#D8CFC0] dark:border-[#2A3B34]'
                  }`}
                >
                  <Moon className="w-4 h-4" aria-hidden="true" />
                  <span>{t.settings.darkMode}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#535E58] dark:text-[#A6B5AE]">
                Language / Wika
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'en', label: 'English' },
                    { id: 'tl', label: 'Tagalog' },
                    { id: 'taglish', label: 'Taglish' },
                  ] as Array<{ id: LanguageCode; label: string }>
                ).map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => onUpdateProfile({ ...profile, language: lang.id })}
                    aria-pressed={profile.language === lang.id}
                    className={`min-h-[44px] rounded-xl border text-sm font-medium ${
                      profile.language === lang.id
                        ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                        : 'border-[#D8CFC0] dark:border-[#2A3B34]'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2. Location (PSGC) */}
      <section
        id="settings-section-location"
        className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] overflow-hidden"
      >
        {renderAccordionHeader(
          'location',
          '2. Location (PSGC)',
          `${profile.location.cityName}, ${profile.location.provinceName}`,
          <MapPin className="w-4 h-4" />
        )}
        {openSections.location && (
          <div className="px-5 pb-5 pt-3 border-t border-[#EFE9DD] dark:border-[#2A3B34] grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label htmlFor="set-region" className="block text-xs font-medium mb-1">
                Region
              </label>
              <select
                id="set-region"
                value={profile.location.regionCode}
                onChange={(e) => handleRegionChange(e.target.value)}
                className="w-full min-h-[46px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm"
              >
                {psgc.regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.regionName} — {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="set-province" className="block text-xs font-medium mb-1">
                Province / NCR District
              </label>
              <select
                id="set-province"
                value={profile.location.provinceCode}
                onChange={(e) => handleProvinceChange(e.target.value)}
                className="w-full min-h-[46px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm"
              >
                {provinces.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="set-city" className="block text-xs font-medium mb-1">
                City / Municipality
              </label>
              <select
                id="set-city"
                value={profile.location.cityCode}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full min-h-[46px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm"
              >
                {cities.map((c) => (
                  <option key={c.c} value={c.c}>
                    {c.n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </section>

      {/* 3. Household Members & Individual Nutrition Profiles */}
      <section
        id="settings-section-household"
        className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] overflow-hidden"
      >
        {renderAccordionHeader(
          'household',
          '3. Household Members & Individual Nutrition Profiles',
          `${profile.household.length} ${profile.household.length === 1 ? 'member' : 'members'} · ${portions} base portions`,
          <Users className="w-4 h-4" />
        )}
        {openSections.household && (
          <div className="px-5 pb-5 pt-3 border-t border-[#EFE9DD] dark:border-[#2A3B34] space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                Each member has independent calorie targets, portion preference, and personal allergies or dietary preferences.
              </p>
              <button
                type="button"
                onClick={handleAddMember}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border border-[#1B4D3E] dark:border-[#34926F] text-xs font-medium text-[#1B4D3E] dark:text-[#86B8A3] hover:bg-[#1B4D3E]/5"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add Member</span>
              </button>
            </div>

            <div className="space-y-3">
              {profile.household.map((member, idx) => (
                <MemberNutritionCard
                  key={member.id}
                  member={member}
                  canRemove={profile.household.length > 1}
                  defaultExpanded={idx === 0 && profile.household.length === 1}
                  onChange={handleUpdateMember}
                  onRemove={() => handleRemoveMember(member.id)}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 4. Weekly Eating Schedule */}
      <section
        id="settings-section-schedule"
        className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] overflow-hidden"
      >
        {renderAccordionHeader(
          'schedule',
          '4. Weekly Eating Schedule',
          `Planning ${ensuredSchedule.selectedDays.length} of 7 days · Per-member meal attendance`,
          <CalendarDays className="w-4 h-4" />
        )}
        {openSections.schedule && (
          <div className="px-5 pb-5 pt-3 border-t border-[#EFE9DD] dark:border-[#2A3B34] space-y-4">
            <WeeklyScheduleEditor
              household={profile.household}
              schedule={ensuredSchedule}
              language={profile.language}
              includeMeriendaDefault={profile.includeMerienda}
              onChange={(nextSched) => {
                onUpdateProfile({ ...profile, weeklySchedule: nextSched });
                setScheduleChanged(true);
              }}
              compact
            />
          </div>
        )}
      </section>

      {/* 5. Allergies & Dietary Restrictions (Household Defaults) */}
      <section
        id="settings-section-allergies"
        className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] overflow-hidden"
      >
        {renderAccordionHeader(
          'allergies',
          '5. Allergies & Dietary Restrictions (Household-Wide)',
          profile.allergies.length > 0 || profile.dietaryPrefs.length > 0
            ? [...profile.allergies, ...profile.dietaryPrefs].join(', ')
            : 'None set (per-member rules can be configured in Section 3)',
          <ShieldCheck className="w-4 h-4" />
        )}
        {openSections.allergies && (
          <div className="px-5 pb-5 pt-3 border-t border-[#EFE9DD] dark:border-[#2A3B34] space-y-4">
            <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
              Household-wide restrictions apply to every meal. You can also set individual allergies or dietary needs on each member card above.
            </p>
            <div className="flex flex-wrap gap-2">
              {ALLERGEN_LIST.map((a) => {
                const active = profile.allergies.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      onUpdateProfile({
                        ...profile,
                        allergies: active
                          ? profile.allergies.filter((x) => x !== a.id)
                          : [...profile.allergies, a.id as AllergenId],
                      })
                    }
                    aria-pressed={active}
                    className={`min-h-[42px] px-3 rounded-xl border text-xs font-medium ${
                      active
                        ? 'border-red-700 bg-red-700 text-white'
                        : 'border-[#D8CFC0] dark:border-[#2A3B34]'
                    }`}
                  >
                    {a.labelEn}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 pt-3 border-t border-[#EFE9DD] dark:border-[#2A3B34]">
              {DIETARY_PREFS_LIST.map((d) => {
                const active = profile.dietaryPrefs.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      onUpdateProfile({
                        ...profile,
                        dietaryPrefs: active
                          ? profile.dietaryPrefs.filter((x) => x !== d.id)
                          : [...profile.dietaryPrefs, d.id as DietaryPrefId],
                      })
                    }
                    aria-pressed={active}
                    className={`min-h-[42px] px-3 rounded-xl border text-xs font-medium ${
                      active
                        ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                        : 'border-[#D8CFC0] dark:border-[#2A3B34]'
                    }`}
                  >
                    {d.labelEn}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 6. Dislikes & Food Preferences */}
      <section
        id="settings-section-dislikes"
        className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] overflow-hidden"
      >
        {renderAccordionHeader(
          'dislikes',
          '6. Dislikes & Food Preferences',
          profile.dislikes.length > 0
            ? `Avoids: ${profile.dislikes.join(', ')}`
            : 'No household dislikes listed',
          <ShieldCheck className="w-4 h-4" />
        )}
        {openSections.dislikes && (
          <div className="px-5 pb-5 pt-3 border-t border-[#EFE9DD] dark:border-[#2A3B34] space-y-2">
            <label htmlFor="set-dislikes" className="block text-xs font-medium">
              Household disliked ingredients (comma-separated)
            </label>
            <input
              id="set-dislikes"
              type="text"
              value={dislikesText}
              placeholder="e.g., ampalaya, liver, okra"
              onChange={(e) => {
                setDislikesText(e.target.value);
                onUpdateProfile({
                  ...profile,
                  dislikes: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
              }}
              className="w-full min-h-[44px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm"
            />
          </div>
        )}
      </section>

      {/* 7. Kitchen Equipment & Cooking Time */}
      <section
        id="settings-section-kitchen"
        className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] overflow-hidden"
      >
        {renderAccordionHeader(
          'kitchen',
          '7. Kitchen Equipment & Max Cook Time',
          `${profile.equipment.length} tools · Max ${profile.maxCookTime.B}/${profile.maxCookTime.L}/${profile.maxCookTime.D} min`,
          <Flame className="w-4 h-4" />
        )}
        {openSections.kitchen && (
          <div className="px-5 pb-5 pt-3 border-t border-[#EFE9DD] dark:border-[#2A3B34] space-y-4">
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((eq) => {
                const active = profile.equipment.includes(eq.id);
                return (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? profile.equipment.filter((x) => x !== eq.id)
                        : [...profile.equipment, eq.id];
                      onUpdateProfile({ ...profile, equipment: next.length > 0 ? next : [eq.id] });
                    }}
                    aria-pressed={active}
                    className={`min-h-[42px] px-3 rounded-xl border text-xs font-medium ${
                      active
                        ? 'border-[#1B4D3E] bg-[#1B4D3E]/10 text-[#1B4D3E] dark:border-[#34926F] dark:text-[#86B8A3]'
                        : 'border-[#D8CFC0] dark:border-[#2A3B34]'
                    }`}
                  >
                    {eq.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#EFE9DD] dark:border-[#2A3B34]">
              {(['B', 'L', 'D'] as const).map((slotKey) => (
                <div key={slotKey}>
                  <label htmlFor={`set-time-${slotKey}`} className="block text-xs font-medium mb-1">
                    Max time — {t.slots[slotKey]}
                  </label>
                  <select
                    id={`set-time-${slotKey}`}
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
                    className="w-full min-h-[44px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm tabular-nums"
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
        )}
      </section>

      {/* 8. Pantry Inventory */}
      <section
        id="settings-section-pantry"
        className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] overflow-hidden"
      >
        {renderAccordionHeader(
          'pantry',
          '8. Pantry Inventory',
          `${profile.pantry.length} items tracked (deducted from grocery list)`,
          <Package className="w-4 h-4" />
        )}
        {openSections.pantry && (
          <div className="px-5 pb-5 pt-3 border-t border-[#EFE9DD] dark:border-[#2A3B34] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                Quick-edit staples below or open the dedicated Pantry &amp; Fridge Scan tab.
              </p>
              <button
                type="button"
                onClick={onOpenPantryTab}
                className="min-h-[40px] px-3 rounded-xl border border-[#1B4D3E] dark:border-[#34926F] text-xs font-medium text-[#1B4D3E] dark:text-[#86B8A3]"
              >
                Open Pantry Tab
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
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
                    onClick={() => {
                      if (active) {
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
                        onUpdateProfile({
                          ...profile,
                          pantry: [
                            ...profile.pantry,
                            {
                              id: `p-${Date.now()}-${chip.label}`,
                              ingredientId: chip.ingredientId,
                              name: chip.label,
                              unit: chip.defaultUnit,
                              sufficient: true,
                            },
                          ],
                        });
                      }
                    }}
                    aria-pressed={active}
                    className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1 ${
                      active
                        ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                        : 'border-[#D8CFC0] dark:border-[#2A3B34]'
                    }`}
                  >
                    {active && <Check className="w-3 h-3" aria-hidden="true" />}
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleAddPantry} className="flex gap-2">
              <input
                type="text"
                value={newPantryName}
                onChange={(e) => setNewPantryName(e.target.value)}
                placeholder="Add pantry item..."
                aria-label="Add pantry item"
                className="flex-1 min-h-[44px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-xl bg-[#1B4D3E] text-[#FAF8F4] text-sm font-medium"
              >
                Add
              </button>
            </form>

            {profile.pantry.length > 0 && (
              <ul className="divide-y divide-[#EFE9DD] dark:divide-[#2A3B34] max-h-48 overflow-y-auto">
                {profile.pantry.map((p) => (
                  <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                    <span>
                      {p.name}{' '}
                      <span className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                        · {p.sufficient ? 'Sufficient' : `${p.quantity ?? 0} ${p.unit ?? 'g'}`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateProfile({
                          ...profile,
                          pantry: profile.pantry.filter((x) => x.id !== p.id),
                        })
                      }
                      aria-label={`Remove ${p.name}`}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#535E58] hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* 9. Budget & Preferred Store */}
      <section
        id="settings-section-budget"
        className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] overflow-hidden"
      >
        {renderAccordionHeader(
          'budget',
          '9. Budget & Preferred Store',
          `₱${profile.weeklyBudgetPhp.toLocaleString()}/wk · ${profile.budgetPreset} · ${profile.preferredStore}`,
          <Wallet className="w-4 h-4" />
        )}
        {openSections.budget && (
          <div className="px-5 pb-5 pt-3 border-t border-[#EFE9DD] dark:border-[#2A3B34] grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="set-budget" className="block text-xs font-medium mb-1">
                Weekly Budget (PHP)
              </label>
              <input
                id="set-budget"
                type="number"
                min={200}
                step={50}
                value={profile.weeklyBudgetPhp}
                onChange={(e) =>
                  onUpdateProfile({
                    ...profile,
                    weeklyBudgetPhp: Math.max(200, Number(e.target.value) || 200),
                  })
                }
                className="w-full min-h-[46px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm font-mono-tabular font-semibold"
              />
            </div>
            <div>
              <label htmlFor="set-preset" className="block text-xs font-medium mb-1">
                Budget Style
              </label>
              <select
                id="set-preset"
                value={profile.budgetPreset}
                onChange={(e) =>
                  onUpdateProfile({
                    ...profile,
                    budgetPreset: e.target.value as BudgetPreset,
                  })
                }
                className="w-full min-h-[46px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm"
              >
                <option value="tipid">Tipid</option>
                <option value="balanced">Balanced</option>
                <option value="sagana">Sagana</option>
              </select>
            </div>
            <div>
              <label htmlFor="set-store" className="block text-xs font-medium mb-1">
                Preferred Store
              </label>
              <select
                id="set-store"
                value={profile.preferredStore}
                onChange={(e) =>
                  onUpdateProfile({
                    ...profile,
                    preferredStore: e.target.value as StoreId,
                  })
                }
                className="w-full min-h-[46px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm"
              >
                {STORE_LIST.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.multiplier.toFixed(2)}×{s.isProvisional ? ' est.' : ''})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </section>

      {/* 10. Advanced: Dataset Integrity, PSGC Import & Reset */}
      <section
        id="settings-section-advanced"
        className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] overflow-hidden"
      >
        {renderAccordionHeader(
          'advanced',
          '10. Advanced (Dataset, PSGC & Reset)',
          `${dataset.validationReport.counts.dishes} dishes · ${psgc.regions.length} PSGC regions · Reset data`,
          <Database className="w-4 h-4" />
        )}
        {openSections.advanced && (
          <div className="px-5 pb-5 pt-3 border-t border-[#EFE9DD] dark:border-[#2A3B34] space-y-5">
            <div className="rounded-xl bg-[#F3EFE6]/70 dark:bg-[#111815] p-4 space-y-2.5">
              <p className="text-xs font-semibold text-[#1E2421] dark:text-[#F2EFE9]">
                {t.settings.datasetStatus}
              </p>
              <p className="text-xs font-mono-tabular text-[#535E58] dark:text-[#A6B5AE]">
                Dishes: {dataset.validationReport.counts.dishes} · Ingredients:{' '}
                {dataset.validationReport.counts.ingredients} · Links:{' '}
                {dataset.validationReport.counts.dishIngredients} · Hidden Allergens:{' '}
                {dataset.validationReport.counts.hiddenAllergens} · Swaps:{' '}
                {dataset.validationReport.counts.ingredientSwaps} · Broken refs:{' '}
                {dataset.validationReport.brokenReferences.length}
              </p>
              <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                PSGC Source: {psgc.source} — {psgc.version}
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] text-xs font-medium cursor-pointer hover:bg-[#FAF8F4]">
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  <span>{t.settings.psgcImportTitle}</span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={handlePsgcUpload}
                    className="sr-only"
                  />
                </label>
                {psgcMessage && (
                  <span className="text-xs text-[#1B4D3E] dark:text-[#86B8A3]">{psgcMessage}</span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-red-300/60 dark:border-red-900/60 p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
                  {t.settings.resetTitle}
                </h3>
                <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] mt-0.5">
                  {t.settings.resetDesc}
                </p>
              </div>
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="min-h-[44px] px-4 rounded-xl border border-red-600 text-red-700 dark:text-red-300 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  {t.common.reset}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="min-h-[44px] px-3.5 rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] text-xs font-medium"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmReset(false);
                      onResetAll();
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-red-700 text-white text-xs font-semibold hover:bg-red-800"
                  >
                    {t.settings.resetConfirm}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
