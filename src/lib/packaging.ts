import type {
  BulkPortionAllocation,
  BulkPurchasePlan,
  GroceryItem,
  Ingredient,
  RegionRecord,
  StoreId,
  UlamWiseDataset,
} from '../types';
import { getAdjustedIngredientBasisPrice } from './pricing';

export interface RetailPackageOption {
  sizeBase: number;
  labelSingular: string;
  labelPlural: string;
  /** Optional bulk discount multiplier relative to base per-unit price (e.g., 0.94 for 5kg rice sack) */
  bulkDiscountMult?: number;
}

export interface ResolvedRetailPurchase {
  packageCount: number;
  packageSizeBase: number;
  purchasedBaseQty: number;
  retailPackageLabel: string;
  packageCostPhp: number;
  consumptionCostPhp: number;
  leftoverBaseQty: number;
  leftoverDisplayLabel: string;
  leftoverValuePhp: number;
  isProvisionalPackagePrice: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatBaseQuantityLabel(qty: number, unit: 'g' | 'ml' | 'pc'): string {
  if (qty <= 0.01) return 'None';
  if (unit === 'pc') {
    const rounded = Math.round(qty * 10) / 10;
    return `${rounded} ${rounded === 1 ? 'pc' : 'pcs'}`;
  }
  if (unit === 'g') {
    if (qty >= 1000) return `${Math.round((qty / 1000) * 100) / 100} kg`;
    return `${Math.round(qty)} g`;
  }
  if (qty >= 1000) return `${Math.round((qty / 1000) * 100) / 100} L`;
  return `${Math.round(qty)} ml`;
}

/**
 * Realistic Philippine palengke & supermarket retail package tiers per ingredient.
 * Never outputs unrealistic retail units like "10 g cornstarch" or "30 ml soy sauce".
 */
const SPECIFIC_PACKAGE_TIERS: Record<string, RetailPackageOption[]> = {
  // Sauces, oils & pantry seasonings (Sangkap at Pampalasa)
  cornstarch: [
    { sizeBase: 100, labelSingular: 'pack (100 g)', labelPlural: 'packs (100 g)' },
    { sizeBase: 200, labelSingular: 'pack (200 g)', labelPlural: 'packs (200 g)', bulkDiscountMult: 0.96 },
    { sizeBase: 400, labelSingular: 'box (400 g)', labelPlural: 'boxes (400 g)', bulkDiscountMult: 0.93 },
  ],
  soy_sauce: [
    { sizeBase: 200, labelSingular: 'pouch (200 ml)', labelPlural: 'pouches (200 ml)' },
    { sizeBase: 385, labelSingular: 'bottle (385 ml)', labelPlural: 'bottles (385 ml)', bulkDiscountMult: 0.96 },
    { sizeBase: 1000, labelSingular: 'bottle (1 L)', labelPlural: 'bottles (1 L)', bulkDiscountMult: 0.92 },
  ],
  vinegar: [
    { sizeBase: 200, labelSingular: 'pouch (200 ml)', labelPlural: 'pouches (200 ml)' },
    { sizeBase: 385, labelSingular: 'bottle (385 ml)', labelPlural: 'bottles (385 ml)', bulkDiscountMult: 0.96 },
    { sizeBase: 1000, labelSingular: 'bottle (1 L)', labelPlural: 'bottles (1 L)', bulkDiscountMult: 0.92 },
  ],
  fish_sauce: [
    { sizeBase: 150, labelSingular: 'bottle (150 ml)', labelPlural: 'bottles (150 ml)' },
    { sizeBase: 350, labelSingular: 'bottle (350 ml)', labelPlural: 'bottles (350 ml)', bulkDiscountMult: 0.96 },
    { sizeBase: 1000, labelSingular: 'bottle (1 L)', labelPlural: 'bottles (1 L)', bulkDiscountMult: 0.92 },
  ],
  oyster_sauce: [
    { sizeBase: 150, labelSingular: 'bottle (150 ml)', labelPlural: 'bottles (150 ml)' },
    { sizeBase: 300, labelSingular: 'bottle (300 ml)', labelPlural: 'bottles (300 ml)', bulkDiscountMult: 0.95 },
  ],
  cooking_oil: [
    { sizeBase: 250, labelSingular: 'pouch (250 ml)', labelPlural: 'pouches (250 ml)' },
    { sizeBase: 500, labelSingular: 'bottle (500 ml)', labelPlural: 'bottles (500 ml)', bulkDiscountMult: 0.96 },
    { sizeBase: 1000, labelSingular: 'bottle (1 L)', labelPlural: 'bottles (1 L)', bulkDiscountMult: 0.93 },
  ],
  tomato_sauce: [
    { sizeBase: 115, labelSingular: 'pouch (115 g)', labelPlural: 'pouches (115 g)' },
    { sizeBase: 200, labelSingular: 'pouch (200 g)', labelPlural: 'pouches (200 g)', bulkDiscountMult: 0.96 },
    { sizeBase: 250, labelSingular: 'pouch (250 g)', labelPlural: 'pouches (250 g)', bulkDiscountMult: 0.95 },
    { sizeBase: 1000, labelSingular: 'pack (1 kg)', labelPlural: 'packs (1 kg)', bulkDiscountMult: 0.9 },
  ],
  banana_ketchup: [
    { sizeBase: 200, labelSingular: 'pouch (200 g)', labelPlural: 'pouches (200 g)' },
    { sizeBase: 320, labelSingular: 'bottle (320 g)', labelPlural: 'bottles (320 g)', bulkDiscountMult: 0.95 },
  ],
  gata: [
    { sizeBase: 200, labelSingular: 'pack (200 ml)', labelPlural: 'packs (200 ml)' },
    { sizeBase: 400, labelSingular: 'can (400 ml)', labelPlural: 'cans (400 ml)', bulkDiscountMult: 0.95 },
    { sizeBase: 1000, labelSingular: 'pack (1 L)', labelPlural: 'packs (1 L)', bulkDiscountMult: 0.9 },
  ],
  salt: [
    { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)' },
    { sizeBase: 500, labelSingular: 'pack (500 g)', labelPlural: 'packs (500 g)', bulkDiscountMult: 0.95 },
  ],
  black_pepper: [
    { sizeBase: 25, labelSingular: 'sachet (25 g)', labelPlural: 'sachets (25 g)' },
    { sizeBase: 50, labelSingular: 'pack (50 g)', labelPlural: 'packs (50 g)', bulkDiscountMult: 0.94 },
  ],
  bay_leaf: [
    { sizeBase: 10, labelSingular: 'pack (10 g)', labelPlural: 'packs (10 g)' },
    { sizeBase: 25, labelSingular: 'pack (25 g)', labelPlural: 'packs (25 g)', bulkDiscountMult: 0.94 },
  ],
  annatto: [
    { sizeBase: 25, labelSingular: 'pack (25 g)', labelPlural: 'packs (25 g)' },
    { sizeBase: 50, labelSingular: 'pack (50 g)', labelPlural: 'packs (50 g)', bulkDiscountMult: 0.94 },
  ],
  curry_powder: [
    { sizeBase: 30, labelSingular: 'pack (30 g)', labelPlural: 'packs (30 g)' },
    { sizeBase: 100, labelSingular: 'jar (100 g)', labelPlural: 'jars (100 g)', bulkDiscountMult: 0.93 },
  ],
  sugar_white: [
    { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)' },
    { sizeBase: 500, labelSingular: 'pack (500 g)', labelPlural: 'packs (500 g)', bulkDiscountMult: 0.96 },
    { sizeBase: 1000, labelSingular: 'pack (1 kg)', labelPlural: 'packs (1 kg)', bulkDiscountMult: 0.93 },
  ],
  sugar_brown: [
    { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)' },
    { sizeBase: 500, labelSingular: 'pack (500 g)', labelPlural: 'packs (500 g)', bulkDiscountMult: 0.96 },
    { sizeBase: 1000, labelSingular: 'pack (1 kg)', labelPlural: 'packs (1 kg)', bulkDiscountMult: 0.93 },
  ],
  bagoong_alamang: [
    { sizeBase: 100, labelSingular: 'jar (100 g)', labelPlural: 'jars (100 g)' },
    { sizeBase: 250, labelSingular: 'jar (250 g)', labelPlural: 'jars (250 g)', bulkDiscountMult: 0.94 },
  ],
  bagoong_isda: [
    { sizeBase: 150, labelSingular: 'bottle (150 g)', labelPlural: 'bottles (150 g)' },
    { sizeBase: 300, labelSingular: 'bottle (300 g)', labelPlural: 'bottles (300 g)', bulkDiscountMult: 0.94 },
  ],
  miso_paste: [
    { sizeBase: 100, labelSingular: 'pack (100 g)', labelPlural: 'packs (100 g)' },
    { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)', bulkDiscountMult: 0.94 },
  ],
  tablea: [
    { sizeBase: 100, labelSingular: 'pack (100 g)', labelPlural: 'packs (100 g)' },
    { sizeBase: 200, labelSingular: 'pack (200 g)', labelPlural: 'packs (200 g)', bulkDiscountMult: 0.94 },
  ],

  // Canned goods (De Lata)
  sardines_tomato: [{ sizeBase: 155, labelSingular: 'can (155 g)', labelPlural: 'cans (155 g)' }],
  tuna_canned: [{ sizeBase: 155, labelSingular: 'can (155 g)', labelPlural: 'cans (155 g)' }],
  corned_beef: [
    { sizeBase: 150, labelSingular: 'can (150 g)', labelPlural: 'cans (150 g)' },
    { sizeBase: 260, labelSingular: 'can (260 g)', labelPlural: 'cans (260 g)', bulkDiscountMult: 0.95 },
  ],
  luncheon_meat: [
    { sizeBase: 165, labelSingular: 'can (165 g)', labelPlural: 'cans (165 g)' },
    { sizeBase: 340, labelSingular: 'can (340 g)', labelPlural: 'cans (340 g)', bulkDiscountMult: 0.94 },
  ],
  liver_spread: [
    { sizeBase: 85, labelSingular: 'can (85 g)', labelPlural: 'cans (85 g)' },
    { sizeBase: 230, labelSingular: 'can (230 g)', labelPlural: 'cans (230 g)', bulkDiscountMult: 0.93 },
  ],

  // Iba pa (peanut butter, tokwa)
  peanut_butter: [
    { sizeBase: 170, labelSingular: 'jar (170 g)', labelPlural: 'jars (170 g)' },
    { sizeBase: 340, labelSingular: 'jar (340 g)', labelPlural: 'jars (340 g)', bulkDiscountMult: 0.94 },
  ],
  tokwa: [
    { sizeBase: 200, labelSingular: 'block (200 g)', labelPlural: 'blocks (200 g)' },
    { sizeBase: 800, labelSingular: 'bundle (4 blocks / 800 g)', labelPlural: 'bundles (4 blocks)', bulkDiscountMult: 0.93 },
  ],

  // Dairy & Eggs (Itlog at Gatas)
  evap_milk: [
    { sizeBase: 140, labelSingular: 'can (140 ml)', labelPlural: 'cans (140 ml)' },
    { sizeBase: 370, labelSingular: 'can (370 ml)', labelPlural: 'cans (370 ml)', bulkDiscountMult: 0.94 },
  ],
  condensed_milk: [
    { sizeBase: 168, labelSingular: 'can (168 ml)', labelPlural: 'cans (168 ml)' },
    { sizeBase: 300, labelSingular: 'can (300 ml)', labelPlural: 'cans (300 ml)', bulkDiscountMult: 0.94 },
  ],
  cheese: [
    { sizeBase: 165, labelSingular: 'bar (165 g)', labelPlural: 'bars (165 g)' },
    { sizeBase: 430, labelSingular: 'bar (430 g)', labelPlural: 'bars (430 g)', bulkDiscountMult: 0.93 },
  ],
  margarine: [
    { sizeBase: 100, labelSingular: 'tub (100 g)', labelPlural: 'tubs (100 g)' },
    { sizeBase: 250, labelSingular: 'tub (250 g)', labelPlural: 'tubs (250 g)', bulkDiscountMult: 0.94 },
  ],

  // Rice, Grains & Noodles (Bigas at Butil)
  rice_raw: [
    { sizeBase: 1000, labelSingular: 'pack (1 kg)', labelPlural: 'packs (1 kg)' },
    { sizeBase: 2000, labelSingular: 'pack (2 kg)', labelPlural: 'packs (2 kg)', bulkDiscountMult: 0.97 },
    { sizeBase: 5000, labelSingular: 'sack (5 kg)', labelPlural: 'sacks (5 kg)', bulkDiscountMult: 0.93 },
  ],
  malagkit: [
    { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)' },
    { sizeBase: 500, labelSingular: 'pack (500 g)', labelPlural: 'packs (500 g)', bulkDiscountMult: 0.96 },
    { sizeBase: 1000, labelSingular: 'pack (1 kg)', labelPlural: 'packs (1 kg)', bulkDiscountMult: 0.93 },
  ],
  monggo: [
    { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)' },
    { sizeBase: 500, labelSingular: 'pack (500 g)', labelPlural: 'packs (500 g)', bulkDiscountMult: 0.95 },
    { sizeBase: 1000, labelSingular: 'pack (1 kg)', labelPlural: 'packs (1 kg)', bulkDiscountMult: 0.92 },
  ],
  kadyos: [
    { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)' },
    { sizeBase: 500, labelSingular: 'pack (500 g)', labelPlural: 'packs (500 g)', bulkDiscountMult: 0.95 },
  ],
  bihon: [
    { sizeBase: 227, labelSingular: 'pack (227 g)', labelPlural: 'packs (227 g)' },
    { sizeBase: 454, labelSingular: 'pack (454 g)', labelPlural: 'packs (454 g)', bulkDiscountMult: 0.95 },
  ],
  pancit_canton: [
    { sizeBase: 227, labelSingular: 'pack (227 g)', labelPlural: 'packs (227 g)' },
    { sizeBase: 454, labelSingular: 'pack (454 g)', labelPlural: 'packs (454 g)', bulkDiscountMult: 0.95 },
  ],
  sotanghon: [
    { sizeBase: 100, labelSingular: 'pack (100 g)', labelPlural: 'packs (100 g)' },
    { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)', bulkDiscountMult: 0.94 },
  ],
  misua: [{ sizeBase: 150, labelSingular: 'pack (150 g)', labelPlural: 'packs (150 g)' }],
  miki: [
    { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)' },
    { sizeBase: 500, labelSingular: 'pack (500 g)', labelPlural: 'packs (500 g)', bulkDiscountMult: 0.95 },
  ],
  macaroni: [
    { sizeBase: 200, labelSingular: 'pack (200 g)', labelPlural: 'packs (200 g)' },
    { sizeBase: 400, labelSingular: 'pack (400 g)', labelPlural: 'packs (400 g)', bulkDiscountMult: 0.95 },
  ],
  spaghetti: [
    { sizeBase: 400, labelSingular: 'pack (400 g)', labelPlural: 'packs (400 g)' },
    { sizeBase: 900, labelSingular: 'pack (900 g)', labelPlural: 'packs (900 g)', bulkDiscountMult: 0.93 },
  ],
  flour: [
    { sizeBase: 500, labelSingular: 'pack (500 g)', labelPlural: 'packs (500 g)' },
    { sizeBase: 1000, labelSingular: 'pack (1 kg)', labelPlural: 'packs (1 kg)', bulkDiscountMult: 0.95 },
  ],
  lumpia_wrapper: [{ sizeBase: 15, labelSingular: 'pack (15 pcs)', labelPlural: 'packs (15 pcs)' }],
  pandesal: [{ sizeBase: 6, labelSingular: 'pack (6 pcs)', labelPlural: 'packs (6 pcs)' }],

  // Processed meats & dried fish
  hotdog: [
    { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)' },
    { sizeBase: 500, labelSingular: 'pack (500 g)', labelPlural: 'packs (500 g)', bulkDiscountMult: 0.95 },
  ],
  tocino: [
    { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)' },
    { sizeBase: 500, labelSingular: 'pack (500 g)', labelPlural: 'packs (500 g)', bulkDiscountMult: 0.95 },
  ],
  longganisa: [
    { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)' },
    { sizeBase: 500, labelSingular: 'pack (500 g)', labelPlural: 'packs (500 g)', bulkDiscountMult: 0.95 },
  ],
  chicharon: [{ sizeBase: 100, labelSingular: 'pack (100 g)', labelPlural: 'packs (100 g)' }],
  tuyo: [{ sizeBase: 100, labelSingular: 'pack (100 g)', labelPlural: 'packs (100 g)' }],
  dilis: [{ sizeBase: 100, labelSingular: 'pack (100 g)', labelPlural: 'packs (100 g)' }],
  tinapa: [{ sizeBase: 200, labelSingular: 'pack (200 g)', labelPlural: 'packs (200 g)' }],
};

const SMALL_AROMATIC_VEG_IDS = new Set([
  'garlic',
  'ginger',
  'green_chili',
  'siling_labuyo',
  'spring_onion',
  'lemongrass',
  'turmeric',
  'malunggay',
  'calamansi',
  'sampalok',
]);

function getRetailOptionsForIngredient(
  ingredient: Ingredient,
  storeId: StoreId
): RetailPackageOption[] {
  const isWetMarket = storeId === 'palengke' || storeId === 'sari_sari';

  if (ingredient.ingredient_id === 'egg') {
    if (isWetMarket) {
      return [
        { sizeBase: 1, labelSingular: 'pc', labelPlural: 'pcs' },
        { sizeBase: 12, labelSingular: 'dozen (12 pcs)', labelPlural: 'dozens (12 pcs)', bulkDiscountMult: 0.92 },
        { sizeBase: 15, labelSingular: 'half tray (15 pcs)', labelPlural: 'half trays (15 pcs)', bulkDiscountMult: 0.9 },
        { sizeBase: 30, labelSingular: 'tray (30 pcs)', labelPlural: 'trays (30 pcs)', bulkDiscountMult: 0.88 },
      ];
    }
    return [
      { sizeBase: 6, labelSingular: 'pack (6 pcs)', labelPlural: 'packs (6 pcs)' },
      { sizeBase: 12, labelSingular: 'dozen (12 pcs)', labelPlural: 'dozens (12 pcs)', bulkDiscountMult: 0.94 },
      { sizeBase: 15, labelSingular: 'half tray (15 pcs)', labelPlural: 'half trays (15 pcs)', bulkDiscountMult: 0.92 },
      { sizeBase: 30, labelSingular: 'tray (30 pcs)', labelPlural: 'trays (30 pcs)', bulkDiscountMult: 0.89 },
    ];
  }

  if (SPECIFIC_PACKAGE_TIERS[ingredient.ingredient_id]) {
    return SPECIFIC_PACKAGE_TIERS[ingredient.ingredient_id];
  }

  if (ingredient.base_unit === 'pc') {
    return [{ sizeBase: 1, labelSingular: 'pc', labelPlural: 'pcs' }];
  }

  if (ingredient.grocery_section === 'Karne' || ingredient.grocery_section === 'Isda at Seafood') {
    return [
      { sizeBase: 250, labelSingular: 'quarter kilo (250 g)', labelPlural: '× 250 g' },
      { sizeBase: 500, labelSingular: 'half kilo (500 g)', labelPlural: '× 500 g', bulkDiscountMult: 0.98 },
      { sizeBase: 1000, labelSingular: 'kilo (1 kg)', labelPlural: 'kg', bulkDiscountMult: 0.95 },
    ];
  }

  if (SMALL_AROMATIC_VEG_IDS.has(ingredient.ingredient_id)) {
    return isWetMarket
      ? [
          { sizeBase: 50, labelSingular: 'bundle (50 g)', labelPlural: 'bundles (50 g)' },
          { sizeBase: 100, labelSingular: 'bundle (100 g)', labelPlural: 'bundles (100 g)', bulkDiscountMult: 0.96 },
          { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)', bulkDiscountMult: 0.92 },
        ]
      : [
          { sizeBase: 100, labelSingular: 'pack (100 g)', labelPlural: 'packs (100 g)' },
          { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)', bulkDiscountMult: 0.94 },
        ];
  }

  if (ingredient.grocery_section === 'Gulay' || ingredient.grocery_section === 'Prutas') {
    return isWetMarket
      ? [
          { sizeBase: 250, labelSingular: 'quarter kilo (250 g)', labelPlural: '× 250 g' },
          { sizeBase: 500, labelSingular: 'half kilo (500 g)', labelPlural: '× 500 g', bulkDiscountMult: 0.96 },
          { sizeBase: 1000, labelSingular: 'kilo (1 kg)', labelPlural: 'kg', bulkDiscountMult: 0.92 },
        ]
      : [
          { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)' },
          { sizeBase: 500, labelSingular: 'pack (500 g)', labelPlural: 'packs (500 g)', bulkDiscountMult: 0.96 },
          { sizeBase: 1000, labelSingular: 'pack (1 kg)', labelPlural: 'packs (1 kg)', bulkDiscountMult: 0.92 },
        ];
  }

  // Generic fallback for any packaged g/ml item
  if (ingredient.base_unit === 'ml') {
    return [
      { sizeBase: 200, labelSingular: 'pack (200 ml)', labelPlural: 'packs (200 ml)' },
      { sizeBase: 500, labelSingular: 'bottle (500 ml)', labelPlural: 'bottles (500 ml)', bulkDiscountMult: 0.95 },
    ];
  }
  return [
    { sizeBase: 100, labelSingular: 'pack (100 g)', labelPlural: 'packs (100 g)' },
    { sizeBase: 250, labelSingular: 'pack (250 g)', labelPlural: 'packs (250 g)', bulkDiscountMult: 0.95 },
  ];
}

function formatPackagePurchaseLabel(count: number, opt: RetailPackageOption): string {
  // Clean weight labels for market weight units
  if (opt.labelSingular === 'quarter kilo (250 g)') {
    if (count === 2) return '1 half kilo (500 g)';
    if (count === 3) return '3/4 kg (750 g)';
    if (count >= 4) return `${(count * 250) / 1000} kg`;
  }
  if (opt.labelSingular === 'half kilo (500 g)' && count >= 2) {
    return `${(count * 500) / 1000} kg`;
  }
  if (opt.labelSingular === 'kilo (1 kg)') return `${count} kg`;
  return `${count} ${count === 1 ? opt.labelSingular : opt.labelPlural}`;
}

/**
 * Resolves the most practical, cost-efficient Philippine retail package option
 * that satisfies `netBaseQty`, returning exact consumption cost, retail checkout cost,
 * and expected remaining leftover inventory.
 */
export function resolveRetailPurchase(
  ingredient: Ingredient,
  netBaseQty: number,
  region: RegionRecord,
  storeId: StoreId
): ResolvedRetailPurchase {
  if (netBaseQty <= 0.001) {
    return {
      packageCount: 0,
      packageSizeBase: 0,
      purchasedBaseQty: 0,
      retailPackageLabel: 'Covered by pantry',
      packageCostPhp: 0,
      consumptionCostPhp: 0,
      leftoverBaseQty: 0,
      leftoverDisplayLabel: 'None',
      leftoverValuePhp: 0,
      isProvisionalPackagePrice: true,
    };
  }

  const options = getRetailOptionsForIngredient(ingredient, storeId);
  const adjustedUnitPrice = getAdjustedIngredientBasisPrice(ingredient, region, storeId);
  const priceDivisor = ingredient.price_basis === 'per_piece' ? 1 : 1000;

  let best: {
    option: RetailPackageOption;
    count: number;
    purchasedQty: number;
    cost: number;
    score: number;
  } | null = null;

  for (const opt of options) {
    const count = Math.max(1, Math.ceil(netBaseQty / opt.sizeBase));
    const purchasedQty = count * opt.sizeBase;
    const rawCost = (purchasedQty / priceDivisor) * adjustedUnitPrice * (opt.bulkDiscountMult ?? 1);
    const cost = round2(rawCost);
    const leftoverRatio = (purchasedQty - netBaseQty) / Math.max(1, purchasedQty);

    // Prefer lowest checkout cost; avoid excessive waste when cost is virtually tied
    const score = cost + leftoverRatio * 2.5;
    if (!best || score < best.score - 0.01) {
      best = { option: opt, count, purchasedQty, cost, score };
    }
  }

  // Also check smart mixed market increments for meats/fish/veg (e.g. 750g = 3x250g vs 1kg)
  const chosen = best!;
  const leftoverBaseQty = Math.max(0, round2(chosen.purchasedQty - netBaseQty));

  // Reconcile leftover value and consumed value cleanly so that for every item:
  // consumptionCostPhp + leftoverValuePhp === packageCostPhp (exact centavo reconciliation).
  const proportionalLeftover =
    chosen.purchasedQty > 0
      ? round2(chosen.cost * (leftoverBaseQty / chosen.purchasedQty))
      : 0;
  const leftoverValuePhp = leftoverBaseQty > 0.01 ? proportionalLeftover : 0;
  const reconciledConsumptionPhp = round2(Math.max(0, chosen.cost - leftoverValuePhp));

  return {
    packageCount: chosen.count,
    packageSizeBase: chosen.option.sizeBase,
    purchasedBaseQty: chosen.purchasedQty,
    retailPackageLabel: formatPackagePurchaseLabel(chosen.count, chosen.option),
    packageCostPhp: chosen.cost,
    consumptionCostPhp: reconciledConsumptionPhp,
    leftoverBaseQty,
    leftoverDisplayLabel: formatBaseQuantityLabel(leftoverBaseQty, ingredient.base_unit),
    leftoverValuePhp,
    isProvisionalPackagePrice: true,
  };
}

const CHICKEN_CONSOLIDATABLE_IDS = new Set([
  'chicken_cutup',
  'chicken_thigh',
  'chicken_breast',
  'chicken_wings',
]);

const PORK_CONSOLIDATABLE_IDS = new Set([
  'pork_shoulder',
  'pork_belly',
  'pork_ribs',
]);

const STAPLE_VEG_BULK_IDS = new Set([
  'onion',
  'garlic',
  'tomato',
  'potato',
  'carrot',
  'repolyo',
]);

export interface DishIngredientUsage {
  dishId: string;
  dishName: string;
  requiredBaseQty: number;
}

/**
 * Optimizes weekly grocery purchases across recipes:
 * 1. Whole Chicken consolidation (edible meat yield ~72% + bones for broth, portion allocation, savings)
 * 2. Bulk Pork consolidation (1kg / 1.5kg / 2kg cuts split across recipes)
 * 3. Bulk Egg dozen / 30-pc tray optimization
 * 4. Bulk Rice 2kg / 5kg sack tier
 * 5. Bulk Tokwa 4-block bundle
 * 6. Shared staple vegetable bundles (onion, garlic, tomato, potato, carrot, cabbage across 3+ recipes)
 *
 * Updates `items` in place so section subtotals and checkout totals strictly reconcile with bulk purchases.
 */
export function optimizeWeeklyBulkPurchases(
  items: GroceryItem[],
  usageByIngredient: Map<string, DishIngredientUsage[]>,
  region: RegionRecord,
  storeId: StoreId,
  dataset: UlamWiseDataset
): {
  items: GroceryItem[];
  bulkPlans: BulkPurchasePlan[];
  bulkSavingsPhp: number;
} {
  const bulkPlans: BulkPurchasePlan[] = [];
  let totalBulkSavings = 0;

  const nextItems = [...items];

  // 1. WHOLE CHICKEN CONSOLIDATION
  const chickenItems = nextItems.filter(
    (it) => !it.coveredByPantry && CHICKEN_CONSOLIDATABLE_IDS.has(it.ingredientId) && it.netBaseQty > 0
  );
  const chickenDishIds = new Set(chickenItems.flatMap((it) => it.usedInDishIds));
  const totalChickenNetG = chickenItems.reduce((s, it) => s + it.netBaseQty, 0);

  if (chickenDishIds.size >= 2 && totalChickenNetG >= 900) {
    // Dressed whole chicken: ~72% usable meat/cut-up yield for boneless breast; bone-in cuts use as-purchased weight
    const breastNetG =
      chickenItems.find((it) => it.ingredientId === 'chicken_breast')?.netBaseQty ?? 0;
    const boneInNetG = totalChickenNetG - breastNetG;
    // Required whole dressed chicken weight: breast needs ~1/0.72 dressed equiv, bone-in ~1.0x
    const requiredDressedG = boneInNetG + breastNetG / 0.72;
    const candidateBirdSizesG = [1200, 1500, 1800];
    let bestWholeCombo = { birdCount: 1, wholeBirdSizeG: 1500, totalPurchasedDressedG: 1500 };
    let minTotalDressedG = Number.POSITIVE_INFINITY;
    for (const sizeG of candidateBirdSizesG) {
      const count = Math.max(1, Math.ceil(requiredDressedG / sizeG));
      const totalG = count * sizeG;
      if (totalG < minTotalDressedG || (totalG === minTotalDressedG && count < bestWholeCombo.birdCount)) {
        minTotalDressedG = totalG;
        bestWholeCombo = { birdCount: count, wholeBirdSizeG: sizeG, totalPurchasedDressedG: totalG };
      }
    }
    const { birdCount, wholeBirdSizeG, totalPurchasedDressedG } = bestWholeCombo;
    const edibleYieldG = Math.round(totalPurchasedDressedG * 0.72);
    const bonesCarcassG = totalPurchasedDressedG - edibleYieldG;

    const baseCutupIng = dataset.ingredientsById.get('chicken_cutup');
    const perKgAdjusted = baseCutupIng
      ? getAdjustedIngredientBasisPrice(baseCutupIng, region, storeId)
      : 190 * region.price_mult_meat;
    // Whole dressed chicken typically saves ~8% per kg vs separate choice/cut-up retail cuts
    const wholeChickenPerKg = round2(perKgAdjusted * 0.92);
    const estimatedBulkCostPhp = round2((totalPurchasedDressedG / 1000) * wholeChickenPerKg);
    const separateCutsCostPhp = round2(
      chickenItems.reduce((s, it) => s + it.packageCostPhp, 0)
    );
    const savingsPhp = round2(Math.max(0, separateCutsCostPhp - estimatedBulkCostPhp));

    // Only apply consolidation when it genuinely saves money or stays within ₱10 while providing bonus broth carcass
    if (estimatedBulkCostPhp <= separateCutsCostPhp + 10) {
      const allocations: BulkPortionAllocation[] = [];
      for (const ci of chickenItems) {
        const usages = usageByIngredient.get(ci.ingredientId) ?? [];
        for (const u of usages) {
          const existing = allocations.find((a) => a.dishId === u.dishId);
          if (existing) {
            existing.requiredBaseQty = round2(existing.requiredBaseQty + u.requiredBaseQty);
            existing.displayQty = formatBaseQuantityLabel(existing.requiredBaseQty, 'g');
          } else {
            allocations.push({
              dishId: u.dishId,
              dishName: u.dishName,
              requiredBaseQty: round2(u.requiredBaseQty),
              displayQty: formatBaseQuantityLabel(u.requiredBaseQty, 'g'),
            });
          }
        }
      }

      const leftoverMeatG = Math.max(0, Math.round(totalPurchasedDressedG - requiredDressedG));
      const leftoverValuePhp =
        leftoverMeatG > 0
          ? round2(estimatedBulkCostPhp * (leftoverMeatG / totalPurchasedDressedG))
          : 0;
      const planId = 'bulk-whole-chicken';

      const pkgLabel =
        birdCount === 1
          ? `1 whole chicken (${wholeBirdSizeG / 1000} kg, provisional est. ₱${wholeChickenPerKg}/kg)`
          : `${birdCount} whole chickens (${totalPurchasedDressedG / 1000} kg total, provisional est. ₱${wholeChickenPerKg}/kg)`;

      bulkPlans.push({
        id: planId,
        title: 'Whole Chicken Bulk Consolidation',
        category: 'whole_chicken',
        retailPackageLabel: pkgLabel,
        purchaseQtyLabel: `${totalPurchasedDressedG / 1000} kg whole dressed chicken`,
        estimatedBulkCostPhp,
        separateCutsCostPhp,
        estimatedSavingsPhp: savingsPhp,
        edibleYieldLabel: `~${formatBaseQuantityLabel(edibleYieldG, 'g')} edible meat (72% yield)`,
        bonesOrByproductNote: `~${formatBaseQuantityLabel(bonesCarcassG, 'g')} bones & carcass — ideal for tinola, arroz caldo, or sopas broth`,
        leftoverLabel:
          leftoverMeatG > 25
            ? `${formatBaseQuantityLabel(leftoverMeatG, 'g')} extra chicken meat + broth bones`
            : 'Broth bones/carcass only',
        leftoverValuePhp,
        storageNote:
          'Have the vendor cut into recipe portions at the palengke; keep Day 1–2 portions chilled and freeze Day 3+ portions in labeled bags.',
        allocations,
        coveredIngredientIds: chickenItems.map((it) => it.ingredientId),
        isProvisional: true,
      });

      totalBulkSavings = round2(totalBulkSavings + savingsPhp);

      // Replace the individual chicken cut items with ONE consolidated Whole Chicken grocery item
      // so section subtotals and checkout totals strictly reconcile!
      const coveredIds = new Set(chickenItems.map((it) => it.ingredientId));
      const filtered = nextItems.filter((it) => !coveredIds.has(it.ingredientId));
      const allDishIds = Array.from(chickenDishIds);
      const totalReqBase = round2(chickenItems.reduce((s, it) => s + it.requiredBaseQty, 0));
      const totalPantryDed = round2(chickenItems.reduce((s, it) => s + it.pantryDeductedBaseQty, 0));

      filtered.push({
        ingredientId: 'chicken_cutup',
        nameEn: 'Whole chicken (dressed & portioned for week)',
        nameFil: 'Buong Manok (pinahati sa mga ulam)',
        section: 'Karne',
        priceGroup: 'meat',
        requiredBaseQty: totalReqBase,
        pantryDeductedBaseQty: totalPantryDed,
        netBaseQty: round2(totalChickenNetG),
        baseUnit: 'g',
        displayQty: Math.round((totalChickenNetG / 1000) * 100) / 100,
        displayUnit: 'kg',
        unitPricePhp: wholeChickenPerKg,
        priceBasisLabel: `₱${wholeChickenPerKg.toFixed(0)}/kg (whole bird est.)`,
        estimatedCostPhp: estimatedBulkCostPhp,
        consumptionCostPhp: round2(Math.max(0, estimatedBulkCostPhp - leftoverValuePhp)),
        retailPackageCount: birdCount,
        retailPackageSizeBase: wholeBirdSizeG,
        retailPackageLabel:
          birdCount === 1
            ? `1 whole chicken (${wholeBirdSizeG / 1000} kg)`
            : `${birdCount} whole chickens (${totalPurchasedDressedG / 1000} kg)`,
        purchasedBaseQty: totalPurchasedDressedG,
        packageCostPhp: estimatedBulkCostPhp,
        leftoverBaseQty: leftoverMeatG,
        leftoverDisplayLabel:
          leftoverMeatG > 25
            ? `${formatBaseQuantityLabel(leftoverMeatG, 'g')} + broth bones`
            : 'Broth bones',
        leftoverValuePhp,
        isProvisionalPackagePrice: true,
        bulkPlanId: planId,
        bulkNote:
          savingsPhp > 0
            ? `Saves ~₱${savingsPhp.toFixed(2)} vs separate cuts; yields ~${formatBaseQuantityLabel(bonesCarcassG, 'g')} broth bones`
            : `Yields ~${formatBaseQuantityLabel(bonesCarcassG, 'g')} bones for homemade broth`,
        coveredByPantry: false,
        usedInDishIds: allDishIds,
      });

      nextItems.length = 0;
      nextItems.push(...filtered);
    }
  }

  // 2. BULK PORK CUT CONSOLIDATION (when 2+ pork recipes sum to >= 1 kg)
  const porkItems = nextItems.filter(
    (it) => !it.coveredByPantry && PORK_CONSOLIDATABLE_IDS.has(it.ingredientId) && it.netBaseQty > 0
  );
  const porkDishIds = new Set(porkItems.flatMap((it) => it.usedInDishIds));
  const totalPorkNetG = porkItems.reduce((s, it) => s + it.netBaseQty, 0);
  if (porkDishIds.size >= 2 && totalPorkNetG >= 950) {
    const separateCost = round2(porkItems.reduce((s, it) => s + it.packageCostPhp, 0));
    const bulkTotalCost = round2(separateCost * 0.95);
    const savingsPhp = round2(Math.max(0, separateCost - bulkTotalCost));
    if (savingsPhp >= 8) {
      const planId = 'bulk-pork-pack';
      const allocations: BulkPortionAllocation[] = [];
      for (const pi of porkItems) {
        for (const u of usageByIngredient.get(pi.ingredientId) ?? []) {
          allocations.push({
            dishId: u.dishId,
            dishName: u.dishName,
            requiredBaseQty: round2(u.requiredBaseQty),
            displayQty: formatBaseQuantityLabel(u.requiredBaseQty, 'g'),
          });
        }
      }
      // Distribute the 5% bulk discount across the pork items so subtotals reconcile exactly
      let remainingDiscount = savingsPhp;
      porkItems.forEach((pi, idx) => {
        const share =
          idx === porkItems.length - 1
            ? remainingDiscount
            : round2(savingsPhp * (pi.packageCostPhp / separateCost));
        remainingDiscount = round2(remainingDiscount - share);
        pi.packageCostPhp = round2(Math.max(0, pi.packageCostPhp - share));
        pi.estimatedCostPhp = pi.packageCostPhp;
        const propLeft =
          pi.purchasedBaseQty > 0 && pi.leftoverBaseQty > 0.01
            ? round2(pi.packageCostPhp * (pi.leftoverBaseQty / pi.purchasedBaseQty))
            : 0;
        pi.leftoverValuePhp = propLeft;
        pi.consumptionCostPhp = round2(Math.max(0, pi.packageCostPhp - propLeft));
        pi.bulkPlanId = planId;
        pi.bulkNote = `Part of bulk pork purchase (saves ~₱${savingsPhp.toFixed(2)} across ${porkDishIds.size} dishes)`;
      });

      const totalPurchasedG = porkItems.reduce((s, it) => s + it.purchasedBaseQty, 0);
      const totalLeftoverG = porkItems.reduce((s, it) => s + it.leftoverBaseQty, 0);
      const totalLeftoverVal = round2(porkItems.reduce((s, it) => s + it.leftoverValuePhp, 0));

      bulkPlans.push({
        id: planId,
        title: 'Bulk Pork Palengke Bundle',
        category: 'bulk_pork',
        retailPackageLabel: `${formatBaseQuantityLabel(totalPurchasedG, 'g')} assorted pork cuts (bulk weight pricing)`,
        purchaseQtyLabel: formatBaseQuantityLabel(totalPurchasedG, 'g'),
        estimatedBulkCostPhp: bulkTotalCost,
        separateCutsCostPhp: separateCost,
        estimatedSavingsPhp: savingsPhp,
        leftoverLabel: formatBaseQuantityLabel(totalLeftoverG, 'g'),
        leftoverValuePhp: totalLeftoverVal,
        storageNote: 'Portion by recipe right after shopping and freeze cuts scheduled 3+ days out.',
        allocations,
        coveredIngredientIds: porkItems.map((it) => it.ingredientId),
        isProvisional: true,
      });
      totalBulkSavings = round2(totalBulkSavings + savingsPhp);
    }
  }

  // 3. BULK EGGS (1 dozen / 30-pc tray)
  const eggItem = nextItems.find(
    (it) => !it.coveredByPantry && it.ingredientId === 'egg' && it.netBaseQty >= 10
  );
  if (eggItem) {
    const singlePcPrice = eggItem.unitPricePhp;
    const perPieceCost = round2(eggItem.purchasedBaseQty * singlePcPrice);
    const savingsPhp = round2(Math.max(0, perPieceCost - eggItem.packageCostPhp));
    if (savingsPhp >= 3) {
      const planId = 'bulk-eggs';
      eggItem.bulkPlanId = planId;
      eggItem.bulkNote = `Bulk ${eggItem.retailPackageLabel} saves ~₱${savingsPhp.toFixed(2)} vs single pieces`;
      bulkPlans.push({
        id: planId,
        title: eggItem.purchasedBaseQty >= 30 ? 'Egg Tray (30 pcs) Bulk Buy' : 'Dozen Eggs Bulk Buy',
        category: 'eggs',
        retailPackageLabel: eggItem.retailPackageLabel,
        purchaseQtyLabel: `${eggItem.purchasedBaseQty} pcs`,
        estimatedBulkCostPhp: eggItem.packageCostPhp,
        separateCutsCostPhp: perPieceCost,
        estimatedSavingsPhp: savingsPhp,
        leftoverLabel: eggItem.leftoverDisplayLabel,
        leftoverValuePhp: eggItem.leftoverValuePhp,
        storageNote: 'Store unwashed eggs in a cool dry spot or refrigerator door; lasts 2–3 weeks.',
        allocations: (usageByIngredient.get('egg') ?? []).map((u) => ({
          dishId: u.dishId,
          dishName: u.dishName,
          requiredBaseQty: round2(u.requiredBaseQty),
          displayQty: formatBaseQuantityLabel(u.requiredBaseQty, 'pc'),
        })),
        coveredIngredientIds: ['egg'],
        isProvisional: true,
      });
      totalBulkSavings = round2(totalBulkSavings + savingsPhp);
    }
  }

  // 4. BULK RICE (2 kg / 5 kg sack)
  const riceItem = nextItems.find(
    (it) => !it.coveredByPantry && it.ingredientId === 'rice_raw' && it.purchasedBaseQty >= 2000
  );
  if (riceItem) {
    const fullPrice = round2((riceItem.purchasedBaseQty / 1000) * riceItem.unitPricePhp);
    const savingsPhp = round2(Math.max(0, fullPrice - riceItem.packageCostPhp));
    if (savingsPhp >= 3) {
      const planId = 'bulk-rice';
      riceItem.bulkPlanId = planId;
      riceItem.bulkNote = `${riceItem.retailPackageLabel} saves ~₱${savingsPhp.toFixed(2)} vs per-kilo`;
      bulkPlans.push({
        id: planId,
        title: 'Bulk Bigas (Rice) Pack',
        category: 'rice',
        retailPackageLabel: riceItem.retailPackageLabel,
        purchaseQtyLabel: formatBaseQuantityLabel(riceItem.purchasedBaseQty, 'g'),
        estimatedBulkCostPhp: riceItem.packageCostPhp,
        separateCutsCostPhp: fullPrice,
        estimatedSavingsPhp: savingsPhp,
        leftoverLabel: riceItem.leftoverDisplayLabel,
        leftoverValuePhp: riceItem.leftoverValuePhp,
        storageNote: 'Keep bigas in a sealed rice dispenser or bin away from moisture for next week.',
        allocations: [
          {
            dishId: 'rice_pairings',
            dishName: `Daily steamed kanin across ${riceItem.usedInDishIds.length} rice-paired meals`,
            requiredBaseQty: riceItem.netBaseQty,
            displayQty: formatBaseQuantityLabel(riceItem.netBaseQty, 'g'),
          },
        ],
        coveredIngredientIds: ['rice_raw'],
        isProvisional: true,
      });
      totalBulkSavings = round2(totalBulkSavings + savingsPhp);
    }
  }

  // 5. BULK TOKWA BUNDLE
  const tokwaItem = nextItems.find(
    (it) => !it.coveredByPantry && it.ingredientId === 'tokwa' && it.purchasedBaseQty >= 800
  );
  if (tokwaItem) {
    const fullPrice = round2((tokwaItem.purchasedBaseQty / 1000) * tokwaItem.unitPricePhp);
    const savingsPhp = round2(Math.max(0, fullPrice - tokwaItem.packageCostPhp));
    if (savingsPhp >= 2) {
      const planId = 'bulk-tokwa';
      tokwaItem.bulkPlanId = planId;
      tokwaItem.bulkNote = `4-block tokwa bundle saves ~₱${savingsPhp.toFixed(2)}`;
      bulkPlans.push({
        id: planId,
        title: 'Tokwa Multi-Block Bundle',
        category: 'tokwa',
        retailPackageLabel: tokwaItem.retailPackageLabel,
        purchaseQtyLabel: formatBaseQuantityLabel(tokwaItem.purchasedBaseQty, 'g'),
        estimatedBulkCostPhp: tokwaItem.packageCostPhp,
        separateCutsCostPhp: fullPrice,
        estimatedSavingsPhp: savingsPhp,
        leftoverLabel: tokwaItem.leftoverDisplayLabel,
        leftoverValuePhp: tokwaItem.leftoverValuePhp,
        storageNote: 'Submerge unused tokwa blocks in clean cold water in a covered container in the fridge (change water every 2 days).',
        allocations: (usageByIngredient.get('tokwa') ?? []).map((u) => ({
          dishId: u.dishId,
          dishName: u.dishName,
          requiredBaseQty: round2(u.requiredBaseQty),
          displayQty: formatBaseQuantityLabel(u.requiredBaseQty, 'g'),
        })),
        coveredIngredientIds: ['tokwa'],
        isProvisional: true,
      });
      totalBulkSavings = round2(totalBulkSavings + savingsPhp);
    }
  }

  // 6. SHARED STAPLE VEGETABLE BUNDLES (used across 3+ recipes and >= 400g net)
  const sharedVegCandidates = nextItems.filter(
    (it) =>
      !it.coveredByPantry &&
      STAPLE_VEG_BULK_IDS.has(it.ingredientId) &&
      it.usedInDishIds.length >= 3 &&
      it.purchasedBaseQty >= 500
  );
  if (sharedVegCandidates.length > 0) {
    for (const veg of sharedVegCandidates.slice(0, 2)) {
      const fullPrice = round2((veg.purchasedBaseQty / 1000) * veg.unitPricePhp);
      const savingsPhp = round2(Math.max(0, fullPrice - veg.packageCostPhp));
      if (savingsPhp >= 2) {
        const planId = `bulk-veg-${veg.ingredientId}`;
        veg.bulkPlanId = planId;
        veg.bulkNote = `Shared across ${veg.usedInDishIds.length} dishes · ${veg.retailPackageLabel} saves ~₱${savingsPhp.toFixed(2)}`;
        bulkPlans.push({
          id: planId,
          title: `Shared ${veg.nameEn} (${veg.nameFil}) Bundle`,
          category: 'staple_veg',
          retailPackageLabel: veg.retailPackageLabel,
          purchaseQtyLabel: formatBaseQuantityLabel(veg.purchasedBaseQty, 'g'),
          estimatedBulkCostPhp: veg.packageCostPhp,
          separateCutsCostPhp: fullPrice,
          estimatedSavingsPhp: savingsPhp,
          leftoverLabel: veg.leftoverDisplayLabel,
          leftoverValuePhp: veg.leftoverValuePhp,
          storageNote:
            veg.ingredientId === 'onion' || veg.ingredientId === 'garlic' || veg.ingredientId === 'potato'
              ? 'Keep in an airy dry basket away from direct sun; lasts 2–4 weeks.'
              : 'Wrap dry in paper towel or breathable bag in the crisper drawer.',
          allocations: (usageByIngredient.get(veg.ingredientId) ?? []).map((u) => ({
            dishId: u.dishId,
            dishName: u.dishName,
            requiredBaseQty: round2(u.requiredBaseQty),
            displayQty: formatBaseQuantityLabel(u.requiredBaseQty, 'g'),
          })),
          coveredIngredientIds: [veg.ingredientId],
          isProvisional: true,
        });
        totalBulkSavings = round2(totalBulkSavings + savingsPhp);
      }
    }
  }

  return {
    items: nextItems,
    bulkPlans,
    bulkSavingsPhp: round2(totalBulkSavings),
  };
}
