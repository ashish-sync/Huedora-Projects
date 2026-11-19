/** Client CSV helpers — mirror server streaming delimiter rules. */

export const CSV_CANDIDATE_DELIMITERS = [',', ';', '\t'];

const DELIMITER_PROBE_LINES = 12;

export function stripUtf8Bom(text) {
  return String(text ?? '').replace(/^\uFEFF/, '');
}

/**
 * Parse one CSV/TSV line with quoted-field support.
 * @param {string} line
 * @param {string} [delimiter=',']
 */
export function parseCsvLine(line, delimiter = ',') {
  const delim = delimiter || ',';
  const out = [];
  let cur = '';
  let inQuotes = false;
  const src = String(line ?? '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Auto-detect comma / semicolon / tab so EU Excel and TSV files do not
 * collapse an entire row into a single cell.
 */
export function detectCsvDelimiter(text, { candidates = CSV_CANDIDATE_DELIMITERS } = {}) {
  const lines = String(text || '')
    .split(/\r\n|\n|\r/)
    .map((l) => stripUtf8Bom(String(l || '')))
    .filter((l) => l.trim())
    .slice(0, DELIMITER_PROBE_LINES);

  if (!lines.length) return ',';

  let best = ',';
  let bestScore = -1;

  for (const delim of candidates) {
    const counts = lines.map((line) => parseCsvLine(line, delim).length);
    const columns = counts[0] || 0;
    if (columns < 2) continue;

    let variance = 0;
    let consistent = true;
    for (const c of counts) {
      variance += Math.abs(c - columns);
      if (c !== columns) consistent = false;
    }

    const score = columns * 1000 + (consistent ? 250 : 0) - variance * 15;
    if (score > bestScore) {
      bestScore = score;
      best = delim;
    }
  }

  return bestScore < 0 ? ',' : best;
}

export function csvDelimiterLabel(delimiter) {
  if (delimiter === ';') return 'semicolon';
  if (delimiter === '\t') return 'tab';
  return 'comma';
}

/**
 * Split CSV text into physical rows (respecting quoted newlines), then fields.
 * @returns {{ delimiter: string, headers: string[], rows: string[][], records: Record<string, string>[] }}
 */
export function parseCsvTable(text, { delimiter: forcedDelimiter, maxRows = 1000 } = {}) {
  const raw = stripUtf8Bom(String(text ?? ''));
  if (!raw.trim()) {
    return { delimiter: ',', headers: [], rows: [], records: [] };
  }

  const delimiter = forcedDelimiter || detectCsvDelimiter(raw);
  const lines = [];
  let row = [''];
  let inQuotes = false;
  let i = 0;

  while (i < raw.length) {
    const char = raw[i];
    const nextChar = raw[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push('');
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i += 1;
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += char;
    }
    i += 1;
  }
  if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) {
    lines.push(row);
  }

  if (!lines.length) {
    return { delimiter, headers: [], rows: [], records: [] };
  }

  const headers = lines[0].map((h, idx) => String(h ?? '').trim() || `Column ${idx + 1}`);
  const dataRows = [];
  const records = [];

  for (let r = 1; r < lines.length; r += 1) {
    const cells = lines[r].map((c) => String(c ?? '').trim());
    if (cells.every((c) => !c)) continue;
    if (dataRows.length >= maxRows) break;
    dataRows.push(cells);
    const record = {};
    headers.forEach((h, colIdx) => {
      record[h] = cells[colIdx] ?? '';
    });
    records.push(record);
  }

  return { delimiter, headers, rows: dataRows, records };
}

/** Read a File/Blob as Unicode text (UTF-8 BOM or UTF-16 LE). */
export async function readCsvFileText(file) {
  if (!file) return '';
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return stripUtf8Bom(new TextDecoder('utf-16le').decode(bytes));
  }
  let start = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    start = 3;
  }
  return stripUtf8Bom(new TextDecoder('utf-8').decode(bytes.subarray(start)));
}

export function isCsvFileName(name = '') {
  return /\.csv$/i.test(String(name || '')) || /\.tsv$/i.test(String(name || ''));
}
