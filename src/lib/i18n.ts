import type { LanguageCode, MealSlot } from '../types';

export interface Translations {
  appTagline: string;
  nav: {
    home: string;
    mealPlan: string;
    grocery: string;
    pantry: string;
    settings: string;
    fridgeScan: string;
  };
  common: {
    next: string;
    back: string;
    save: string;
    cancel: string;
    reset: string;
    close: string;
    apply: string;
    loading: string;
    estimate: string;
    perServing: string;
    minutes: string;
    servings: string;
    generatePlan: string;
    regenerateWeek: string;
    optional: string;
  };
  onboarding: {
    title: string;
    subtitle: string;
    stepOf: string;
    resumeNotice: string;
    finishCta: string;
    steps: {
      location: { title: string; desc: string; region: string; province: string; city: string; selectRegion: string; selectProvince: string; selectCity: string };
      language: { title: string; desc: string };
      household: { title: string; desc: string; addMember: string; ageLabel: string; totalPortions: string };
      budget: { title: string; desc: string; weeklyLabel: string; dailyEq: string; perMember: string; presetsTitle: string };
      store: { title: string; desc: string; provisionalNotice: string };
      calories: { title: string; desc: string; autoMode: string; manualMode: string; sex: string; age: string; height: string; weight: string; activity: string; goal: string; manualLabel: string; estimatedBmr: string; estimatedTdee: string; dailyTarget: string };
      allergies: { title: string; desc: string; allergiesLabel: string; dietaryLabel: string; dislikesLabel: string; dislikesPlaceholder: string; deterministicNote: string };
      kitchen: { title: string; desc: string; equipmentLabel: string; maxTimeLabel: string };
      pantry: { title: string; desc: string; quickAdd: string; addCustom: string; sufficientLabel: string; summaryTitle: string };
    };
  };
  home: {
    greeting: string;
    weeklyBudget: string;
    estimatedSpend: string;
    remainingBudget: string;
    dailyEquivalent: string;
    todaysMeals: string;
    viewFullPlan: string;
    openGroceryList: string;
    fridgeScanCta: string;
    regionalNoteTitle: string;
    noPlanTitle: string;
    noPlanDesc: string;
  };
  mealPlan: {
    title: string;
    modeLocal: string;
    modeEveryday: string;
    includeMerienda: string;
    dailyNutrition: string;
    targetLabel: string;
    lockMeal: string;
    unlockMeal: string;
    swapMeal: string;
    regenerateMeal: string;
    viewRecipe: string;
    savePlan: string;
    savedPlans: string;
    favorites: string;
    allergenWarningTitle: string;
    ingredientsHeading: string;
    instructionsHeading: string;
    fallbackNoticeTitle: string;
    leftoverLabel: string;
  };
  grocery: {
    title: string;
    budgetProgress: string;
    underBudget: string;
    approachingBudget: string;
    overBudget: string;
    recommendedSwapsTitle: string;
    applyAllSwaps: string;
    revertSwaps: string;
    copyPlain: string;
    copyMessenger: string;
    printList: string;
    copied: string;
    pantryDeductedTitle: string;
    boughtProgress: string;
    emptyTitle: string;
    emptyDesc: string;
    provisionalBadge: string;
  };
  fridge: {
    title: string;
    subtitle: string;
    uploadLabel: string;
    scanning: string;
    confirmHeading: string;
    confirmHint: string;
    addDetectedItem: string;
    findDishes: string;
    availableLabel: string;
    missingLabel: string;
    extraCostLabel: string;
    addToPantry: string;
  };
  settings: {
    title: string;
    subtitle: string;
    appearance: string;
    lightMode: string;
    darkMode: string;
    profileSections: string;
    datasetStatus: string;
    psgcImportTitle: string;
    psgcImportDesc: string;
    resetTitle: string;
    resetDesc: string;
    resetConfirm: string;
    savedToast: string;
  };
  disclaimers: {
    footer: string;
    allergen: string;
  };
  slots: Record<MealSlot, string>;
}

const EN: Translations = {
  appTagline: 'Plan smarter. Shop tipid.',
  nav: {
    home: 'Home',
    mealPlan: 'Meal Plan',
    grocery: 'Grocery',
    pantry: 'Pantry',
    settings: 'Settings',
    fridgeScan: 'Fridge Scan',
  },
  common: {
    next: 'Continue',
    back: 'Back',
    save: 'Save',
    cancel: 'Cancel',
    reset: 'Reset',
    close: 'Close',
    apply: 'Apply',
    loading: 'Preparing your meal plan...',
    estimate: 'Estimate',
    perServing: 'per serving',
    minutes: 'min',
    servings: 'servings',
    generatePlan: 'Generate 7-Day Plan',
    regenerateWeek: 'Regenerate Week',
    optional: 'Optional',
  },
  onboarding: {
    title: 'Welcome to UlamWise',
    subtitle: 'Set up your Filipino household profile for regional meal plans and accurate palengke budgeting.',
    stepOf: 'Step {current} of {total}',
    resumeNotice: 'Your progress is saved automatically. You can refresh anytime.',
    finishCta: 'Generate My First 7-Day Plan',
    steps: {
      location: {
        title: 'Where do you shop and cook?',
        desc: 'We use the official Philippine Standard Geographic Code (PSGC) to match local dishes and regional market prices.',
        region: 'Region',
        province: 'Province / NCR District',
        city: 'City / Municipality',
        selectRegion: 'Select region',
        selectProvince: 'Select province',
        selectCity: 'Select city or municipality',
      },
      language: {
        title: 'Choose your preferred language',
        desc: 'Both English and local Filipino dish names are always displayed side by side.',
      },
      household: {
        title: 'Who are you cooking for?',
        desc: 'Household size and member ages help scale recipe portions and grocery quantities accurately.',
        addMember: 'Add Member',
        ageLabel: 'Age (years)',
        totalPortions: 'Estimated portion equivalents',
      },
      budget: {
        title: 'Set your weekly food budget',
        desc: 'Choose a spending style. Presets guide dish priorities without changing your entered peso budget.',
        weeklyLabel: 'Weekly Food Budget (PHP)',
        dailyEq: 'Daily equivalent',
        perMember: 'Per person / week',
        presetsTitle: 'Meal Priority Style',
      },
      store: {
        title: 'Where do you usually buy groceries?',
        desc: 'Palengke uses the NCR baseline dataset. Supermarket and sari-sari multipliers are provisional planning estimates.',
        provisionalNotice: 'Provisional estimate compared to the NCR palengke dataset baseline — not live surveyed shelf prices.',
      },
      calories: {
        title: 'Daily calorie preference',
        desc: 'Use our Mifflin-St Jeor estimate or enter your own daily calorie target.',
        autoMode: 'Automatic estimate',
        manualMode: 'Manual target',
        sex: 'Calculation formula',
        age: 'Age',
        height: 'Height (cm)',
        weight: 'Weight (kg)',
        activity: 'Activity level',
        goal: 'Goal',
        manualLabel: 'Daily calorie target (kcal)',
        estimatedBmr: 'Estimated BMR',
        estimatedTdee: 'Estimated TDEE',
        dailyTarget: 'Daily target (Estimate)',
      },
      allergies: {
        title: 'Allergies & dietary needs',
        desc: 'Allergies are enforced by deterministic ingredient and hidden-allergen checks before any dish is displayed.',
        allergiesLabel: 'Food Allergies',
        dietaryLabel: 'Dietary Preferences',
        dislikesLabel: 'Disliked ingredients (comma-separated)',
        dislikesPlaceholder: 'e.g., ampalaya, liver, okra',
        deterministicNote: 'Checked deterministically against 153 Filipino hidden-allergen aliases (including patis, bagoong, toyo, hipon).',
      },
      kitchen: {
        title: 'Kitchen equipment & cooking time',
        desc: 'Tell us what you cook with and how much time you have per meal.',
        equipmentLabel: 'Available Equipment',
        maxTimeLabel: 'Maximum cooking time per meal',
      },
      pantry: {
        title: 'What is already in your pantry?',
        desc: 'Pantry items are deducted from your weekly grocery list so you do not buy what you already have.',
        quickAdd: 'Quick-add Pinoy staples',
        addCustom: 'Add another ingredient',
        sufficientLabel: 'Already have enough for the week',
        summaryTitle: 'Profile Ready — Review Before Generating',
      },
    },
  },
  home: {
    greeting: 'Your kitchen this week',
    weeklyBudget: 'Weekly Budget',
    estimatedSpend: 'Estimated Grocery',
    remainingBudget: 'Remaining Budget',
    dailyEquivalent: 'Daily Budget',
    todaysMeals: "Today's Ulam Plan",
    viewFullPlan: 'View 7-Day Plan',
    openGroceryList: 'Open Grocery List',
    fridgeScanCta: 'Scan Fridge / Pantry',
    regionalNoteTitle: 'Regional Kitchen Note',
    noPlanTitle: 'No meal plan yet',
    noPlanDesc: 'Generate a personalized 7-day Filipino meal plan tailored to your location, allergies, and budget.',
  },
  mealPlan: {
    title: '7-Day Meal Plan',
    modeLocal: 'Local Specialties',
    modeEveryday: 'Everyday Pinoy',
    includeMerienda: 'Include Merienda',
    dailyNutrition: 'Daily Nutrition (Estimate)',
    targetLabel: 'Target',
    lockMeal: 'Lock meal',
    unlockMeal: 'Unlock meal',
    swapMeal: 'Swap',
    regenerateMeal: 'Regenerate',
    viewRecipe: 'Recipe',
    savePlan: 'Save Plan',
    savedPlans: 'Saved Plans',
    favorites: 'Favorites',
    allergenWarningTitle: 'Allergen Information',
    ingredientsHeading: 'Ingredients',
    instructionsHeading: 'Cooking Steps',
    fallbackNoticeTitle: 'Using Trusted Local Dataset Planner',
    leftoverLabel: 'Leftover tip',
  },
  grocery: {
    title: 'Smart Grocery List',
    budgetProgress: 'Budget Utilization',
    underBudget: 'Under budget',
    approachingBudget: 'Approaching budget limit',
    overBudget: 'Over weekly budget',
    recommendedSwapsTitle: 'Budget-Saving Substitutions',
    applyAllSwaps: 'Apply Recommended Swaps',
    revertSwaps: 'Reset Swaps',
    copyPlain: 'Copy List',
    copyMessenger: 'Copy for Messenger / Viber',
    printList: 'Print List',
    copied: 'Copied to clipboard',
    pantryDeductedTitle: 'Already Covered by Pantry',
    boughtProgress: 'Items bought',
    emptyTitle: 'Generate a meal plan first',
    emptyDesc: 'Once your 7-day meal plan is ready, your itemized palengke grocery list will appear here automatically.',
    provisionalBadge: 'Provisional store estimate',
  },
  fridge: {
    title: 'Fridge & Pantry Scan',
    subtitle: 'Upload a photo of your fridge or pantry to detect ingredients, confirm them, and see Filipino dishes you can cook.',
    uploadLabel: 'Take or upload a photo',
    scanning: 'Analyzing photo with Gemini Vision...',
    confirmHeading: 'Confirm Detected Ingredients',
    confirmHint: 'Review, edit, or remove uncertain detections before adding them to recommendations.',
    addDetectedItem: 'Add ingredient manually',
    findDishes: 'Recommend Filipino Dishes',
    availableLabel: 'Available',
    missingLabel: 'Missing',
    extraCostLabel: 'Est. extra cost',
    addToPantry: 'Add confirmed items to Pantry',
  },
  settings: {
    title: 'Household Settings',
    subtitle: 'Update your location, budget, allergies, kitchen, or pantry anytime without repeating onboarding.',
    appearance: 'Appearance',
    lightMode: 'Light',
    darkMode: 'Dark',
    profileSections: 'Profile & Preferences',
    datasetStatus: 'Dataset & PSGC Integrity',
    psgcImportTitle: 'Import Updated PSGC File (JSON)',
    psgcImportDesc: 'Bundled with all 17 PSA PSGC regions and 1,634 cities & municipalities. Import a newer PSGC JSON if needed.',
    resetTitle: 'Reset All Data',
    resetDesc: 'Clear your profile, saved plans, pantry, and grocery checklist to start fresh.',
    resetConfirm: 'Confirm Reset Everything',
    savedToast: 'Settings saved',
  },
  disclaimers: {
    footer:
      'UlamWise provides estimated food prices and nutritional information for planning purposes only. Actual prices vary by location, store, season, and availability. Nutritional values are estimates. This application is not medical advice and should not replace professional dietary guidance.',
    allergen:
      'Always check product packaging and ingredient labels. Ingredient substitutions and food preparation may introduce cross-contact risks.',
  },
  slots: {
    B: 'Almusal (Breakfast)',
    L: 'Tanghalian (Lunch)',
    D: 'Hapunan (Dinner)',
    M: 'Merienda (Snack)',
  },
};

const TL: Translations = {
  appTagline: 'Magplano nang matalino. Mamili nang tipid.',
  nav: {
    home: 'Tahanan',
    mealPlan: 'Plano ng Ulam',
    grocery: 'Listahan',
    pantry: 'Kusina',
    settings: 'Mga Setting',
    fridgeScan: 'Scan ng Ref',
  },
  common: {
    next: 'Magpatuloy',
    back: 'Bumalik',
    save: 'I-save',
    cancel: 'Kanselahin',
    reset: 'I-reset',
    close: 'Isara',
    apply: 'Ilapat',
    loading: 'Inihahanda ang iyong plano ng ulam...',
    estimate: 'Tantya',
    perServing: 'bawat hain',
    minutes: 'min',
    servings: 'hain',
    generatePlan: 'Gumawa ng 7-Araw na Plano',
    regenerateWeek: 'Baguhin ang Buong Linggo',
    optional: 'Opsyonal',
  },
  onboarding: {
    title: 'Maligayang pagdating sa UlamWise',
    subtitle: 'I-set up ang iyong tahanan para sa mga lokal na ulam at tamang badyet sa pamamalengke.',
    stepOf: 'Hakbang {current} ng {total}',
    resumeNotice: 'Awtomatikong nase-save ang iyong mga sagot kahit i-refresh ang pahina.',
    finishCta: 'Gumawa ng Unang 7-Araw na Plano',
    steps: {
      location: {
        title: 'Saan ka namamalengke at nagluluto?',
        desc: 'Ginagamit namin ang opisyal na PSGC ng Pilipinas para sa mga lokal na lutuin at presyo sa rehiyon.',
        region: 'Rehiyon',
        province: 'Lalawigan / Distrito ng NCR',
        city: 'Lungsod / Bayan',
        selectRegion: 'Pumili ng rehiyon',
        selectProvince: 'Pumili ng lalawigan',
        selectCity: 'Pumili ng lungsod o bayan',
      },
      language: {
        title: 'Piliin ang iyong wika',
        desc: 'Palaging ipinapakita ang pangalan ng ulam sa Ingles at lokal na Filipino.',
      },
      household: {
        title: 'Ilan ang kakain sa bahay?',
        desc: 'Nakakatulong ang bilang at edad ng bawat miyembro sa tamang dami ng lulutuin at bibilhin.',
        addMember: 'Magdagdag ng Miyembro',
        ageLabel: 'Edad (taon)',
        totalPortions: 'Tinatayang katumbas na hain',
      },
      budget: {
        title: 'Itakda ang lingguhang badyet sa pagkain',
        desc: 'Pumili ng estilo ng pagpili ng ulam. Hindi nito papalitan ang inilagay mong badyet.',
        weeklyLabel: 'Lingguhang Badyet (PHP)',
        dailyEq: 'Katumbas bawat araw',
        perMember: 'Bawat tao / linggo',
        presetsTitle: 'Estilo ng Badyet',
      },
      store: {
        title: 'Saan ka madalas mamili?',
        desc: 'Ang Palengke ang batayang presyo ng dataset. Pansamantalang taya ang ibang tindahan.',
        provisionalNotice: 'Pansamantalang taya kumpara sa batayang presyo ng NCR palengke — hindi aktwal na presyo sa tindahan.',
      },
      calories: {
        title: 'Target na kalori bawat araw',
        desc: 'Gamitin ang tantyang Mifflin-St Jeor o ilagay ang sarili mong target.',
        autoMode: 'Awtomatikong tantya',
        manualMode: 'Manwal na target',
        sex: 'Pormula ng pagkalkula',
        age: 'Edad',
        height: 'Taas (cm)',
        weight: 'Timbang (kg)',
        activity: 'Antas ng aktibidad',
        goal: 'Layunin',
        manualLabel: 'Target na kalori bawat araw (kcal)',
        estimatedBmr: 'Tinatayang BMR',
        estimatedTdee: 'Tinatayang TDEE',
        dailyTarget: 'Target bawat araw (Tantya)',
      },
      allergies: {
        title: 'Mga allergy at diyeta',
        desc: 'Mahigpit na sinusuri ng sistema ang mga sangkap at tagong allergen bago ipakita ang anumang ulam.',
        allergiesLabel: 'Mga Allergy sa Pagkain',
        dietaryLabel: 'Mga Kagustuhan sa Diyeta',
        dislikesLabel: 'Mga ayaw na sangkap (paghiwalayin ng kuwit)',
        dislikesPlaceholder: 'hal., ampalaya, atay, okra',
        deterministicNote: 'Sinusuri laban sa 153 na tagong allergen sa Filipino (kasama ang patis, bagoong, toyo, hipon).',
      },
      kitchen: {
        title: 'Gamit sa kusina at oras ng pagluluto',
        desc: 'Piliin ang gamit mong lutuan at pinakamatagal na oras ng pagluluto.',
        equipmentLabel: 'Mga Gamit sa Kusina',
        maxTimeLabel: 'Pinakamatagal na oras ng pagluluto',
      },
      pantry: {
        title: 'Ano na ang nasa kusina o pantry mo?',
        desc: 'Ibabawas ang mga nakalistang sangkap sa pantry mula sa iyong listahan ng bibilhin.',
        quickAdd: 'Mabilisang pagdagdag ng sangkap',
        addCustom: 'Magdagdag ng ibang sangkap',
        sufficientLabel: 'Sapat na para sa buong linggo',
        summaryTitle: 'Handa na ang Profile — Suriin Bago Magplano',
      },
    },
  },
  home: {
    greeting: 'Ang iyong kusina ngayong linggo',
    weeklyBudget: 'Lingguhang Badyet',
    estimatedSpend: 'Tinatayang Gastos',
    remainingBudget: 'Natitirang Badyet',
    dailyEquivalent: 'Badyet Bawat Araw',
    todaysMeals: 'Mga Ulam Ngayong Araw',
    viewFullPlan: 'Tingnan ang 7-Araw na Plano',
    openGroceryList: 'Buksan ang Listahan',
    fridgeScanCta: 'I-scan ang Ref / Pantry',
    regionalNoteTitle: 'Tala sa Lokal na Lutuin',
    noPlanTitle: 'Wala pang plano ng ulam',
    noPlanDesc: 'Gumawa ng 7-araw na plano ng mga lutuing Pinoy ayon sa iyong lokasyon, allergy, at badyet.',
  },
  mealPlan: {
    title: '7-Araw na Plano ng Ulam',
    modeLocal: 'Lokal na Espesyalidad',
    modeEveryday: 'Pang-araw-araw na Pinoy',
    includeMerienda: 'Isama ang Merienda',
    dailyNutrition: 'Nutrisyon Bawat Araw (Tantya)',
    targetLabel: 'Target',
    lockMeal: 'I-lock ang ulam',
    unlockMeal: 'I-unlock',
    swapMeal: 'Palitan',
    regenerateMeal: 'Bumuo ng iba',
    viewRecipe: 'Resipi',
    savePlan: 'I-save ang Plano',
    savedPlans: 'Mga Naka-save na Plano',
    favorites: 'Mga Paborito',
    allergenWarningTitle: 'Impormasyon sa Allergen',
    ingredientsHeading: 'Mga Sangkap',
    instructionsHeading: 'Paraan ng Pagluluto',
    fallbackNoticeTitle: 'Gamit ang Lokal na Dataset Planner',
    leftoverLabel: 'Tip sa tirang ulam',
  },
  grocery: {
    title: 'Listahan ng Pamamalengke',
    budgetProgress: 'Paggamit ng Badyet',
    underBudget: 'Pasok sa badyet',
    approachingBudget: 'Malapit na sa limitasyon ng badyet',
    overBudget: 'Lampas sa lingguhang badyet',
    recommendedSwapsTitle: 'Mas Tipid na Pamalit',
    applyAllSwaps: 'Gamitin ang mga Pamalit',
    revertSwaps: 'Ibalik sa Orihinal',
    copyPlain: 'Kopyahin ang Listahan',
    copyMessenger: 'Kopyahin para sa Messenger / Viber',
    printList: 'I-print ang Listahan',
    copied: 'Nakopya na sa clipboard',
    pantryDeductedTitle: 'Nasa Pantry Na',
    boughtProgress: 'Nabili na',
    emptyTitle: 'Gumawa muna ng plano ng ulam',
    emptyDesc: 'Kapag handa na ang iyong 7-araw na plano, awtomatikong lalabas dito ang listahan ng bibilhin.',
    provisionalBadge: 'Pansamantalang taya ng tindahan',
  },
  fridge: {
    title: 'Scan ng Ref at Pantry',
    subtitle: 'Mag-upload ng larawan ng iyong ref o pantry upang makilala ang sangkap at makakita ng mairerekomendang ulam.',
    uploadLabel: 'Kumuha o mag-upload ng larawan',
    scanning: 'Sinusuri ang larawan gamit ang Gemini Vision...',
    confirmHeading: 'Kumpirmahin ang mga Nakitang Sangkap',
    confirmHint: 'Suriin, baguhin, o alisin ang mga hindi tiyak na sangkap bago gamitin.',
    addDetectedItem: 'Magdagdag ng sangkap',
    findDishes: 'Magrekomenda ng Ulam',
    availableLabel: 'Mayroon na',
    missingLabel: 'Kulang pa',
    extraCostLabel: 'Tinatayang dagdag-gastos',
    addToPantry: 'Idagdag sa Pantry ang nakumpirma',
  },
  settings: {
    title: 'Mga Setting ng Tahanan',
    subtitle: 'Baguhin ang lokasyon, badyet, allergy, kusina, o pantry anumang oras nang hindi inuulit ang onboarding.',
    appearance: 'Hitsura',
    lightMode: 'Maliwanag',
    darkMode: 'Madilim',
    profileSections: 'Profile at Kagustuhan',
    datasetStatus: 'Integridad ng Dataset at PSGC',
    psgcImportTitle: 'Mag-import ng Bagong PSGC File (JSON)',
    psgcImportDesc: 'Kasama na ang lahat ng 17 rehiyon at 1,634 lungsod at bayan mula sa PSA PSGC.',
    resetTitle: 'I-reset Lahat ng Data',
    resetDesc: 'Burahin ang profile, naka-save na plano, pantry, at listahan upang magsimula ulit.',
    resetConfirm: 'Kumpirmahin ang Pag-reset',
    savedToast: 'Na-save ang mga setting',
  },
  disclaimers: {
    footer:
      'UlamWise provides estimated food prices and nutritional information for planning purposes only. Actual prices vary by location, store, season, and availability. Nutritional values are estimates. This application is not medical advice and should not replace professional dietary guidance.',
    allergen:
      'Always check product packaging and ingredient labels. Ingredient substitutions and food preparation may introduce cross-contact risks.',
  },
  slots: {
    B: 'Almusal',
    L: 'Tanghalian',
    D: 'Hapunan',
    M: 'Merienda',
  },
};

const TAGLISH: Translations = {
  appTagline: 'Plan smarter. Shop tipid.',
  nav: {
    home: 'Home',
    mealPlan: 'Meal Plan',
    grocery: 'Grocery',
    pantry: 'Pantry',
    settings: 'Settings',
    fridgeScan: 'Fridge Scan',
  },
  common: {
    next: 'Continue',
    back: 'Back',
    save: 'I-save',
    cancel: 'Cancel',
    reset: 'Reset',
    close: 'Isara',
    apply: 'I-apply',
    loading: 'Inaayos na ang meal plan mo...',
    estimate: 'Estimate',
    perServing: 'per serving',
    minutes: 'min',
    servings: 'servings',
    generatePlan: 'Gumawa ng 7-Day Plan',
    regenerateWeek: 'Regenerate Buong Week',
    optional: 'Optional',
  },
  onboarding: {
    title: 'Welcome sa UlamWise',
    subtitle: 'I-set up natin ang household profile mo para sa swak na Filipino ulam at tipid grocery budget.',
    stepOf: 'Step {current} of {total}',
    resumeNotice: 'Auto-saved ang progress mo — safe kahit mag-refresh ng page.',
    finishCta: 'Generate First 7-Day Plan',
    steps: {
      location: {
        title: 'Saan ka namamalengke at nagluluto?',
        desc: 'Gamit ang official PSA PSGC list para tugma ang local dishes at presyo sa area mo.',
        region: 'Region',
        province: 'Province / NCR District',
        city: 'City / Municipality',
        selectRegion: 'Pumili ng region',
        selectProvince: 'Pumili ng province',
        selectCity: 'Pumili ng city o municipality',
      },
      language: {
        title: 'Piliin ang preferred language mo',
        desc: 'Always visible ang English at local Filipino names ng bawat ulam.',
      },
      household: {
        title: 'Sino-sino ang kakain sa bahay?',
        desc: 'Ginagamit namin ang household size at edad para accurate ang portions at grocery list.',
        addMember: 'Add Member',
        ageLabel: 'Edad (years)',
        totalPortions: 'Estimated portion equivalents',
      },
      budget: {
        title: 'Magkano ang weekly food budget mo?',
        desc: 'Pumili ng budget style. Guide lang ang presets — hindi nito io-override ang nilagay mong peso budget.',
        weeklyLabel: 'Weekly Food Budget (PHP)',
        dailyEq: 'Daily equivalent',
        perMember: 'Per member / week',
        presetsTitle: 'Budget Style',
      },
      store: {
        title: 'Saan ka madalas mamili ng grocery?',
        desc: 'Palengke ang dataset baseline (NCR). Provisional estimates lang ang store multipliers for planning.',
        provisionalNotice: 'Provisional estimate vs NCR palengke baseline — hindi actual surveyed supermarket prices.',
      },
      calories: {
        title: 'Daily calorie preference',
        desc: 'Pwede mag-auto calculate via Mifflin-St Jeor o mag-enter ng sariling target.',
        autoMode: 'Auto estimate',
        manualMode: 'Manual target',
        sex: 'Formula option',
        age: 'Edad',
        height: 'Height (cm)',
        weight: 'Weight (kg)',
        activity: 'Activity level',
        goal: 'Goal',
        manualLabel: 'Daily calorie target (kcal)',
        estimatedBmr: 'Estimated BMR',
        estimatedTdee: 'Estimated TDEE',
        dailyTarget: 'Daily target (Estimate)',
      },
      allergies: {
        title: 'Allergies at dietary preferences',
        desc: 'May strict backend allergen checker kami bago mag-display ng kahit anong ulam.',
        allergiesLabel: 'Food Allergies',
        dietaryLabel: 'Dietary Preferences',
        dislikesLabel: 'Ayaw na sangkap (comma-separated)',
        dislikesPlaceholder: 'hal., ampalaya, atay, okra',
        deterministicNote: 'Strict deterministic check sa 153 Pinoy hidden allergens (patis, bagoong, toyo, hipon, at iba pa).',
      },
      kitchen: {
        title: 'Gamit sa kusina at cooking time',
        desc: 'Piliin kung anong gamit ang meron ka at max cooking time mo per meal.',
        equipmentLabel: 'Available Kitchen Equipment',
        maxTimeLabel: 'Max cooking time per meal',
      },
      pantry: {
        title: 'Ano nang meron sa pantry mo?',
        desc: 'Ibabawas namin ang pantry items mo sa grocery list para tipid at walang doble-bili.',
        quickAdd: 'Quick-add Pinoy staples',
        addCustom: 'Magdagdag ng ibang sangkap',
        sufficientLabel: 'Sapat na for the whole week',
        summaryTitle: 'Ready na ang Profile — Quick Review',
      },
    },
  },
  home: {
    greeting: 'Kusina mo ngayong linggo',
    weeklyBudget: 'Weekly Budget',
    estimatedSpend: 'Est. Grocery Total',
    remainingBudget: 'Remaining Budget',
    dailyEquivalent: 'Daily Budget',
    todaysMeals: 'Ulam for Today',
    viewFullPlan: 'Tingnan ang 7-Day Plan',
    openGroceryList: 'Buksan ang Grocery List',
    fridgeScanCta: 'Scan Fridge / Pantry',
    regionalNoteTitle: 'Regional Kitchen Note',
    noPlanTitle: 'Wala pang meal plan',
    noPlanDesc: 'Gumawa ng 7-day Filipino meal plan na swak sa location, allergies, at budget mo.',
  },
  mealPlan: {
    title: '7-Day Meal Plan',
    modeLocal: 'Local Specialties',
    modeEveryday: 'Everyday Pinoy',
    includeMerienda: 'May Merienda',
    dailyNutrition: 'Daily Nutrition (Estimate)',
    targetLabel: 'Target',
    lockMeal: 'I-lock ang ulam',
    unlockMeal: 'I-unlock',
    swapMeal: 'Palitan',
    regenerateMeal: 'Regenerate',
    viewRecipe: 'Recipe',
    savePlan: 'I-save ang Plan',
    savedPlans: 'Saved Plans',
    favorites: 'Favorites',
    allergenWarningTitle: 'Allergen Info',
    ingredientsHeading: 'Mga Sangkap',
    instructionsHeading: 'Paano Lutuin',
    fallbackNoticeTitle: 'Gamit ang Trusted Local Dataset Planner',
    leftoverLabel: 'Leftover tip',
  },
  grocery: {
    title: 'Smart Grocery List',
    budgetProgress: 'Budget Progress',
    underBudget: 'Pasok sa budget',
    approachingBudget: 'Malapit na sa budget limit',
    overBudget: 'Lagpas sa weekly budget',
    recommendedSwapsTitle: 'Tipid Ingredient Swaps',
    applyAllSwaps: 'I-apply ang Tipid Swaps',
    revertSwaps: 'Reset Swaps',
    copyPlain: 'Copy List',
    copyMessenger: 'Copy for Messenger / Viber',
    printList: 'Print List',
    copied: 'Na-copy na sa clipboard',
    pantryDeductedTitle: 'Covered na ng Pantry',
    boughtProgress: 'Nabili na',
    emptyTitle: 'Generate muna ng meal plan',
    emptyDesc: 'Pag may 7-day meal plan ka na, automatic lalabas dito ang itemized palengke list mo.',
    provisionalBadge: 'Provisional store estimate',
  },
  fridge: {
    title: 'Fridge & Pantry Scan',
    subtitle: 'Mag-upload ng photo ng ref o pantry mo para ma-detect ang ingredients at makahanap ng ulam ideas.',
    uploadLabel: 'Kumuha o mag-upload ng photo',
    scanning: 'Ini-scan ang photo via Gemini Vision...',
    confirmHeading: 'Confirm Detected Ingredients',
    confirmHint: 'I-check, i-edit, o tanggalin ang hindi siguradong detections bago gamitin.',
    addDetectedItem: 'Add ingredient manually',
    findDishes: 'Hanapin ang Swak na Ulam',
    availableLabel: 'Meron na',
    missingLabel: 'Kulang pa',
    extraCostLabel: 'Est. dagdag gastos',
    addToPantry: 'Add confirmed items sa Pantry',
  },
  settings: {
    title: 'Household Settings',
    subtitle: 'Pwede mong i-edit ang location, budget, allergies, kitchen, at pantry anytime without repeating onboarding.',
    appearance: 'Theme',
    lightMode: 'Light',
    darkMode: 'Dark',
    profileSections: 'Profile at Preferences',
    datasetStatus: 'Dataset & PSGC Status',
    psgcImportTitle: 'Import Updated PSGC File (JSON)',
    psgcImportDesc: 'Complete PSA PSGC list (17 regions, 1,634 cities & municipalities) built-in. Pwede mag-import ng updated JSON.',
    resetTitle: 'Reset All Data',
    resetDesc: 'I-clear ang profile, saved plans, pantry, at grocery checklist para mag-start fresh.',
    resetConfirm: 'Confirm Reset Everything',
    savedToast: 'Na-save ang changes',
  },
  disclaimers: {
    footer:
      'UlamWise provides estimated food prices and nutritional information for planning purposes only. Actual prices vary by location, store, season, and availability. Nutritional values are estimates. This application is not medical advice and should not replace professional dietary guidance.',
    allergen:
      'Always check product packaging and ingredient labels. Ingredient substitutions and food preparation may introduce cross-contact risks.',
  },
  slots: {
    B: 'Almusal (Breakfast)',
    L: 'Tanghalian (Lunch)',
    D: 'Hapunan (Dinner)',
    M: 'Merienda',
  },
};

export function getTranslations(lang: LanguageCode): Translations {
  if (lang === 'tl') return TL;
  if (lang === 'taglish') return TAGLISH;
  return EN;
}
