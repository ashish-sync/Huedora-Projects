import { describe, expect, it } from 'vitest';
import {
  detectCsvDelimiter,
  parseCsvLine,
  parseCsvTable,
  csvDelimiterLabel,
  stripUtf8Bom,
} from './csvParse.js';

describe('csvParse', () => {
  it('detects comma, semicolon, and tab', () => {
    expect(detectCsvDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectCsvDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectCsvDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
  });

  it('does not collapse semicolon rows into a single cell', () => {
    const table = parseCsvTable('Name;Email;Phone\nAda;ada@x.com;111\n');
    expect(table.delimiter).toBe(';');
    expect(table.headers).toEqual(['Name', 'Email', 'Phone']);
    expect(table.rows[0]).toEqual(['Ada', 'ada@x.com', '111']);
    expect(table.records[0].Email).toBe('ada@x.com');
  });

  it('respects quoted delimiters', () => {
    expect(parseCsvLine('"a;b";c', ';')).toEqual(['a;b', 'c']);
    const table = parseCsvTable('Name,Note\n"Ada, Lovelace","ok, yes"\n');
    expect(table.rows[0]).toEqual(['Ada, Lovelace', 'ok, yes']);
  });

  it('strips UTF-8 BOM and labels delimiters', () => {
    expect(stripUtf8Bom('\uFEFFa,b')).toBe('a,b');
    expect(csvDelimiterLabel(';')).toBe('semicolon');
    expect(csvDelimiterLabel('\t')).toBe('tab');
  });
});
