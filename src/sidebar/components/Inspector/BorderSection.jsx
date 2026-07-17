import { PropRow, ColorRow } from './PropRow.jsx';

function hasNonZeroRadius(v) {
  if (!v) return false;
  return v.split(/\s+/).some(p => parseFloat(p) > 0 || p.includes('%'));
}

function formatPerSide(top, right, bottom, left) {
  if (top === right && right === bottom && bottom === left) return top;
  return `${top} ${right} ${bottom} ${left}`;
}

function BorderSection({ border }) {
  if (!border) return null;

  const width = formatPerSide(
    border.topWidth, border.rightWidth, border.bottomWidth, border.leftWidth,
  );
  const hasWidth = [border.topWidth, border.rightWidth, border.bottomWidth, border.leftWidth]
    .some(w => w && w !== '0px');

  const style = formatPerSide(
    border.topStyle, border.rightStyle, border.bottomStyle, border.leftStyle,
  );
  const hasStyle = [border.topStyle, border.rightStyle, border.bottomStyle, border.leftStyle]
    .some(s => s && s !== 'none');

  const hasRadius = hasNonZeroRadius(border.radius);
  const hasBorderColor = hasWidth && border.colorHex && border.colorHex !== 'transparent';

  return (
    <div>
      {hasWidth && <PropRow label="Width" value={width} />}
      {hasStyle && <PropRow label="Style" value={style} />}
      {hasRadius && <PropRow label="Radius" value={border.radius} />}
      {hasBorderColor && <ColorRow label="Color" hex={border.colorHex} />}
    </div>
  );
}

export default BorderSection;
