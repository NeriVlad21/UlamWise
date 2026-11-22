import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  Trash2,
  User,
} from 'lucide-react';
import type {
  ActivityLevel,
  AllergenId,
  BiologicalSexOption,
  DietaryPrefCategory,
  DietaryPrefId,
  HouseholdMember,
  PortionPreference,
  WeightGoal,
} from '../types';
import {
  ALLERGEN_LIST,
  DIETARY_CATEGORY_LABELS,
  DIETARY_PREFS_LIST,
  detectDietaryConflicts,
} from '../lib/allergens';
import {
  ACTIVITY_LABELS,
  calculateMemberCalorieTarget,
  getMinorReferenceKcal,
} from '../lib/nutrition';
import { NumericInput } from './NumericInput';

interface MemberNutritionCardProps {
  member: HouseholdMember;
  canRemove: boolean;
  defaultExpanded?: boolean;
  scheduleSummary?: string;
  onChange: (updated: HouseholdMember) => void;
  onRemove: () => void;
  onFieldValidityChange?: (fieldKey: string, isValid: boolean, error: string | null) => void;
}

export const MemberNutritionCard: React.FC<MemberNutritionCardProps> = ({
  member,
  canRemove,
  defaultExpanded = false,
  scheduleSummary,
  onChange,
  onRemove,
  onFieldValidityChange,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dislikesDraft, setDislikesDraft] = useState((member.dislikes ?? []).join(', '));

  const cal = useMemo(() => calculateMemberCalorieTarget(member), [member]);
  const isMinor = member.age < 18;

  const handleAgeCommit = (age: number) => {
    if (age < 18) {
      onChange({
        ...member,
        age,
        calorieMode: 'manual',
        manualTargetKcal:
          member.age >= 18 ? getMinorReferenceKcal(age) : member.manualTargetKcal,
      });
    } else {
      onChange({ ...member, age });
    }
  };

  return (
    <div className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] overflow-hidden">
      {/* Header Summary Row */}
      <div className="p-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex items-center gap-3 text-left min-w-0 flex-1 min-h-[44px]"
        >
          <span className="w-10 h-10 rounded-xl bg-[#1B4D3E]/12 dark:bg-[#2B7A5C]/30 text-[#1B4D3E] dark:text-[#86B8A3] flex items-center justify-center shrink-0">
            <User className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm sm:text-base font-semibold text-[#1E2421] dark:text-[#F2EFE9] truncate">
              {member.label || 'Household Member'}{' '}
              <span className="text-xs font-normal text-[#535E58] dark:text-[#A6B5AE]">
                · {member.age} yrs · {member.portionPreference} portion
              </span>
            </p>
            <p className="text-xs font-mono-tabular text-[#535E58] dark:text-[#A6B5AE] truncate mt-0.5">
              Target: {cal.dailyTargetKcal} kcal/day ({isMinor ? 'Under 18 · manual' : member.calorieMode} · Est.)
              {scheduleSummary ? ` · ${scheduleSummary}` : ''}
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[#535E58] shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#535E58] shrink-0" aria-hidden="true" />
          )}
        </button>

        {canRemove && (
          <div className="shrink-0">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label={`Remove ${member.label}`}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#535E58] hover:text-red-700 hover:bg-red-50 dark:text-[#A6B5AE] dark:hover:bg-red-950/30"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="min-h-[40px] px-2.5 rounded-lg border border-[#D8CFC0] dark:border-[#2A3B34] text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  className="min-h-[40px] px-2.5 rounded-lg bg-red-700 text-white text-xs font-semibold"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expandable Full Individual Profile */}
      {expanded && (
        <div className="px-4 pb-5 pt-3 border-t border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] space-y-4">
          {/* Identity, Age & Portion Size */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor={`mem-name-${member.id}`}
                className="block text-xs font-medium text-[#535E58] dark:text-[#A6B5AE] mb-1"
              >
                Name / Nickname
              </label>
              <input
                id={`mem-name-${member.id}`}
                type="text"
                value={member.label}
                onChange={(e) => onChange({ ...member, label: e.target.value })}
                className="w-full min-h-[44px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor={`mem-age-${member.id}`}
                className="block text-xs font-medium text-[#535E58] dark:text-[#A6B5AE] mb-1"
              >
                Age (years)
              </label>
              <NumericInput
                id={`mem-age-${member.id}`}
                value={member.age}
                allowDecimal={false}
                required
                min={1}
                max={110}
                label="age"
                unit="years"
                placeholder="e.g., 28"
                shouldCommitOnChange={(parsed) => parsed >= 18 || member.age < 18}
                onValueChange={handleAgeCommit}
                onValidityChange={(valid, err) =>
                  onFieldValidityChange?.(`${member.id}:age`, valid, err)
                }
              />
            </div>

            <div>
              <label
                htmlFor={`mem-portion-${member.id}`}
                className="block text-xs font-medium text-[#535E58] dark:text-[#A6B5AE] mb-1"
              >
                Portion Preference
              </label>
              <select
                id={`mem-portion-${member.id}`}
                value={member.portionPreference}
                onChange={(e) =>
                  onChange({ ...member, portionPreference: e.target.value as PortionPreference })
                }
                className="w-full min-h-[44px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm"
              >
                <option value="small">Small (0.8×)</option>
                <option value="regular">Regular (1.0×)</option>
                <option value="large">Large (1.25×)</option>
              </select>
            </div>
          </div>

          {/* Under-18 Minor Guidance OR Adult Auto/Manual Calorie Mode */}
          {isMinor ? (
            <div className="rounded-xl border border-[#C9972B]/40 bg-[#C9972B]/10 p-3.5 space-y-3">
              <div className="flex items-start gap-2 text-xs text-[#6F4F09] dark:text-[#F0CB73]">
                <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{cal.minorGuidanceMessage}</span>
              </div>
              <div>
                <label
                  htmlFor={`mem-minor-kcal-${member.id}`}
                  className="block text-xs font-medium mb-1"
                >
                  Daily Calorie Estimate (optional manual target, kcal/day)
                </label>
                <NumericInput
                  id={`mem-minor-kcal-${member.id}`}
                  value={member.manualTargetKcal}
                  allowDecimal={false}
                  required
                  min={800}
                  max={3500}
                  label="daily calorie target"
                  suffix="kcal"
                  placeholder="e.g., 1500"
                  className="w-48"
                  inputClassName="bg-white dark:bg-[#111815] font-semibold"
                  onValueChange={(kcal) =>
                    onChange({
                      ...member,
                      calorieMode: 'manual',
                      manualTargetKcal: kcal,
                    })
                  }
                  onValidityChange={(valid, err) =>
                    onFieldValidityChange?.(`${member.id}:minorKcal`, valid, err)
                  }
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Auto vs Manual Switch */}
              <div className="inline-flex rounded-xl bg-[#F3EFE6] dark:bg-[#111815] p-1">
                <button
                  type="button"
                  onClick={() => onChange({ ...member, calorieMode: 'auto' })}
                  aria-pressed={member.calorieMode === 'auto'}
                  className={`min-h-[38px] px-3.5 rounded-lg text-xs font-medium transition-colors ${
                    member.calorieMode === 'auto'
                      ? 'bg-[#1B4D3E] text-[#FAF8F4] dark:bg-[#2B7A5C]'
                      : 'text-[#535E58] dark:text-[#A6B5AE]'
                  }`}
                >
                  Automatic (Mifflin-St Jeor)
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...member, calorieMode: 'manual' })}
                  aria-pressed={member.calorieMode === 'manual'}
                  className={`min-h-[38px] px-3.5 rounded-lg text-xs font-medium transition-colors ${
                    member.calorieMode === 'manual'
                      ? 'bg-[#1B4D3E] text-[#FAF8F4] dark:bg-[#2B7A5C]'
                      : 'text-[#535E58] dark:text-[#A6B5AE]'
                  }`}
                >
                  Manual Target
                </button>
              </div>

              {member.calorieMode === 'auto' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor={`mem-sex-${member.id}`}
                      className="block text-xs font-medium text-[#535E58] dark:text-[#A6B5AE] mb-1"
                    >
                      Equation Option
                    </label>
                    <select
                      id={`mem-sex-${member.id}`}
                      value={member.sex}
                      onChange={(e) =>
                        onChange({ ...member, sex: e.target.value as BiologicalSexOption })
                      }
                      className="w-full min-h-[44px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm"
                    >
                      <option value="female">Female equation</option>
                      <option value="male">Male equation</option>
                      <option value="average">Neutral midpoint</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor={`mem-height-${member.id}`}
                      className="block text-xs font-medium text-[#535E58] dark:text-[#A6B5AE] mb-1"
                    >
                      Height (cm)
                    </label>
                    <NumericInput
                      id={`mem-height-${member.id}`}
                      value={member.heightCm}
                      allowDecimal
                      required
                      min={110}
                      max={230}
                      label="height"
                      suffix="cm"
                      placeholder="e.g., 167"
                      onValueChange={(heightCm) => onChange({ ...member, heightCm })}
                      onValidityChange={(valid, err) =>
                        onFieldValidityChange?.(`${member.id}:height`, valid, err)
                      }
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`mem-weight-${member.id}`}
                      className="block text-xs font-medium text-[#535E58] dark:text-[#A6B5AE] mb-1"
                    >
                      Weight (kg)
                    </label>
                    <NumericInput
                      id={`mem-weight-${member.id}`}
                      value={member.weightKg}
                      allowDecimal
                      required
                      min={30}
                      max={220}
                      label="weight"
                      suffix="kg"
                      placeholder="e.g., 65"
                      onValueChange={(weightKg) => onChange({ ...member, weightKg })}
                      onValidityChange={(valid, err) =>
                        onFieldValidityChange?.(`${member.id}:weight`, valid, err)
                      }
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`mem-act-${member.id}`}
                      className="block text-xs font-medium text-[#535E58] dark:text-[#A6B5AE] mb-1"
                    >
                      Activity Level
                    </label>
                    <select
                      id={`mem-act-${member.id}`}
                      value={member.activityLevel}
                      onChange={(e) =>
                        onChange({ ...member, activityLevel: e.target.value as ActivityLevel })
                      }
                      className="w-full min-h-[44px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm"
                    >
                      {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => (
                        <option key={level} value={level}>
                          {ACTIVITY_LABELS[level]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor={`mem-goal-${member.id}`}
                      className="block text-xs font-medium text-[#535E58] dark:text-[#A6B5AE] mb-1"
                    >
                      Goal
                    </label>
                    <select
                      id={`mem-goal-${member.id}`}
                      value={member.goal}
                      onChange={(e) => {
                        const goal = e.target.value as WeightGoal;
                        const delta = goal === 'lose' ? -350 : goal === 'gain' ? 300 : 0;
                        onChange({ ...member, goal, goalAdjustmentKcal: delta });
                      }}
                      className="w-full min-h-[44px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm"
                    >
                      <option value="maintain">Maintain weight (0 kcal)</option>
                      <option value="lose">Lose weight (-350 kcal)</option>
                      <option value="gain">Gain weight (+300 kcal)</option>
                    </select>
                  </div>

                  <div className="rounded-xl bg-[#F3EFE6] dark:bg-[#1F2C27] p-3 flex flex-col justify-center">
                    <span className="text-[11px] text-[#535E58] dark:text-[#A6B5AE]">
                      Est. BMR {cal.bmr} · TDEE {cal.tdee}
                    </span>
                    <strong className="text-base font-mono-tabular text-[#1B4D3E] dark:text-[#86B8A3]">
                      {cal.dailyTargetKcal} kcal/day
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label
                      htmlFor={`mem-manual-${member.id}`}
                      className="block text-xs font-medium text-[#535E58] dark:text-[#A6B5AE] mb-1"
                    >
                      Manual Daily Calorie Target (kcal/day)
                    </label>
                    <NumericInput
                      id={`mem-manual-${member.id}`}
                      value={member.manualTargetKcal}
                      allowDecimal={false}
                      required
                      min={900}
                      max={4500}
                      label="daily calorie target"
                      suffix="kcal"
                      placeholder="e.g., 2000"
                      className="w-48"
                      inputClassName="font-semibold"
                      onValueChange={(kcal) =>
                        onChange({
                          ...member,
                          calorieMode: 'manual',
                          manualTargetKcal: kcal,
                        })
                      }
                      onValidityChange={(valid, err) =>
                        onFieldValidityChange?.(`${member.id}:manualKcal`, valid, err)
                      }
                    />
                  </div>
                  <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] pb-2">
                    Preserved independently from other household members.
                  </p>
                </div>
              )}
            </div>
          )}

          {cal.isRestrictiveWarning && cal.warningMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{cal.warningMessage}</span>
            </div>
          )}

          {/* Individual Allergies, Dietary Preferences & Dislikes */}
          <div className="pt-3 border-t border-[#EFE9DD] dark:border-[#2A3B34] space-y-3">
            <div>
              <p className="text-xs font-semibold text-[#1E2421] dark:text-[#F2EFE9] mb-1.5">
                {member.label}&apos;s Allergies (protects all meals {member.label} eats)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALLERGEN_LIST.map((a) => {
                  const active = (member.allergies ?? []).includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...member,
                          allergies: active
                            ? member.allergies.filter((x) => x !== a.id)
                            : [...(member.allergies ?? []), a.id as AllergenId],
                        })
                      }
                      aria-pressed={active}
                      className={`min-h-[38px] px-2.5 rounded-lg border text-xs font-medium transition-colors ${
                        active
                          ? 'border-red-700 bg-red-700 text-white'
                          : 'border-[#D8CFC0] dark:border-[#2A3B34] text-[#535E58] dark:text-[#A6B5AE]'
                      }`}
                    >
                      {a.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#1E2421] dark:text-[#F2EFE9]">
                {member.label}&apos;s Dietary Preferences
              </p>
              {(['eating_style', 'nutrition_goal', 'food_exclusion'] as DietaryPrefCategory[]).map(
                (cat) => (
                  <div key={cat} className="space-y-1.5">
                    <p className="text-[11px] font-medium text-[#535E58] dark:text-[#A6B5AE]">
                      {DIETARY_CATEGORY_LABELS[cat].en}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {DIETARY_PREFS_LIST.filter((d) => d.category === cat).map((d) => {
                        const active = (member.dietaryPrefs ?? []).includes(d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() =>
                              onChange({
                                ...member,
                                dietaryPrefs: active
                                  ? member.dietaryPrefs.filter((x) => x !== d.id)
                                  : [...(member.dietaryPrefs ?? []), d.id as DietaryPrefId],
                              })
                            }
                            aria-pressed={active}
                            className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-medium transition-colors ${
                              active
                                ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF8F4] dark:border-[#2B7A5C] dark:bg-[#2B7A5C]'
                                : 'border-[#D8CFC0] dark:border-[#2A3B34] text-[#535E58] dark:text-[#A6B5AE]'
                            }`}
                          >
                            {d.labelEn}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              )}

              {(member.dietaryPrefs ?? []).includes('keto') && (
                <div className="rounded-xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] p-3 flex flex-wrap items-end gap-3">
                  <div className="w-44">
                    <label
                      htmlFor={`mem-keto-${member.id}`}
                      className="block text-[11px] font-medium text-[#535E58] dark:text-[#A6B5AE] mb-1"
                    >
                      Keto daily carb target
                    </label>
                    <NumericInput
                      id={`mem-keto-${member.id}`}
                      value={member.ketoMaxCarbsPerDayG ?? 25}
                      allowDecimal={false}
                      required
                      min={10}
                      max={60}
                      label="keto carb target"
                      suffix="g/day"
                      inputClassName="pr-14 font-semibold"
                      onValueChange={(ketoMaxCarbsPerDayG) =>
                        onChange({ ...member, ketoMaxCarbsPerDayG })
                      }
                      onValidityChange={(valid, err) =>
                        onFieldValidityChange?.(`${member.id}:ketoCarbs`, valid, err)
                      }
                    />
                  </div>
                  <p className="text-[11px] text-[#535E58] dark:text-[#A6B5AE] flex-1 min-w-[180px]">
                    Applies stricter carb limits to meals {member.label} attends.
                  </p>
                </div>
              )}

              {detectDietaryConflicts(member.dietaryPrefs ?? []).map((c, idx) => (
                <div
                  key={idx}
                  role="alert"
                  className={`flex items-start gap-2 rounded-xl border p-2.5 text-xs ${
                    c.severity === 'conflict'
                      ? 'border-red-500/40 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200'
                      : 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{c.message}</span>
                </div>
              ))}
            </div>

            <div>
              <label
                htmlFor={`mem-dislikes-${member.id}`}
                className="block text-xs font-medium text-[#535E58] dark:text-[#A6B5AE] mb-1"
              >
                {member.label}&apos;s Dislikes (comma-separated)
              </label>
              <input
                id={`mem-dislikes-${member.id}`}
                type="text"
                value={dislikesDraft}
                placeholder="e.g., ampalaya, okra, atay"
                onChange={(e) => {
                  setDislikesDraft(e.target.value);
                  onChange({
                    ...member,
                    dislikes: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  });
                }}
                className="w-full min-h-[42px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-xs sm:text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
