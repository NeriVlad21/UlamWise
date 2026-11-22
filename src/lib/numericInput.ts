export interface NumericValidationRules {
  allowDecimal: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
  prefix?: string;
}

export interface NumericValidationResult {
  isEmpty: boolean;
  parsed: number | null;
  isValid: boolean;
  error: string | null;
}

/**
 * Sanitizes raw user typing for numeric inputs WITHOUT coercing empty strings to 0,
 * stripping leading zeros prematurely mid-edit, or clamping partial multi-digit values.
 */
export function sanitizeNumericDraft(raw: string, allowDecimal: boolean): string {
  if (!raw) return '';
  // Strip common thousands separators/spaces/currency symbols on paste
  const stripped = raw.replace(/[,\s₱]/g, '');

  if (!allowDecimal) {
    return stripped.replace(/[^0-9]/g, '');
  }

  let out = '';
  let seenDot = false;
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (ch >= '0' && ch <= '9') {
      out += ch;
    } else if (ch === '.' && !seenDot) {
      out += '.';
      seenDot = true;
    }
  }
  return out;
}

function formatBound(value: number, rules: NumericValidationRules): string {
  const numStr = value.toLocaleString('en-PH');
  if (rules.prefix) return `${rules.prefix}${numStr}`;
  if (rules.unit) return `${numStr} ${rules.unit}`;
  return numStr;
}

/**
 * Validates a raw numeric draft string against required/min/max bounds.
 * Does not mutate or coerce invalid strings to fallback numbers.
 */
export function validateNumericDraft(
  raw: string,
  rules: NumericValidationRules
): NumericValidationResult {
  const trimmed = raw.trim();
  const fieldLabel = rules.label ? rules.label : 'Value';
  const capitalized = fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1);

  if (trimmed === '') {
    if (rules.required) {
      return {
        isEmpty: true,
        parsed: null,
        isValid: false,
        error: `${capitalized} is required.`,
      };
    }
    return {
      isEmpty: true,
      parsed: null,
      isValid: true,
      error: null,
    };
  }

  // Bare decimal point "." is incomplete / invalid
  if (trimmed === '.') {
    return {
      isEmpty: false,
      parsed: null,
      isValid: false,
      error: `Enter a valid ${fieldLabel.toLowerCase()}.`,
    };
  }

  const normalized = rules.allowDecimal ? trimmed.replace(/\.$/, '') : trimmed;
  if (normalized === '') {
    return {
      isEmpty: false,
      parsed: null,
      isValid: false,
      error: `Enter a valid ${fieldLabel.toLowerCase()}.`,
    };
  }

  const parsed = rules.allowDecimal ? Number.parseFloat(normalized) : Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) {
    return {
      isEmpty: false,
      parsed: null,
      isValid: false,
      error: `Enter a valid ${fieldLabel.toLowerCase()}.`,
    };
  }

  const rounded = rules.allowDecimal ? Math.round(parsed * 100) / 100 : Math.round(parsed);

  if (rules.min !== undefined && rules.max !== undefined) {
    if (rounded < rules.min || rounded > rules.max) {
      return {
        isEmpty: false,
        parsed: rounded,
        isValid: false,
        error: `${capitalized} must be between ${formatBound(rules.min, rules)} and ${formatBound(rules.max, rules)}.`,
      };
    }
  } else if (rules.min !== undefined && rounded < rules.min) {
    return {
      isEmpty: false,
      parsed: rounded,
      isValid: false,
      error: `${capitalized} must be at least ${formatBound(rules.min, rules)}.`,
    };
  } else if (rules.max !== undefined && rounded > rules.max) {
    return {
      isEmpty: false,
      parsed: rounded,
      isValid: false,
      error: `${capitalized} must be at most ${formatBound(rules.max, rules)}.`,
    };
  }

  return {
    isEmpty: false,
    parsed: rounded,
    isValid: true,
    error: null,
  };
}

/**
 * Formats a committed numeric value into a clean editable string without trailing zeroes.
 */
export function formatNumericValueForInput(
  value: number | null | undefined,
  allowDecimal: boolean
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  if (!allowDecimal) return String(Math.round(value));
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}
