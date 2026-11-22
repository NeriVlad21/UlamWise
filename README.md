# UlamWise — Filipino Meal Planner & Smart Grocery Budgeting

**Tagline:** Plan smarter. Shop tipid.

UlamWise is a mobile-first Filipino meal planning and grocery budgeting Progressive Web App (PWA) built with React, TypeScript, Tailwind CSS, Express, and server-side Google Gemini integration.

---

## Core Capabilities

- **9-Step Persistent Onboarding:** PSGC Location, Language (English / Tagalog / Taglish), Household size & ages, Weekly Budget & Tipid/Balanced/Sagana presets, Preferred Store, Automatic Mifflin-St Jeor or Manual Calories, Allergies & Dietary preferences, Kitchen Equipment & Cook Time, and Pantry Setup — auto-saved to `localStorage`.
- **Full Philippine PSGC Geographic Coverage:** All **17 PSA PSGC regions**, **81 provinces + 4 NCR districts + 2 independent cities**, and **1,634 cities & municipalities** bundled offline-ready, plus an in-app JSON import tool in Settings for newer PSA PSGC releases.
- **Regional Filipino Food Customization:** Integrates `regions.csv` (18 regional records), `province_cuisine_map.csv` (82 provincial mappings), and `city_overrides.csv` (31 city-level culinary overrides) with Local Specialties vs. Everyday Pinoy modes and coastal/inland awareness.
- **Deterministic Allergen & Food Safety Validation:** Validates every meal against `dishes.csv`, `ingredients.csv`, `dish_ingredients.csv`, and all **153 Filipino hidden-allergen aliases** in `hidden_allergens.csv` (`hipon`, `alimango`, `bagoong`, `patis`, `toyo`, `pusit`, etc.) before rendering.
- **Strict Weekly Variety Enforcement:** No duplicate dishes across 7 days, maximum 2 dishes with the same main protein in any 3 consecutive days, and maximum 1 fried-rice/silog variant per week.
- **Smart Grocery List & Budget Optimizer:** Aggregates ingredients scaled by age-weighted household portions, subtracts pantry inventory, groups into the 9 Filipino market sections (*Karne*, *Isda at Seafood*, *Gulay*, *Prutas*, *Bigas at Butil*, *Itlog at Gatas*, *Sangkap at Pampalasa*, *De Lata*, *Iba pa*), calculates exact section subtotals and budget progress, recommends allergy-safe budget swaps from `ingredient_swaps.csv`, and exports for clipboard, Messenger/Viber, or Print.
- **Phase 2 Features:** Individual meal lock/swap/regenerate, saved weekly plans, favorite dishes, adjustable recipe servings, and Gemini Vision Fridge & Pantry scanning with human-in-the-loop confirmation.

---

## Dataset Provenance & Validation

Original CSV datasets are preserved under `data/csv/` (and `public/assets/aistudio/`):

| Dataset | Rows | Validation |
| --- | ---: | --- |
| `dishes.csv` | 85 | 0 invalid rows |
| `ingredients.csv` | 115 | 0 invalid rows |
| `dish_ingredients.csv` | 701 | 0 broken FK references |
| `hidden_allergens.csv` | 153 | Active in deterministic allergen engine |
| `ingredient_swaps.csv` | 32 | Validated against allergies & diet before recommending |
| `regions.csv` | 18 | Regional price-group multipliers (`staples`, `veg`, `fish`, `meat`, `packaged`) |
| `province_cuisine_map.csv` | 82 | Provincial cuisine zones & coastal/inland profile |
| `city_overrides.csv` | 31 | Normalized city-level culinary boost rules |

### PSGC Data Source & Version

- **Source:** Philippine Statistics Authority (PSA) Philippine Standard Geographic Code (PSGC) structured JSON via `https://psgc.gitlab.io/api/` (`regions.json`, `provinces.json`, `districts.json`, `cities-municipalities.json`).
- **Coverage:** 17 regions, 81 provinces (+ 4 NCR districts + Independent Cities), and 1,634 cities & municipalities, compacted into `src/data/psgc_compact.json` (136 KB) for instant offline loading.
- **Updating:** Use **Settings → Import Updated PSGC File (JSON)** to load any newer PSA PSGC release (e.g., future NIR updates).

---

## Setup & Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (copy `.env.example` to `.env`):
   ```bash
   cp .env.example .env
   ```
   Set `GEMINI_API_KEY` on the server (never exposed to the client). If `GEMINI_API_KEY` is omitted or unavailable, UlamWise automatically uses its deterministic dataset meal planner so all core features continue working offline.
3. Run the development server (port 3000):
   ```bash
   npm run dev
   ```
4. Run unit tests (pricing, aggregation, pantry subtraction, allergen safety, weekly variety, PSGC, Mifflin-St Jeor):
   ```bash
   npm test
   ```
5. Build for production:
   ```bash
   npm run build
   npm start
   ```
