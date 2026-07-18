import { useState, useEffect } from 'react';
import { FONT, COLOR } from '../redesign/tokens.js';
import { IconDownload } from '../redesign/icons.jsx';
import { MESSAGES } from '../../../utils/constants.js';

function formatBytes(b) {
  if (b == null) return null;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(2)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n) : null; };

// Guarded: encodeURIComponent throws a URIError on a lone UTF-16 surrogate, which arbitrary
// page markup can contain — degrade to no preview rather than crash the render.
function svgDataUri(markup) {
  if (!markup) return null;
  try { return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`; }
  catch { return null; }
}

// A stacked property: muted label over a bright value (per the Figma image design).
function Prop({ label, value }) {
  return (
    <div style={{ paddingBottom: 14 }}>
      <div style={{ fontFamily: FONT.mono, fontSize: 13, color: COLOR.foregroundLabel, marginBottom: 4, lineHeight: '17px' }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT.mono, fontSize: 16, fontWeight: 500, color: COLOR.foreground, lineHeight: '20px' }}>
        {value}
      </div>
    </div>
  );
}

function ImageSection({ image }) {
  const [fileSize, setFileSize] = useState(null);
  const [previewError, setPreviewError] = useState(false);
  // The real asset URL (img / background) — used for the byte-size fetch + download.
  const src = image?.src || image?.url || null;
  // A previewable source for EVERY visual type: url (img/bg) · dataUrl (canvas) · poster
  // (video) · serialized markup as a data URI (inline svg).
  const previewSrc = src || image?.dataUrl || image?.poster || svgDataUri(image?.markup) || null;

  // Reset the load-error flag whenever the previewed source changes (any type).
  useEffect(() => { setPreviewError(false); }, [previewSrc]);

  // Best-effort byte size — CORS may block; aborted on src change so rapid switching
  // doesn't leave stale full-image downloads in flight. Only real URLs are fetchable.
  useEffect(() => {
    setFileSize(null);
    if (!src) return;
    const ctrl = new AbortController();
    fetch(src, { signal: ctrl.signal })
      .then(r => (r.ok ? r.blob() : null))
      .then(b => { if (b) setFileSize(b.size); })
      .catch(() => { /* CORS / aborted / network — no file size */ });
    return () => ctrl.abort();
  }, [src]);

  if (!image) return null;

  // naturalWidth/Height are numbers (img/svg); renderedWidth/Height are "120px" strings.
  const w = num(image.naturalWidth) || num(image.renderedWidth);
  const h = num(image.naturalHeight) || num(image.renderedHeight);
  const dimensions = w && h ? `${w}×${h} px` : null;
  const isBg = image.type === 'background-image';

  const handleDownload = () => {
    window.parent.postMessage({ type: MESSAGES.DOWNLOAD_IMAGE, imageType: image.type }, '*');
  };

  return (
    <div style={{ padding: '2px 16px 16px' }}>
      {/* Preview — checkerboard behind it so transparency reads. Covers every visual type
          (img · background · svg · canvas · video poster); hidden only when nothing is
          resolvable (e.g. a tainted canvas) or the source fails to load. */}
      {previewSrc && !previewError && (
        <div style={{
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxHeight: 200,
          borderRadius: 8,
          overflow: 'hidden',
          border: `1px solid ${COLOR.border}`,
          backgroundColor: COLOR.surface,
          backgroundImage:
            'linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%),' +
            'linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25%),' +
            'linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.06) 75%),' +
            'linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.06) 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
        }}>
          <img
            src={previewSrc}
            alt={image.alt || ''}
            onError={() => setPreviewError(true)}
            style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', display: 'block' }}
          />
        </div>
      )}

      {fileSize != null && <Prop label="File size" value={formatBytes(fileSize)} />}
      {dimensions && <Prop label="Dimensions" value={dimensions} />}
      {isBg && image.backgroundSize && <Prop label="Size" value={image.backgroundSize} />}
      {isBg && image.backgroundPosition && <Prop label="Position" value={image.backgroundPosition} />}

      <button
        type="button"
        onClick={handleDownload}
        className="awd-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          height: 40,
          padding: '0 16px',
          borderRadius: 8,
          background: COLOR.surface,
          border: `1px solid ${COLOR.borderStrong}`,
          color: COLOR.foreground,
          cursor: 'pointer',
        }}
      >
        <IconDownload size={20} stroke={1.75} />
        <span style={{ fontFamily: FONT.display, fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap' }}>
          Download Asset
        </span>
      </button>
    </div>
  );
}

export default ImageSection;
