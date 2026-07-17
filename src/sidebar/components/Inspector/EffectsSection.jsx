import { PropRow } from './PropRow.jsx';

function EffectsSection({ effects }) {
  if (!effects) return null;

  const shadow = effects.boxShadow;
  const shadowDisplay = shadow
    ? (shadow.includes(')') ? shadow.split(')')[0] + ')' : shadow)
    : null;

  return (
    <div>
      <PropRow label="Opacity" value={effects.opacity || '100%'} />
      <PropRow label="Shadow" value={shadowDisplay || 'none'} muted={!shadowDisplay} />
      <PropRow label="Blur" value={effects.filter || 'none'} muted={!effects.filter} />
    </div>
  );
}

export default EffectsSection;
