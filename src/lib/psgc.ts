import psgcCompact from '../data/psgc_compact.json';
import type {
  CityOverride,
  LocationSelection,
  ProvinceCuisine,
  PsgcCity,
  PsgcDataset,
  PsgcProvince,
  PsgcRegion,
  RegionRecord,
  UlamWiseDataset,
} from '../types';

export function getDefaultPsgcDataset(): PsgcDataset {
  return psgcCompact as PsgcDataset;
}

export function getProvincesForRegion(psgc: PsgcDataset, regionCode: string): PsgcProvince[] {
  return psgc.provinces.filter((p) => p.regionCode === regionCode);
}

export function getCitiesForProvince(psgc: PsgcDataset, provinceCode: string): PsgcCity[] {
  return psgc.cities.filter((c) => c.p === provinceCode);
}

export function normalizeGeoName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^city of\s+/i, '')
    .replace(/\s+city$/i, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface ResolvedRegionalContext {
  region: RegionRecord;
  provinceCuisine: ProvinceCuisine | null;
  cityOverride: CityOverride | null;
  primaryCuisineZone: string;
  secondaryCuisineZones: string[];
  coastalProfile: 'coastal' | 'inland' | 'coastal+inland';
  boostDishIds: string[];
  localFoodNotes: string;
  priceNotes: string;
  defaultHalalRecommended: boolean;
}

export function resolveRegionalContext(
  location: LocationSelection,
  dataset: UlamWiseDataset
): ResolvedRegionalContext {
  // Handle Cotabato City (historically Region XII in older PSGC, politically BARMM)
  const normCity = normalizeGeoName(location.cityName);
  const normProvince = normalizeGeoName(location.provinceName);

  const cityOverride =
    dataset.cityOverrides.find((c) => normalizeGeoName(c.city) === normCity) ?? null;

  let regionKey = cityOverride?.region_key || location.regionKey || 'ncr';
  let provinceCuisine =
    dataset.provinceCuisineMap.find((p) => normalizeGeoName(p.province) === normProvince) ?? null;

  // Map legacy PSGC "Maguindanao" cleanly to Maguindanao del Norte / BARMM cuisine zone
  if (!provinceCuisine && normProvince === 'maguindanao') {
    provinceCuisine =
      dataset.provinceCuisineMap.find((p) => normalizeGeoName(p.province).startsWith('maguindanao')) ??
      null;
  }

  // If Negros Occidental/Oriental/Siquijor and NIR exists in regions.csv, prefer province's cuisine zone
  if (provinceCuisine && !cityOverride && dataset.regionsByKey.has(provinceCuisine.region_key)) {
    regionKey = provinceCuisine.region_key;
  }

  const region =
    dataset.regionsByKey.get(regionKey) ??
    dataset.regionsByKey.get(location.regionKey) ??
    dataset.regionsByKey.get('ncr') ??
    dataset.regions[0];

  const primaryCuisineZone =
    cityOverride?.cuisine_zone ||
    provinceCuisine?.cuisine_zone ||
    region.default_cuisine_zone;

  const secondaryCuisineZones = Array.from(
    new Set([
      region.default_cuisine_zone,
      ...region.secondary_zones,
      'national',
    ])
  ).filter((z) => z !== primaryCuisineZone);

  const coastalProfile: 'coastal' | 'inland' | 'coastal+inland' =
    cityOverride?.coastal_profile ??
    provinceCuisine?.coastal_profile ??
    (region.coastal_profile === 'inland'
      ? 'inland'
      : region.coastal_profile === 'coastal'
      ? 'coastal'
      : 'coastal+inland');

  const boostDishIds = Array.from(
    new Set([...(cityOverride?.boost_dish_ids ?? []), ...region.signature_dish_ids])
  );

  const localFoodNotes = cityOverride?.local_food_notes || region.food_notes;
  const priceNotes = [cityOverride?.price_notes, region.price_notes]
    .filter((s) => s && s.trim().length > 0)
    .join(' · ');

  return {
    region,
    provinceCuisine,
    cityOverride,
    primaryCuisineZone,
    secondaryCuisineZones,
    coastalProfile,
    boostDishIds,
    localFoodNotes,
    priceNotes,
    defaultHalalRecommended: region.region_key === 'barmm',
  };
}

/**
 * Validates and imports a user-supplied PSGC JSON file (compatible with UlamWise compact PSGC format
 * or custom PSA PSGC export with { regions, provinces, cities }).
 */
export function parseImportedPsgcJson(jsonText: string): { ok: true; data: PsgcDataset } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(jsonText);
    if (
      !parsed ||
      !Array.isArray(parsed.regions) ||
      !Array.isArray(parsed.provinces) ||
      !Array.isArray(parsed.cities)
    ) {
      return {
        ok: false,
        error: 'Invalid PSGC JSON structure. Expected { regions: [], provinces: [], cities: [] }.',
      };
    }
    if (parsed.regions.length === 0 || parsed.cities.length === 0) {
      return { ok: false, error: 'PSGC file must include at least one region and city/municipality.' };
    }
    const normalized: PsgcDataset = {
      source: typeof parsed.source === 'string' ? parsed.source : 'Imported custom PSGC file',
      version: typeof parsed.version === 'string' ? parsed.version : `Custom import (${new Date().toLocaleDateString()})`,
      regions: parsed.regions.map((r: PsgcRegion) => ({
        code: String(r.code),
        regionKey: String(r.regionKey || 'ncr'),
        regionName: String(r.regionName || r.name),
        name: String(r.name),
      })),
      provinces: parsed.provinces.map((p: PsgcProvince) => ({
        code: String(p.code),
        name: String(p.name),
        regionCode: String(p.regionCode),
        isDistrict: Boolean(p.isDistrict),
        isIndependent: Boolean(p.isIndependent),
      })),
      cities: parsed.cities.map((c: PsgcCity & { code?: string; name?: string; provinceCode?: string; regionCode?: string; isCity?: boolean }) => ({
        c: String(c.c ?? c.code ?? ''),
        n: String(c.n ?? c.name ?? ''),
        p: String(c.p ?? c.provinceCode ?? ''),
        r: String(c.r ?? c.regionCode ?? ''),
        city: Boolean(c.city ?? c.isCity),
      })),
    };
    return { ok: true, data: normalized };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unable to parse PSGC JSON' };
  }
}
