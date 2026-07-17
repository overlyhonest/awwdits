// Thin var()-shim over the design tokens. The real values (light + dark) live in
// src/sidebar/tokens.css as role-based CSS custom properties; this maps them to
// JS so the inline-styled components read semantic names and theme for free.
//
// Naming follows the shadcn/Radix-style taxonomy: foreground / surface / border
// families with -weak/-strong/-muted variants, and semantic info/warning/
// destructive/success roles split into -solid (fills) vs -foreground (on-surface).

export const FONT = {
  // Special Gothic Expanded One — display: wordmark, headings, labels, tabs, buttons.
  display: '"Special Gothic Expanded One", "Arial", system-ui, sans-serif',
  // Special Gothic — body / supporting UI text.
  sans: '"Special Gothic", system-ui, -apple-system, sans-serif',
  // JetBrains Mono — data: values, tokens, code.
  mono: '"JetBrains Mono", ui-monospace, "SFMono-Regular", monospace',
};
FONT.wordmark = FONT.display; // the wordmark uses the display face
FONT.serif = FONT.display; // back-compat alias (no serif in the system anymore)

export const COLOR = {
  // Surfaces
  background: 'var(--background)',
  surface: 'var(--surface)', // also inputs — they sit raised, not recessed
  surfaceHigh: 'var(--surface-raised)',
  card: 'var(--card)',
  boxFill: 'var(--box-fill)',

  // Text (foreground → muted → weak → subtle)
  foreground: 'var(--foreground)',
  foregroundMuted: 'var(--foreground-muted)',
  foregroundWeak: 'var(--foreground-weak)',
  foregroundSubtle: 'var(--foreground-subtle)',
  foregroundLabel: 'var(--foreground-label)',

  // Borders
  border: 'var(--border)',
  borderWeak: 'var(--border-weak)',
  borderStrong: 'var(--border-strong)',

  // Info / brand accent — split fill vs on-surface
  infoSolid: 'var(--info-solid)',
  infoSolidHover: 'var(--info-solid-hover)',
  infoSolidFg: 'var(--info-solid-foreground)',
  info: 'var(--info-foreground)',
  infoMuted: 'var(--info-muted)',
  infoTint: 'var(--info-tint)',
  focusRing: 'var(--focus-ring)',

  // Semantic — foreground reads on a surface, solid is a fill, muted is a tint bg
  warning: 'var(--warning-foreground)',
  warningSolid: 'var(--warning-solid)',
  warningMuted: 'var(--warning-muted)',
  danger: 'var(--destructive-foreground)',
  dangerSolid: 'var(--destructive-solid)',
  dangerMuted: 'var(--destructive-muted)',
  success: 'var(--success-foreground)',
  successSolid: 'var(--success-solid)',
  successMuted: 'var(--success-muted)',
};

// 4px spacing grid.
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

// Radius scale — small controls sharp, cards softer. Concentric where nested.
export const RADIUS = { xs: 2, sm: 4, md: 8, lg: 12, pill: 999 };

// ── Health grade → meaning ──────────────────────────────────────────────────
// The grade and its bar encode health, so an "F" never looks like an "A".
export function gradeColor(score) {
  if (score == null) return COLOR.foregroundWeak;
  if (score >= 80) return COLOR.successSolid; // A / B — healthy
  if (score >= 55) return COLOR.warningSolid; // C / D — needs work
  return COLOR.dangerSolid; // F — failing
}

// Platform-aware modifier label used in the inspect copy.
export const MOD =
  typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
    ? '⌘'
    : 'Ctrl';
