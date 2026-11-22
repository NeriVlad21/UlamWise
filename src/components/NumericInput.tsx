import React, { useEffect, useId, useRef, useState } from 'react';
import {
  formatNumericValueForInput,
  sanitizeNumericDraft,
  validateNumericDraft,
} from '../lib/numericInput';

export interface NumericInputProps {
  id?: string;
  value: number | null | undefined;
  onValueChange: (next: number) => void;
  onEmptyChange?: () => void;
  onValidityChange?: (isValid: boolean, error: string | null) => void;
  /**
   * Optional predicate controlling whether a valid parsed value should commit immediately
   * while the user is still typing (e.g., avoid switching minor/adult layout on digit 1 of "21").
   * Values always commit on blur when valid.
   */
  shouldCommitOnChange?: (parsed: number, rawDraft: string) => boolean;
  allowDecimal?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  inputClassName?: string;
  showErrorInline?: boolean;
  autoComplete?: string;
  /** Increment to force re-syncing draft from value (e.g., when clicking a preset button) */
  externalSyncKey?: number;
}

/**
 * Accessible, cursor-safe numeric input that preserves the raw string while typing,
 * supports clearing/select-all/backspace/decimals without resetting to 0 or old values,
 * uses proper mobile keyboards (numeric vs decimal), and validates cleanly on blur.
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  id,
  value,
  onValueChange,
  onEmptyChange,
  onValidityChange,
  shouldCommitOnChange,
  allowDecimal = false,
  required = true,
  min,
  max,
  label,
  unit,
  prefix,
  suffix,
  placeholder,
  ariaLabel,
  className = '',
  inputClassName = '',
  showErrorInline = true,
  autoComplete = 'off',
  externalSyncKey,
}) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  const [draft, setDraft] = useState<string>(() =>
    formatNumericValueForInput(value, allowDecimal)
  );
  const [error, setError] = useState<string | null>(null);
  const isFocusedRef = useRef(false);
  const lastCommittedValueRef = useRef<number | null | undefined>(value);
  const lastSyncKeyRef = useRef<number | undefined>(externalSyncKey);

  // Sync external prop changes ONLY when the input is NOT focused and the external value genuinely changed
  // (e.g., user clicked a preset chip, reset settings, or loaded a saved profile).
  useEffect(() => {
    const forceSync = externalSyncKey !== lastSyncKeyRef.current;
    if (forceSync) {
      lastSyncKeyRef.current = externalSyncKey;
      isFocusedRef.current = false;
      lastCommittedValueRef.current = value;
      setDraft(formatNumericValueForInput(value, allowDecimal));
      setError(null);
      onValidityChange?.(true, null);
      return;
    }
    if (isFocusedRef.current) return;
    if (value !== lastCommittedValueRef.current) {
      lastCommittedValueRef.current = value;
      setDraft(formatNumericValueForInput(value, allowDecimal));
      setError(null);
      onValidityChange?.(true, null);
    }
  }, [value, allowDecimal, onValidityChange, externalSyncKey]);

  const rules = {
    allowDecimal,
    required,
    min,
    max,
    label,
    unit: unit ?? suffix,
    prefix,
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const sanitized = sanitizeNumericDraft(raw, allowDecimal);
    setDraft(sanitized);

    const check = validateNumericDraft(sanitized, rules);
    if (check.isEmpty) {
      if (!required) {
        setError(null);
        lastCommittedValueRef.current = undefined;
        onEmptyChange?.();
        onValidityChange?.(true, null);
      } else {
        // Don't scream an error while the user just cleared the field to retype,
        // but inform parent validity so Continue/Submit can validate cleanly.
        setError(null);
        onValidityChange?.(false, check.error);
      }
      return;
    }

    if (check.isValid && check.parsed !== null) {
      setError(null);
      onValidityChange?.(true, null);
      const allowImmediate = shouldCommitOnChange
        ? shouldCommitOnChange(check.parsed, sanitized)
        : true;
      if (allowImmediate) {
        lastCommittedValueRef.current = check.parsed;
        onValueChange(check.parsed);
      }
    } else {
      // Do NOT overwrite or clamp partially typed values (e.g., typing "1" on the way to "167" or "2" -> "2000")
      // Clear any previous blur error while typing so user isn't interrupted mid-entry.
      onValidityChange?.(false, check.error);
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const check = validateNumericDraft(draft, rules);

    if (check.isEmpty) {
      if (!required) {
        setDraft('');
        setError(null);
        lastCommittedValueRef.current = undefined;
        onEmptyChange?.();
        onValidityChange?.(true, null);
      } else {
        // Keep field empty so user sees it needs input — NEVER silently snap back to 0 or stale value
        setDraft('');
        setError(check.error);
        onValidityChange?.(false, check.error);
      }
      return;
    }

    if (check.isValid && check.parsed !== null) {
      const cleanFormatted = formatNumericValueForInput(check.parsed, allowDecimal);
      setDraft(cleanFormatted);
      setError(null);
      lastCommittedValueRef.current = check.parsed;
      onValueChange(check.parsed);
      onValidityChange?.(true, null);
    } else {
      // Keep the user's entered text visible and explain the valid range clearly
      setError(check.error);
      onValidityChange?.(false, check.error);
    }
  };

  const hasPrefix = Boolean(prefix);
  const hasSuffix = Boolean(suffix);

  return (
    <div className={className}>
      <div className="relative flex items-center">
        {hasPrefix && (
          <span
            aria-hidden="true"
            className="pointer-events-none select-none absolute left-3.5 text-sm sm:text-base font-semibold text-[#535E58] dark:text-[#A6B5AE]"
          >
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          type="text"
          inputMode={allowDecimal ? 'decimal' : 'numeric'}
          autoComplete={autoComplete}
          spellCheck={false}
          value={draft}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`w-full min-h-[44px] rounded-xl border bg-[#FAF8F4] dark:bg-[#111815] text-sm font-mono-tabular transition-colors focus:outline-none focus:ring-2 ${
            error
              ? 'border-red-600 dark:border-red-400 focus:ring-red-500/30'
              : 'border-[#D8CFC0] dark:border-[#2A3B34] focus:border-[#1B4D3E] dark:focus:border-[#34926F] focus:ring-[#1B4D3E]/20'
          } ${hasPrefix ? 'pl-8' : 'px-3'} ${hasSuffix ? 'pr-12' : 'pr-3'} ${inputClassName}`}
        />
        {hasSuffix && (
          <span
            aria-hidden="true"
            className="pointer-events-none select-none absolute right-3 text-xs font-medium text-[#535E58] dark:text-[#A6B5AE]"
          >
            {suffix}
          </span>
        )}
      </div>
      {showErrorInline && error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-xs text-red-700 dark:text-red-300 leading-snug"
        >
          {error}
        </p>
      )}
    </div>
  );
};
