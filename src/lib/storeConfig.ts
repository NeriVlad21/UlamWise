import type { StoreId } from '../types';

export interface StoreMultiplierConfig {
  id: StoreId;
  name: string;
  shortName: string;
  multiplier: number;
  isProvisional: boolean;
  description: {
    en: string;
    tl: string;
    taglish: string;
  };
}

/**
 * Centralized, editable Philippine store price multipliers.
 * Note: The supplied dataset contains NCR palengke baseline prices (1.00x) and regional
 * price-group multipliers. Additional store multipliers below are provisional planning
 * estimates rather than live surveyed retail prices.
 */
export const STORE_MULTIPLIERS: Record<StoreId, StoreMultiplierConfig> = {
  palengke: {
    id: 'palengke',
    name: 'Palengke / Wet Market',
    shortName: 'Palengke',
    multiplier: 1.0,
    isProvisional: false,
    description: {
      en: 'Dataset baseline (NCR palengke reference prices)',
      tl: 'Batayang presyo ng dataset (NCR palengke)',
      taglish: 'Dataset baseline (NCR palengke reference)',
    },
  },
  puregold: {
    id: 'puregold',
    name: 'Puregold',
    shortName: 'Puregold',
    multiplier: 1.06,
    isProvisional: true,
    description: {
      en: 'Provisional estimate (+6% vs palengke baseline)',
      tl: 'Pansamantalang taya (+6% kumpara sa palengke)',
      taglish: 'Provisional estimate (+6% vs palengke)',
    },
  },
  sm_hypermarket: {
    id: 'sm_hypermarket',
    name: 'SM Hypermarket',
    shortName: 'SM Hypermarket',
    multiplier: 1.12,
    isProvisional: true,
    description: {
      en: 'Provisional estimate (+12% vs palengke baseline)',
      tl: 'Pansamantalang taya (+12% kumpara sa palengke)',
      taglish: 'Provisional estimate (+12% vs palengke)',
    },
  },
  robinsons: {
    id: 'robinsons',
    name: 'Robinsons Supermarket',
    shortName: 'Robinsons',
    multiplier: 1.14,
    isProvisional: true,
    description: {
      en: 'Provisional estimate (+14% vs palengke baseline)',
      tl: 'Pansamantalang taya (+14% kumpara sa palengke)',
      taglish: 'Provisional estimate (+14% vs palengke)',
    },
  },
  walter_mart: {
    id: 'walter_mart',
    name: 'Walter Mart',
    shortName: 'Walter Mart',
    multiplier: 1.1,
    isProvisional: true,
    description: {
      en: 'Provisional estimate (+10% vs palengke baseline)',
      tl: 'Pansamantalang taya (+10% kumpara sa palengke)',
      taglish: 'Provisional estimate (+10% vs palengke)',
    },
  },
  sari_sari: {
    id: 'sari_sari',
    name: 'Sari-sari Store',
    shortName: 'Sari-sari',
    multiplier: 1.18,
    isProvisional: true,
    description: {
      en: 'Provisional estimate (+18% convenience tingi markup)',
      tl: 'Pansamantalang taya (+18% tingi markup)',
      taglish: 'Provisional estimate (+18% tingi markup)',
    },
  },
};

export const STORE_LIST: StoreMultiplierConfig[] = Object.values(STORE_MULTIPLIERS);
