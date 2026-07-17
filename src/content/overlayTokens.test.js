// Drift guard. The page-context overlays have no stylesheet, so nothing structurally
// stops a contributor from hand-writing a hex or a system font stack — which is exactly
// how the overlay layer once reached 43 distinct colors and three off-brand typefaces.
// These tests fail the build if any styling value is declared outside overlayTokens.js.
//
// Legitimate non-styling uses (e.g. comparing a page's computed color against '#000000')
// opt out with a `design-token-exempt` comment on the line.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = 'overlayTokens.js';
const EXEMPT = 'design-token-exempt';

const sourceFiles = readdirSync(DIR)
  .filter(f => f.endsWith('.js') && !f.endsWith('.test.js') && f !== TOKENS_FILE)
  .sort();

/** Blank out comment bodies, preserving line numbering, so prose about a font or a
 *  colour isn't mistaken for a declaration of one. `https://` is not a line comment. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map(line => line.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

/** Every line of executable styling code, tagged with its origin. */
function lines() {
  return sourceFiles.flatMap(file => {
    const raw = readFileSync(join(DIR, file), 'utf8').split('\n');
    return stripComments(raw.join('\n'))
      .split('\n')
      .map((text, i) => ({ file, line: i + 1, text, raw: raw[i] || '' }))
      .filter(l => !l.raw.includes(EXEMPT));
  });
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const LITERAL_FAMILY =
  /(-apple-system|BlinkMacSystemFont|Segoe UI|SF Mono|Consolas|['"]Inter['"]|Special Gothic|JetBrains Mono)/;

describe('overlay design tokens', () => {
  it('declares no hex colors outside overlayTokens.js', () => {
    const found = lines()
      .flatMap(l => (l.text.match(HEX) || []).map(hex => `${l.file}:${l.line}  ${hex}`));
    expect(found).toEqual([]);
  });

  it('declares no literal font families outside overlayTokens.js', () => {
    const found = lines()
      .filter(l => LITERAL_FAMILY.test(l.text))
      .map(l => `${l.file}:${l.line}  ${l.text.trim().slice(0, 72)}`);
    expect(found).toEqual([]);
  });

  it('keeps the toolbar surface canonical — chrome shares one bg and one border', async () => {
    const { COLORS } = await import('./overlayTokens.js');
    expect(COLORS.bg).toBe('#2d2d30');     // --surface
    expect(COLORS.border).toBe('#3e3e40'); // --border-strong
  });
});
