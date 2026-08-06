/** Display "State Name / State Code" for party blocks. */
export function formatStateLine(party) {
  if (!party) return '';
  return [party.stateName, party.stateCode].filter(Boolean).join(' / ') || party.stateCode || '';
}

/**
 * Parse a single "State Name / Code" input into stateName + stateCode.
 * Examples: "Maharashtra / 27", "Maharashtra/27", "27", "Maharashtra"
 */
export function parseStateLine(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { stateName: '', stateCode: '' };

  const slashParts = raw.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
  if (slashParts.length >= 2) {
    const code = slashParts[slashParts.length - 1];
    const name = slashParts.slice(0, -1).join(' / ');
    if (/^\d{1,2}$/.test(code)) {
      return { stateName: name, stateCode: code };
    }
  }

  const trailing = raw.match(/^(.*?)[\s,/-]+(\d{1,2})$/);
  if (trailing) {
    return { stateName: trailing[1].trim(), stateCode: trailing[2] };
  }

  if (/^\d{1,2}$/.test(raw)) {
    return { stateName: '', stateCode: raw };
  }

  return { stateName: raw, stateCode: '' };
}
