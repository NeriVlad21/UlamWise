export interface ParsedCsv {
  headers: string[];
  rows: Array<{ lineNumber: number; values: Record<string, string> }>;
  malformedRows: Array<{ lineNumber: number; expectedCols: number; actualCols: number; raw: string }>;
}

/**
 * RFC-4180 compliant CSV parser that preserves quoted commas/newlines
 * and reports malformed rows rather than silently dropping them.
 */
export function parseCsv(text: string): ParsedCsv {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records: Array<{ lineNumber: number; fields: string[]; raw: string }> = [];

  let fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let lineNumber = 1;
  let recordStartLine = 1;
  let rawRecord = '';

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      rawRecord += ch;
      if (ch === '"' && next === '"') {
        current += '"';
        rawRecord += next;
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        if (ch === '\n') lineNumber++;
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        rawRecord += ch;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
        rawRecord += ch;
      } else if (ch === '\n') {
        fields.push(current.trim());
        if (fields.some((f) => f.length > 0)) {
          records.push({ lineNumber: recordStartLine, fields, raw: rawRecord });
        }
        fields = [];
        current = '';
        rawRecord = '';
        lineNumber++;
        recordStartLine = lineNumber;
      } else {
        current += ch;
        rawRecord += ch;
      }
    }
  }

  if (current.length > 0 || fields.length > 0) {
    fields.push(current.trim());
    if (fields.some((f) => f.length > 0)) {
      records.push({ lineNumber: recordStartLine, fields, raw: rawRecord });
    }
  }

  if (records.length === 0) {
    return { headers: [], rows: [], malformedRows: [] };
  }

  const headers = records[0].fields.map((h) => h.trim());
  const rows: Array<{ lineNumber: number; values: Record<string, string> }> = [];
  const malformedRows: Array<{ lineNumber: number; expectedCols: number; actualCols: number; raw: string }> = [];

  for (let idx = 1; idx < records.length; idx++) {
    const rec = records[idx];
    if (rec.fields.length !== headers.length) {
      malformedRows.push({
        lineNumber: rec.lineNumber,
        expectedCols: headers.length,
        actualCols: rec.fields.length,
        raw: rec.raw,
      });
    }
    const values: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      values[headers[c]] = rec.fields[c] ?? '';
    }
    rows.push({ lineNumber: rec.lineNumber, values });
  }

  return { headers, rows, malformedRows };
}

export function splitSemicolon(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parseOptionalNumber(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseYesNo(value: string | undefined): boolean {
  return (value ?? '').trim().toLowerCase() === 'yes';
}
