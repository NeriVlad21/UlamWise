import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeNumericDraft,
  validateNumericDraft,
  formatNumericValueForInput,
} from '../numericInput.ts';

describe('sanitizeNumericDraft', () => {
  it('preserves empty string without coercing to 0', () => {
    assert.equal(sanitizeNumericDraft('', false), '');
    assert.equal(sanitizeNumericDraft('', true), '');
  });

  it('allows multi-digit integer typing step-by-step without premature clamping', () => {
    // Typing 21 (age)
    assert.equal(sanitizeNumericDraft('2', false), '2');
    assert.equal(sanitizeNumericDraft('21', false), '21');

    // Typing 167 (height)
    assert.equal(sanitizeNumericDraft('1', true), '1');
    assert.equal(sanitizeNumericDraft('16', true), '16');
    assert.equal(sanitizeNumericDraft('167', true), '167');

    // Typing 95 (weight)
    assert.equal(sanitizeNumericDraft('9', true), '9');
    assert.equal(sanitizeNumericDraft('95', true), '95');

    // Typing 2000 (budget / calorie target)
    assert.equal(sanitizeNumericDraft('2', false), '2');
    assert.equal(sanitizeNumericDraft('20', false), '20');
    assert.equal(sanitizeNumericDraft('200', false), '200');
    assert.equal(sanitizeNumericDraft('2000', false), '2000');
  });

  it('handles decimals cleanly and blocks multiple decimal points', () => {
    assert.equal(sanitizeNumericDraft('167.', true), '167.');
    assert.equal(sanitizeNumericDraft('167.5', true), '167.5');
    assert.equal(sanitizeNumericDraft('95.25', true), '95.25');
    assert.equal(sanitizeNumericDraft('167.5.2', true), '167.52');
    // Non-decimal fields strip decimal points
    assert.equal(sanitizeNumericDraft('21.5', false), '215');
  });

  it('strips currency symbols, commas, spaces, and stray letters on paste', () => {
    assert.equal(sanitizeNumericDraft('₱2,000', false), '2000');
    assert.equal(sanitizeNumericDraft(' 1,650.50 ', true), '1650.50');
    assert.equal(sanitizeNumericDraft('abc123def', false), '123');
    assert.equal(sanitizeNumericDraft('-21', false), '21');
  });
});

describe('validateNumericDraft', () => {
  it('flags empty required fields without reverting to 0', () => {
    const res = validateNumericDraft('', {
      allowDecimal: false,
      required: true,
      min: 1,
      max: 110,
      label: 'Age',
      unit: 'years',
    });
    assert.equal(res.isEmpty, true);
    assert.equal(res.parsed, null);
    assert.equal(res.isValid, false);
    assert.equal(res.error, 'Age is required.');
  });

  it('accepts empty optional fields (e.g. pantry quantity)', () => {
    const res = validateNumericDraft('', {
      allowDecimal: true,
      required: false,
      min: 0.01,
      max: 99999,
      label: 'Quantity',
    });
    assert.equal(res.isEmpty, true);
    assert.equal(res.parsed, null);
    assert.equal(res.isValid, true);
    assert.equal(res.error, null);
  });

  it('validates age, height, weight, weekly budget, calorie target, and cook time bounds', () => {
    // Valid values requested by user
    assert.deepEqual(
      validateNumericDraft('21', { allowDecimal: false, required: true, min: 1, max: 110, label: 'Age', unit: 'years' }),
      { isEmpty: false, parsed: 21, isValid: true, error: null }
    );
    assert.deepEqual(
      validateNumericDraft('167', { allowDecimal: true, required: true, min: 110, max: 230, label: 'Height', unit: 'cm' }),
      { isEmpty: false, parsed: 167, isValid: true, error: null }
    );
    assert.deepEqual(
      validateNumericDraft('167.5', { allowDecimal: true, required: true, min: 110, max: 230, label: 'Height', unit: 'cm' }),
      { isEmpty: false, parsed: 167.5, isValid: true, error: null }
    );
    assert.deepEqual(
      validateNumericDraft('95', { allowDecimal: true, required: true, min: 30, max: 220, label: 'Weight', unit: 'kg' }),
      { isEmpty: false, parsed: 95, isValid: true, error: null }
    );
    assert.deepEqual(
      validateNumericDraft('2000', { allowDecimal: false, required: true, min: 200, max: 50000, label: 'Weekly budget', prefix: '₱' }),
      { isEmpty: false, parsed: 2000, isValid: true, error: null }
    );

    // Out-of-range values return understandable messages
    const lowBudget = validateNumericDraft('50', {
      allowDecimal: false,
      required: true,
      min: 200,
      max: 50000,
      label: 'Weekly budget',
      prefix: '₱',
    });
    assert.equal(lowBudget.isValid, false);
    assert.equal(lowBudget.error, 'Weekly budget must be between ₱200 and ₱50,000.');

    const highAge = validateNumericDraft('150', {
      allowDecimal: false,
      required: true,
      min: 1,
      max: 110,
      label: 'Age',
      unit: 'years',
    });
    assert.equal(highAge.isValid, false);
    assert.equal(highAge.error, 'Age must be between 1 years and 110 years.');
  });

  it('handles trailing decimal points and rejects bare dot', () => {
    const trailing = validateNumericDraft('167.', {
      allowDecimal: true,
      required: true,
      min: 110,
      max: 230,
      label: 'Height',
      unit: 'cm',
    });
    assert.equal(trailing.isValid, true);
    assert.equal(trailing.parsed, 167);

    const bareDot = validateNumericDraft('.', {
      allowDecimal: true,
      required: true,
      min: 110,
      max: 230,
      label: 'Height',
      unit: 'cm',
    });
    assert.equal(bareDot.isValid, false);
    assert.equal(bareDot.parsed, null);
    assert.equal(bareDot.error, 'Enter a valid height.');
  });
});

describe('formatNumericValueForInput', () => {
  it('formats committed numbers cleanly without trailing zeroes', () => {
    assert.equal(formatNumericValueForInput(21, false), '21');
    assert.equal(formatNumericValueForInput(167.5, true), '167.5');
    assert.equal(formatNumericValueForInput(167.0, true), '167');
    assert.equal(formatNumericValueForInput(null, false), '');
    assert.equal(formatNumericValueForInput(undefined, true), '');
  });
});
