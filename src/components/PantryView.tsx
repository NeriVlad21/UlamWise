import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  DetectedIngredient,
  Dish,
  PantryItem,
  UlamWiseDataset,
  UserProfile,
} from '../types';
import { matchIngredientByName, recommendDishesFromIngredients } from '../lib/fridge';
import type { Translations } from '../lib/i18n';
import { formatPhp } from '../lib/pricing';
import { QUICK_PANTRY_CHIPS } from '../lib/storage';
import { DishIllustration } from './DishIllustration';

interface PantryViewProps {
  profile: UserProfile;
  dataset: UlamWiseDataset;
  t: Translations;
  initialSubTab?: 'inventory' | 'scan';
  onUpdatePantry: (nextPantry: PantryItem[]) => void;
  onAddScannedItemsToPantry: (items: DetectedIngredient[]) => void;
  onSelectDish: (dish: Dish) => void;
}

const SCAN_STEPS = [
  { num: 1, label: 'Upload Photo' },
  { num: 2, label: 'AI Vision Scan' },
  { num: 3, label: 'Detected Items' },
  { num: 4, label: 'Confirm' },
  { num: 5, label: 'Recipes' },
  { num: 6, label: 'Extra Cost' },
];

export const PantryView: React.FC<PantryViewProps> = ({
  profile,
  dataset,
  t,
  initialSubTab = 'inventory',
  onUpdatePantry,
  onAddScannedItemsToPantry,
  onSelectDish,
}) => {
  const [subTab, setSubTab] = useState<'inventory' | 'scan'>(initialSubTab);

  // Inventory state
  const [searchQuery, setSearchQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newUnit, setNewUnit] = useState<'g' | 'ml' | 'pc' | 'kg' | 'L'>('g');
  const [newSufficient, setNewSufficient] = useState(true);

  // Fridge Scan 6-state flow
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedIngredient[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [addedToPantryMsg, setAddedToPantryMsg] = useState(false);

  const filteredPantry = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return profile.pantry;
    return profile.pantry.filter((item) => item.name.toLowerCase().includes(q));
  }, [profile.pantry, searchQuery]);

  const confirmedCount = useMemo(
    () => detected.filter((d) => d.confirmed).length,
    [detected]
  );

  const recommendations = useMemo(
    () => recommendDishesFromIngredients(detected, profile, dataset),
    [detected, profile, dataset]
  );

  const activeScanStep = useMemo(() => {
    if (scanning) return 2;
    if (recommendations.length > 0) return 6;
    if (confirmedCount > 0) return 4;
    if (detected.length > 0) return 3;
    return 1;
  }, [scanning, recommendations.length, confirmedCount, detected.length]);

  const toggleQuickChip = (chip: (typeof QUICK_PANTRY_CHIPS)[number]) => {
    const exists = profile.pantry.some(
      (p) =>
        (chip.ingredientId && p.ingredientId === chip.ingredientId) ||
        p.name.toLowerCase() === chip.label.toLowerCase()
    );
    if (exists) {
      onUpdatePantry(
        profile.pantry.filter(
          (p) =>
            !(
              (chip.ingredientId && p.ingredientId === chip.ingredientId) ||
              p.name.toLowerCase() === chip.label.toLowerCase()
            )
        )
      );
    } else {
      onUpdatePantry([
        ...profile.pantry,
        {
          id: `p-${Date.now()}-${chip.label}`,
          ingredientId: chip.ingredientId,
          name: chip.label,
          unit: chip.defaultUnit,
          sufficient: true,
        },
      ]);
    }
  };

  const handleAddInventoryItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    const matched = matchIngredientByName(trimmed, dataset);
    const qtyNum = Number(newQty);
    const item: PantryItem = {
      id: `p-${Date.now()}`,
      ingredientId: matched?.ingredient_id,
      name: matched ? `${matched.name_fil} (${matched.name_en})` : trimmed,
      quantity: !newSufficient && Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : undefined,
      unit: newUnit,
      sufficient: newSufficient,
    };
    onUpdatePantry([...profile.pantry, item]);
    setNewName('');
    setNewQty('');
  };

  const handleToggleItemSufficient = (id: string) => {
    onUpdatePantry(
      profile.pantry.map((item) =>
        item.id === id
          ? {
              ...item,
              sufficient: !item.sufficient,
              quantity: item.sufficient ? item.quantity ?? 250 : undefined,
              unit: item.unit ?? 'g',
            }
          : item
      )
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      setPreviewUrl(dataUrl);
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      const mimeType = file.type || 'image/jpeg';

      setScanning(true);
      try {
        const res = await fetch('/api/fridge/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        const data = await res.json();
        if (!res.ok) {
          setScanError(data.error || 'Could not scan photo right now.');
        } else if (Array.isArray(data.items) && data.items.length > 0) {
          setDetected(data.items);
        } else {
          setScanError(
            'No ingredients were clearly recognized. Add your visible ingredients below.'
          );
        }
      } catch {
        setScanError(
          'Unable to reach the image scan service. Add your available ingredients below to get dish ideas.'
        );
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddManualScan = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = manualInput.trim();
    if (!raw) return;
    const matched = matchIngredientByName(raw, dataset);
    setDetected((prev) => [
      ...prev,
      {
        id: `man-${Date.now()}`,
        name: matched ? `${matched.name_fil} (${matched.name_en})` : raw,
        matchedIngredientId: matched?.ingredient_id,
        confidence: 'high',
        confirmed: true,
      },
    ]);
    setManualInput('');
  };

  const handleConfirmAddToPantry = () => {
    const confirmed = detected.filter((d) => d.confirmed);
    if (confirmed.length === 0) return;
    onAddScannedItemsToPantry(confirmed);
    setAddedToPantryMsg(true);
    setTimeout(() => setAddedToPantryMsg(false), 2600);
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Sub-View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#1E2421] dark:text-[#F2EFE9]">
            {subTab === 'inventory' ? 'Pantry & Staples' : t.fridge.title}
          </h1>
          <p className="mt-1 text-sm text-[#535E58] dark:text-[#A6B5AE] max-w-2xl">
            {subTab === 'inventory'
              ? 'Items tracked in your pantry are automatically deducted from your weekly grocery list so you never double-buy.'
              : t.fridge.subtitle}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Pantry tools"
          className="inline-flex rounded-xl bg-[#EFE9DD] dark:bg-[#18221E] p-1 border border-[#E4DDD0] dark:border-[#2A3B34] self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'inventory'}
            onClick={() => setSubTab('inventory')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium min-h-[44px] whitespace-nowrap transition-colors ${
              subTab === 'inventory'
                ? 'bg-white dark:bg-[#24332C] text-[#1E2421] dark:text-[#F2EFE9] shadow-xs'
                : 'text-[#535E58] dark:text-[#A6B5AE]'
            }`}
          >
            <Package className="w-4 h-4" aria-hidden="true" />
            <span>Pantry ({profile.pantry.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'scan'}
            onClick={() => setSubTab('scan')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium min-h-[44px] whitespace-nowrap transition-colors ${
              subTab === 'scan'
                ? 'bg-white dark:bg-[#24332C] text-[#1E2421] dark:text-[#F2EFE9] shadow-xs'
                : 'text-[#535E58] dark:text-[#A6B5AE]'
            }`}
          >
            <Camera className="w-4 h-4" aria-hidden="true" />
            <span>Fridge Scan</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: PANTRY INVENTORY */}
      {subTab === 'inventory' && (
        <div className="space-y-6">
          {/* Quick-Add Pinoy Staples */}
          <section className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Quick-Add Filipino Pantry Staples</h2>
                <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                  Tap items you already have at home to deduct them from your grocery total.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('scan')}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border border-[#1B4D3E] dark:border-[#34926F] text-[#1B4D3E] dark:text-[#86B8A3] text-xs font-medium hover:bg-[#1B4D3E]/5"
              >
                <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Scan Fridge Photo</span>
              </button>
            </div>

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
                    onClick={() => toggleQuickChip(chip)}
                    aria-pressed={active}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
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
          </section>

          {/* Add Custom Ingredient + Current Pantry Inventory */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-5 space-y-4">
              <h2 className="text-base font-semibold">Add Custom Item</h2>
              <form onSubmit={handleAddInventoryItem} className="space-y-3">
                <div>
                  <label htmlFor="pantry-add-name" className="block text-xs font-medium mb-1">
                    Ingredient name
                  </label>
                  <input
                    id="pantry-add-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Bawang, Toyo, Itlog, Bigas"
                    className="w-full min-h-[44px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-[#535E58] dark:text-[#A6B5AE] cursor-pointer min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={newSufficient}
                    onChange={(e) => setNewSufficient(e.target.checked)}
                    className="h-4 w-4 accent-[#1B4D3E]"
                  />
                  <span>Enough for the whole week</span>
                </label>

                {!newSufficient && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      placeholder="Qty"
                      aria-label="Quantity on hand"
                      className="flex-1 min-h-[44px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 text-sm tabular-nums"
                    />
                    <select
                      value={newUnit}
                      onChange={(e) =>
                        setNewUnit(e.target.value as 'g' | 'ml' | 'pc' | 'kg' | 'L')
                      }
                      aria-label="Unit"
                      className="w-24 min-h-[44px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-2.5 text-sm"
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="L">L</option>
                      <option value="pc">pc</option>
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1B4D3E] hover:bg-[#143B2F] dark:bg-[#2B7A5C] text-[#FAF8F4] text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Add to Pantry</span>
                </button>
              </form>
            </section>

            <section className="lg:col-span-2 rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">
                  On Hand ({profile.pantry.length})
                </h2>
                <div className="relative flex-1 sm:flex-initial sm:w-56">
                  <Search
                    className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#535E58]"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search pantry..."
                    aria-label="Search pantry inventory"
                    className="w-full min-h-[44px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] pl-9 pr-3 text-sm"
                  />
                </div>
              </div>

              {filteredPantry.length === 0 ? (
                <p className="text-sm text-[#535E58] dark:text-[#A6B5AE] py-8 text-center">
                  {profile.pantry.length === 0
                    ? 'Your pantry list is empty. Select staples above or scan your fridge to save on groceries.'
                    : 'No pantry items match your search.'}
                </p>
              ) : (
                <ul className="divide-y divide-[#EFE9DD] dark:divide-[#2A3B34]">
                  {filteredPantry.map((item) => (
                    <li
                      key={item.id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1E2421] dark:text-[#F2EFE9] truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] mt-0.5">
                          {item.sufficient
                            ? 'Sufficient for the week (fully deducted)'
                            : `Partial stock: ${item.quantity ?? 0} ${item.unit ?? 'g'}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleItemSufficient(item.id)}
                          className="min-h-[40px] px-2.5 rounded-lg border border-[#D8CFC0] dark:border-[#2A3B34] text-xs font-medium hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27]"
                        >
                          {item.sufficient ? 'Full' : 'Partial'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdatePantry(profile.pantry.filter((p) => p.id !== item.id))
                          }
                          aria-label={`Remove ${item.name} from pantry`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#535E58] hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: FRIDGE & PANTRY VISION SCAN (6-STATE FLOW) */}
      {subTab === 'scan' && (
        <div className="space-y-6">
          {/* Compact 6-Step Progress Indicator */}
          <ol
            aria-label="Fridge scan workflow steps"
            className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#F3EFE6]/70 dark:bg-[#18221E] p-2.5 text-[11px]"
          >
            {SCAN_STEPS.map((st) => {
              const reached = activeScanStep >= st.num;
              return (
                <li
                  key={st.num}
                  className={`rounded-xl px-2 py-1.5 text-center font-medium transition-colors ${
                    reached
                      ? 'bg-[#1B4D3E] text-[#FAF8F4] dark:bg-[#2B7A5C]'
                      : 'text-[#535E58] dark:text-[#A6B5AE]'
                  }`}
                >
                  <span className="tabular-nums">{st.num}.</span> {st.label}
                </li>
              );
            })}
          </ol>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* State 1 & 2: Upload + Processing */}
            <section className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-5 space-y-4">
              <label
                htmlFor="fridge-photo-input"
                className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#C7BFA9] dark:border-[#344A41] bg-[#FAF8F4] dark:bg-[#111815] p-6 text-center cursor-pointer hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27] transition-colors min-h-[190px]"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Uploaded fridge or pantry preview"
                    className="max-h-52 rounded-lg object-contain"
                  />
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-[#1B4D3E] dark:text-[#86B8A3]" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold">{t.fridge.uploadLabel}</p>
                      <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] mt-1">
                        JPG, PNG, or mobile camera photo
                      </p>
                    </div>
                  </>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1B4D3E] dark:text-[#86B8A3]">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{scanning ? t.fridge.scanning : 'Choose Photo'}</span>
                </span>
                <input
                  id="fridge-photo-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>

              {scanning && (
                <div aria-busy="true" className="space-y-2">
                  <div className="h-10 rounded-xl bg-[#EFE9DD] dark:bg-[#24332C] animate-pulse" />
                  <div className="h-10 rounded-xl bg-[#EFE9DD] dark:bg-[#24332C] animate-pulse" />
                </div>
              )}

              {scanError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/25 p-3 text-xs text-amber-950 dark:text-amber-200"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{scanError}</span>
                </div>
              )}

              <form onSubmit={handleAddManualScan} className="flex gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Add visible item: itlog, talong, kamatis, manok..."
                  aria-label={t.fridge.addDetectedItem}
                  className="flex-1 min-h-[44px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3.5 text-sm"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-[#1B4D3E] text-[#FAF8F4] text-sm font-medium shrink-0"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Add</span>
                </button>
              </form>
            </section>

            {/* State 3 & 4: Detected Ingredients + Human Confirmation */}
            <section className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-5 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{t.fridge.confirmHeading}</h2>
                <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] mt-0.5">
                  {t.fridge.confirmHint}
                </p>
              </div>

              {detected.length === 0 ? (
                <p className="text-sm text-[#535E58] dark:text-[#A6B5AE] py-8 text-center">
                  Upload a fridge photo or type visible ingredients on the left to match safe Filipino recipes.
                </p>
              ) : (
                <>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {detected.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2.5 rounded-xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={item.confirmed}
                          aria-label={`Confirm ${item.name}`}
                          onChange={(e) =>
                            setDetected((prev) =>
                              prev.map((d) =>
                                d.id === item.id ? { ...d, confirmed: e.target.checked } : d
                              )
                            )
                          }
                          className="h-5 w-5 accent-[#1B4D3E] shrink-0"
                        />
                        <input
                          type="text"
                          value={item.name}
                          aria-label="Edit ingredient name"
                          onChange={(e) => {
                            const matched = matchIngredientByName(e.target.value, dataset);
                            setDetected((prev) =>
                              prev.map((d) =>
                                d.id === item.id
                                  ? {
                                      ...d,
                                      name: e.target.value,
                                      matchedIngredientId: matched?.ingredient_id,
                                    }
                                  : d
                              )
                            );
                          }}
                          className="flex-1 bg-transparent text-sm min-h-[38px] focus:outline-none min-w-0"
                        />
                        <span className="text-[11px] text-[#535E58] dark:text-[#A6B5AE] shrink-0 capitalize">
                          {item.confidence}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDetected((prev) => prev.filter((d) => d.id !== item.id))}
                          aria-label={`Remove ${item.name}`}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#535E58] hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmAddToPantry}
                    disabled={confirmedCount === 0}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#1B4D3E] dark:border-[#34926F] text-[#1B4D3E] dark:text-[#86B8A3] text-sm font-medium hover:bg-[#1B4D3E]/5 disabled:opacity-40"
                  >
                    {addedToPantryMsg ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>
                      {addedToPantryMsg
                        ? 'Confirmed items saved to Pantry'
                        : `${t.fridge.addToPantry} (${confirmedCount})`}
                    </span>
                  </button>
                </>
              )}
            </section>
          </div>

          {/* State 5 & 6: Recipe Recommendations + Missing Ingredients & Extra Cost */}
          {recommendations.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#C9972B]" aria-hidden="true" />
                <h2 className="text-xl font-semibold">
                  {t.fridge.findDishes} ({recommendations.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendations.map((rec) => (
                  <button
                    key={rec.dish.dish_id}
                    type="button"
                    onClick={() => onSelectDish(rec.dish)}
                    className="text-left rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] hover:border-[#1B4D3E] p-4 flex items-start gap-3.5 transition-colors"
                  >
                    <DishIllustration dish={rec.dish} size="sm" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-semibold truncate">{rec.dish.name_local}</h3>
                        <span className="font-mono-tabular text-xs font-semibold text-[#1B4D3E] dark:text-[#86B8A3] shrink-0">
                          +{formatPhp(rec.additionalEstimatedCostPhp)}
                        </span>
                      </div>
                      <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] truncate">
                        {rec.dish.name_en} · {t.fridge.extraCostLabel} (Est.)
                      </p>
                      <p className="text-xs text-[#1B4D3E] dark:text-[#86B8A3]">
                        <strong>{t.fridge.availableLabel}:</strong>{' '}
                        {rec.matchedIngredientNames.join(', ')}
                      </p>
                      {rec.missingIngredientNames.length > 0 && (
                        <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                          <strong>{t.fridge.missingLabel}:</strong>{' '}
                          {rec.missingIngredientNames.join(', ')}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
