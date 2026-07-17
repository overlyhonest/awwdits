import { PropRow, ColorRow } from './PropRow.jsx';

function isTransparent(hex) {
  return !hex || hex === 'transparent' || hex.includes('rgba(0, 0, 0, 0)');
}

function BackgroundSection({ background }) {
  if (!background) return null;

  const hasColor = !isTransparent(background.backgroundColorHex);
  const hasImage = !!background.backgroundImage;
  const isGradient = hasImage && !background.backgroundImage.includes('url(');

  return (
    <div>
      {hasColor && <ColorRow label="Color" hex={background.backgroundColorHex} token={background.backgroundToken} />}
      {isGradient ? (
        <PropRow
          label="Gradient"
          value={background.backgroundImage.length > 50
            ? background.backgroundImage.slice(0, 50) + '...'
            : background.backgroundImage}
        />
      ) : (
        <PropRow label="Gradient" value="none" muted />
      )}
      {hasImage && !isGradient ? (
        <PropRow
          label="Image"
          value={background.backgroundImage.length > 40
            ? '...' + background.backgroundImage.slice(-40)
            : background.backgroundImage}
        />
      ) : (
        !isGradient && <PropRow label="Image" value="none" muted />
      )}
      <PropRow label="Size" value={hasImage ? background.backgroundSize : 'auto'} muted={!hasImage} />
      <PropRow label="Position" value={hasImage ? background.backgroundPosition : '0% 0%'} muted={!hasImage} />
    </div>
  );
}

export default BackgroundSection;
