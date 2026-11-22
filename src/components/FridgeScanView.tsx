import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  DetectedIngredient,
  Dish,
  UlamWiseDataset,
  UserProfile,
} from '../types';
import { matchIngredientByName, recommendDishesFromIngredients } from '../lib/fridge';
import type { Translations } from '../lib/i18n';
import { formatPhp } from '../lib/pricing';
import { DishIllustration } from './DishIllustration';

interface FridgeScanViewProps {
  profile: UserProfile;
  dataset: UlamWiseDataset;
  t: Translations;
  onAddItemsToPantry: (items: DetectedIngredient[]) => void;
  onSelectDish: (dish: Dish) => void;
}

export const FridgeScanView: React.FC<FridgeScanViewProps> = ({
  profile,
  dataset,
  t,
  onAddItemsToPantry,
  onSelectDish,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedIngredient[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [addedToPantryMsg, setAddedToPantryMsg] = useState(false);

  const recommendations = useMemo(
    () => recommendDishesFromIngredients(detected, profile, dataset),
    [detected, profile, dataset]
  );

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
          setScanError('No ingredients were clearly recognized. Add your visible ingredients below.');
        }
      } catch {
        setScanError('Unable to reach the image scan service. Add your available ingredients below to get dish ideas.');
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddManual = (e: React.FormEvent) => {
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

  const handleAddToPantry = () => {
    const confirmed = detected.filter((d) => d.confirmed);
    if (confirmed.length === 0) return;
    onAddItemsToPantry(confirmed);
    setAddedToPantryMsg(true);
    setTimeout(() => setAddedToPantryMsg(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t.fridge.title}</h1>
        <p className="mt-1 text-sm text-[#535E58] dark:text-[#A6B5AE] max-w-2xl">
          {t.fridge.subtitle}
        </p>
      </div>

      {/* Upload + Manual Entry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-5 space-y-4">
          <label
            htmlFor="fridge-photo-input"
            className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#C7BFA9] dark:border-[#344A41] bg-[#FAF8F4] dark:bg-[#111815] p-6 text-center cursor-pointer hover:bg-[#F3EFE6] dark:hover:bg-[#1F2C27] transition-colors min-h-[180px]"
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

          {scanError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/25 p-3 text-xs text-amber-950 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{scanError}</span>
            </div>
          )}

          {/* Manual quick entry */}
          <form onSubmit={handleAddManual} className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="e.g., itlog, talong, kamatis, manok, kangkong"
              aria-label={t.fridge.addDetectedItem}
              className="flex-1 min-h-[44px] rounded-xl border border-[#D8CFC0] dark:border-[#2A3B34] bg-[#FAF8F4] dark:bg-[#111815] px-3.5 text-sm"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-[#1B4D3E] text-[#FAF8F4] text-sm font-medium"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add</span>
            </button>
          </form>
        </section>

        {/* Human Confirmation List */}
        <section className="rounded-2xl border border-[#E4DDD0] dark:border-[#2A3B34] bg-white dark:bg-[#18221E] p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t.fridge.confirmHeading}</h2>
            <p className="text-xs text-[#535E58] dark:text-[#A6B5AE] mt-0.5">
              {t.fridge.confirmHint}
            </p>
          </div>

          {detected.length === 0 ? (
            <p className="text-sm text-[#535E58] dark:text-[#A6B5AE] py-8 text-center">
              Upload a photo or type what is in your fridge to start matching recipes.
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
                      className="h-4 w-4 accent-[#1B4D3E]"
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
                              ? { ...d, name: e.target.value, matchedIngredientId: matched?.ingredient_id }
                              : d
                          )
                        );
                      }}
                      className="flex-1 bg-transparent text-sm min-h-[36px] focus:outline-none"
                    />
                    <span className="text-[11px] text-[#535E58] dark:text-[#A6B5AE] shrink-0">
                      {item.confidence}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetected((prev) => prev.filter((d) => d.id !== item.id))}
                      aria-label={`Remove ${item.name}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#535E58] hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddToPantry}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#1B4D3E] dark:border-[#34926F] text-[#1B4D3E] dark:text-[#86B8A3] text-sm font-medium hover:bg-[#1B4D3E]/5"
              >
                {addedToPantryMsg ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{addedToPantryMsg ? 'Added to Pantry' : t.fridge.addToPantry}</span>
              </button>
            </>
          )}
        </section>
      </div>

      {/* Recommended Filipino Dishes */}
      {recommendations.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            {t.fridge.findDishes} ({recommendations.length})
          </h2>
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
                    {rec.dish.name_en}
                  </p>
                  <p className="text-xs text-[#1B4D3E] dark:text-[#86B8A3]">
                    <strong>{t.fridge.availableLabel}:</strong> {rec.matchedIngredientNames.join(', ')}
                  </p>
                  {rec.missingIngredientNames.length > 0 && (
                    <p className="text-xs text-[#535E58] dark:text-[#A6B5AE]">
                      <strong>{t.fridge.missingLabel}:</strong> {rec.missingIngredientNames.join(', ')}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
