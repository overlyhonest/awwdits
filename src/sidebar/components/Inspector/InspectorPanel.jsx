import { FONT, COLOR } from '../redesign/tokens.js';
import SpacingSection from './SpacingSection.jsx';
import TypographyProperties from './TypographyProperties.jsx';
import ColorSection from './ColorSection.jsx';
import ImageSection from './ImageSection.jsx';
import BackgroundSection from './BackgroundSection.jsx';
import BorderSection from './BorderSection.jsx';
import EffectsSection from './EffectsSection.jsx';
import CssVariablesSection from './CssVariablesSection.jsx';
import ElementSummary from './ElementSummary.jsx';

function hasRelevantColors(colors) {
  if (!colors) return false;
  const isRelevant = (hex) => hex && hex !== 'transparent' && !hex.includes('rgba(0, 0, 0, 0)');
  return (isRelevant(colors.backgroundColorHex) && colors.backgroundColorHex !== '#000000')
    || isRelevant(colors.colorHex)
    || isRelevant(colors.borderColorHex);
}

function hasRelevantBackground(bg) {
  if (!bg) return false;
  const hasColor = bg.backgroundColorHex
    && bg.backgroundColorHex !== 'transparent'
    && !bg.backgroundColorHex.includes('rgba(0, 0, 0, 0)');
  return hasColor || !!bg.backgroundImage;
}

function hasRelevantBorder(border) {
  if (!border) return false;
  const hasWidth = [border.topWidth, border.rightWidth, border.bottomWidth, border.leftWidth]
    .some(w => w && w !== '0px');
  const hasRadius = border.radius && border.radius.split(/\s+/).some(p => parseFloat(p) > 0);
  return hasWidth || hasRadius;
}

function hasRelevantEffects(effects) {
  if (!effects) return false;
  return !!(effects.boxShadow || effects.opacity || effects.transform || effects.overflow);
}

function InspectorPanel({ data }) {
  // InspectZone only mounts this with a real selection, so an empty state here is
  // unreachable — guard defensively and bail rather than ship dead UI.
  if (!data) return null;

  const { styles, contrast } = data;

  // Relevance: an image is a leaf visual — only its own Image block (with a preview) and
  // Effects matter. The box model (Layout / padding), border, typography, text color, and
  // background are all irrelevant to a leaf image, so they're hidden for it.
  const isImage = !!styles?.image;
  const showLayout = !isImage;
  const showColors = !isImage && hasRelevantColors(styles?.colors);
  const showImage = isImage;
  const showTypography = !isImage && !!styles?.typography;
  const showBackground = !isImage && hasRelevantBackground(styles?.background);
  const showBorder = !isImage && hasRelevantBorder(styles?.border);
  const showEffects = hasRelevantEffects(styles?.effects);
  const showCssVars = !isImage && styles?.cssVariables?.length > 0;

  return (
    <div>
      {/* Focal summary — selector, stray count, and dimensions as the hero */}
      <ElementSummary styles={styles} />

      {/* Layout — hidden for images (the box model is irrelevant to a leaf image) */}
      {showLayout && (
        <div style={{ borderBottom: `1px solid ${COLOR.border}` }}>
          <SectionHeader>Layout</SectionHeader>
          <SpacingSection styles={styles} />
        </div>
      )}

      {/* Typography */}
      {showTypography && (
        <div style={{ borderBottom: `1px solid ${COLOR.border}` }}>
          <SectionHeader>Typography</SectionHeader>
          <TypographyProperties typography={styles.typography} />
        </div>
      )}

      {/* Color + Contrast */}
      {(showColors || (!isImage && contrast)) && (
        <div style={{ borderBottom: `1px solid ${COLOR.border}` }}>
          <SectionHeader>Color</SectionHeader>
          <ColorSection colors={styles?.colors} contrast={contrast} />
        </div>
      )}

      {/* Image */}
      {showImage && (
        <div style={{ borderBottom: `1px solid ${COLOR.border}` }}>
          <SectionHeader>Image</SectionHeader>
          <ImageSection image={styles.image} />
        </div>
      )}

      {/* Background */}
      {showBackground && (
        <div style={{ borderBottom: `1px solid ${COLOR.border}` }}>
          <SectionHeader>Background</SectionHeader>
          <BackgroundSection background={styles.background} />
        </div>
      )}

      {/* Border */}
      {showBorder && (
        <div style={{ borderBottom: `1px solid ${COLOR.border}` }}>
          <SectionHeader>Border</SectionHeader>
          <BorderSection border={styles.border} />
        </div>
      )}

      {/* Effects */}
      {showEffects && (
        <div style={{ borderBottom: `1px solid ${COLOR.border}` }}>
          <SectionHeader>Effects</SectionHeader>
          <EffectsSection effects={styles.effects} />
        </div>
      )}

      {/* CSS Variables */}
      {showCssVars && (
        <div style={{ borderBottom: `1px solid ${COLOR.border}` }}>
          <SectionHeader>CSS variables</SectionHeader>
          <CssVariablesSection variables={styles.cssVariables} />
        </div>
      )}
    </div>
  );
}

export function SectionHeader({ children }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: 40,
      padding: '0 10px 0 16px',
    }}>
      {/* Section titles (Layout, Typography, Color, …) sit at label weight, matching the
          field labels in inspectorStyles.js — the heading is furniture, the values are
          the content. Shared with the edit screen, which imports this. */}
      <span style={{
        fontFamily: FONT.display,
        fontSize: 12,
        fontWeight: 400,
        color: COLOR.foregroundLabel,
        textTransform: 'uppercase',
        lineHeight: 'normal',
      }}>
        {children}
      </span>
    </div>
  );
}

export default InspectorPanel;
