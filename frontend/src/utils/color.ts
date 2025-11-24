export const normalizeColorForInput = (value?: string, fallback = '#000000') => {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();

  // Already full hex (#rrggbb)
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed;
  }

  // Expand shorthand hex (#rgb)
  const shorthandMatch = trimmed.match(/^#([0-9a-f]{3})$/i);
  if (shorthandMatch) {
    return `#${shorthandMatch[1]
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`;
  }

  // Convert rgb/rgba to hex (ignore alpha for rgba)
  const rgbMatch = trimmed.match(/^rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})(?:,\s*([0-9.]+))?\)$/i);
  if (rgbMatch) {
    const hex = rgbMatch
      .slice(1, 4)
      .map((component) => {
        const intVal = Math.max(0, Math.min(255, parseInt(component, 10) || 0));
        const hexValue = intVal.toString(16);
        return hexValue.length === 1 ? `0${hexValue}` : hexValue;
      })
      .join('');

    return `#${hex}`;
  }

  return fallback;
};

