export function extractSpacing() {
  const spacing = new Map();

  const allElements = Array.from(document.querySelectorAll('*')).slice(0, 2000);

  allElements.forEach(element => {
    try {
      const styles = getComputedStyle(element);

      // Padding
      ['Top', 'Right', 'Bottom', 'Left'].forEach(side => {
        trackSpacing(styles[`padding${side}`], 'padding', spacing);
      });

      // Margin
      ['Top', 'Right', 'Bottom', 'Left'].forEach(side => {
        const val = styles[`margin${side}`];
        if (val && val !== 'auto') {
          trackSpacing(val, 'margin', spacing);
        }
      });

      // Gap
      const gap = styles.gap;
      if (gap && gap !== 'normal' && gap !== '0px') {
        // gap can be "8px 16px" etc
        gap.split(' ').forEach(v => trackSpacing(v, 'gap', spacing));
      }

      // Row/column gap
      ['rowGap', 'columnGap'].forEach(prop => {
        const val = styles[prop];
        if (val && val !== 'normal' && val !== '0px') {
          trackSpacing(val, 'gap', spacing);
        }
      });
    } catch {
      // Skip
    }
  });

  const values = Array.from(spacing.values())
    .filter(v => {
      const num = parseFloat(v.value);
      return !isNaN(num) && num > 0;
    })
    .sort((a, b) => b.frequency - a.frequency);

  return {
    values,
    scaleDetected: detectScale(values),
    totalUnique: values.length,
  };
}

function trackSpacing(value, type, map) {
  if (!value || value === '0px' || value === '0') return;

  if (!map.has(value)) {
    map.set(value, {
      value,
      frequency: 0,
      usedAs: { padding: 0, margin: 0, gap: 0 },
    });
  }

  const item = map.get(value);
  item.frequency++;
  item.usedAs[type] = (item.usedAs[type] || 0) + 1;
}

function detectScale(values) {
  const nums = values
    .map(v => parseFloat(v.value))
    .filter(v => !isNaN(v) && v > 0 && v <= 64);

  if (nums.length === 0) return 'inconsistent';

  const allMultiplesOf8 = nums.every(v => v % 8 === 0);
  if (allMultiplesOf8) return '8pt';

  const allMultiplesOf4 = nums.every(v => v % 4 === 0);
  if (allMultiplesOf4) return '4pt';

  return 'inconsistent';
}
