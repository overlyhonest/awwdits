import { useState, useCallback, useRef, useEffect } from 'react';
import { COLOR } from '../redesign/tokens.js';
import { IconCheck } from '../redesign/icons.jsx';
import { copyText } from '../redesign/clipboard.js';

// A value the user can click (or Enter/Space) to copy. The whole point of an
// inspector is grabbing values, so every hex / px / token / identifier wears one.
// Resting state is plain text; the ".awd-copy" class in styles.css supplies the
// quiet hover lift. On copy the value briefly earns a green check.
export function CopyValue({ value, children, copyText: copyOverride, style, title }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  const text = copyOverride ?? value ?? (typeof children === 'string' ? children : '');

  useEffect(() => () => clearTimeout(timer.current), []);

  const doCopy = useCallback((e) => {
    e.stopPropagation();
    copyText(text);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1100);
  }, [text]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      doCopy(e);
    }
  }, [doCopy]);

  return (
    <span
      className="awd-copy"
      role="button"
      tabIndex={0}
      title={copied ? 'Copied' : `Copy ${text}`}
      aria-label={`Copy ${text}`}
      onClick={doCopy}
      onKeyDown={onKeyDown}
      style={{ cursor: 'pointer', borderRadius: 4, ...style }}
    >
      {children ?? value}
      {copied && (
        <IconCheck
          size={12}
          stroke={2.25}
          style={{ marginLeft: 4, verticalAlign: 'middle', color: COLOR.success, flexShrink: 0 }}
        />
      )}
    </span>
  );
}

export default CopyValue;
