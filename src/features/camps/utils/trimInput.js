export function trimString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

export function trimParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() : value,
    ])
  );
}

export function trimFormStrings(form, keys) {
  const next = { ...form };
  keys.forEach((key) => {
    if (typeof next[key] === 'string') {
      next[key] = next[key].trim();
    }
  });
  return next;
}
