// src/utils/resolve/pageState.test.js
import { describe, it, expect } from 'vitest';
import { detectThemeFromChain, pageHeader, sheetsHavePrefersColorScheme } from './pageState.js';

const node = (selector, classList = [], attrs = {}) => ({ selector, classList, attrs });

describe('detectThemeFromChain', () => {
  it('reads an explicit .dark carrier', () => {
    const chain = [node('button.cta'), node('div.preview', ['dark'])];
    expect(detectThemeFromChain(chain, { prefersDark: false, hasMediaRule: false }))
      .toEqual({ mode: 'dark', method: 'carrier:.dark', carrier: '.dark', carrierSelector: 'div.preview' });
  });

  it('reads a data-theme carrier', () => {
    const chain = [node('a'), node('html', [], { 'data-theme': 'dark' })];
    const r = detectThemeFromChain(chain, { prefersDark: false, hasMediaRule: false });
    expect(r.mode).toBe('dark');
    expect(r.method).toBe('carrier:[data-theme=dark]');
  });

  it('falls back to prefers-color-scheme when a media rule exists and no carrier', () => {
    const chain = [node('a'), node('body')];
    expect(detectThemeFromChain(chain, { prefersDark: true, hasMediaRule: true }))
      .toEqual({ mode: 'dark', method: 'prefers-color-scheme', carrier: null, carrierSelector: null });
  });

  it('returns null (omit, never guess) with no carrier and no media rule', () => {
    expect(detectThemeFromChain([node('a')], { prefersDark: true, hasMediaRule: false })).toBe(null);
  });

  it('prefers the nearest carrier over a media query', () => {
    const chain = [node('span'), node('div.card', ['light'])];
    const r = detectThemeFromChain(chain, { prefersDark: true, hasMediaRule: true });
    expect(r.mode).toBe('light');
    expect(r.method).toBe('carrier:.light');
  });

  it('prefers the nearest carrier when a farther carrier conflicts (nearest-wins, not carrier-order)', () => {
    // Near element carries .light; a farther ancestor carries the opposite, .dark.
    // Walking the chain nearest-first must stop at the first (nearest) match.
    const chain = [node('div.card', ['light']), node('section.page', ['dark'])];
    const r = detectThemeFromChain(chain, { prefersDark: true, hasMediaRule: true });
    expect(r.mode).toBe('light');
    expect(r.method).toBe('carrier:.light');
    expect(r.carrierSelector).toBe('div.card');
  });
});

describe('sheetsHavePrefersColorScheme', () => {
  it('returns true when a media rule\'s media.mediaText includes prefers-color-scheme', () => {
    const sheets = [
      { cssRules: [{ media: { mediaText: '(prefers-color-scheme: dark)' } }] },
    ];
    expect(sheetsHavePrefersColorScheme(sheets)).toBe(true);
  });

  it('returns false when rules exist but none reference prefers-color-scheme', () => {
    const sheets = [
      { cssRules: [
        { selectorText: '.foo' }, // plain style rule, no `media` at all
        { media: { mediaText: '(min-width: 600px)' } }, // media rule, non-matching
      ] },
    ];
    expect(sheetsHavePrefersColorScheme(sheets)).toBe(false);
  });

  it('swallows a cross-origin cssRules access error and returns false', () => {
    const sheets = [
      { get cssRules() { throw new Error('x-origin'); } },
    ];
    expect(() => sheetsHavePrefersColorScheme(sheets)).not.toThrow();
    expect(sheetsHavePrefersColorScheme(sheets)).toBe(false);
  });
});

describe('pageHeader', () => {
  it('includes the mode segment when theme is present', () => {
    const h = pageHeader({ url: 'http://localhost:5173/', viewport: { w: 1440, h: 900 }, date: '2026-07-17',
      theme: { mode: 'light', method: 'prefers-color-scheme' } });
    expect(h).toBe('# awwdits · http://localhost:5173/ · light mode (prefers-color-scheme) · 1440×900 · 2026-07-17');
  });

  it('omits the mode segment entirely when theme is null', () => {
    const h = pageHeader({ url: 'http://x/', viewport: { w: 800, h: 600 }, date: '2026-07-17', theme: null });
    expect(h).toBe('# awwdits · http://x/ · 800×600 · 2026-07-17');
  });
});
