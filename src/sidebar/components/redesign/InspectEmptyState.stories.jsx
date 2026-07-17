import { useState } from 'react';
import InspectEmptyState from './InspectEmptyState.jsx';
import TabBar from './TabBar.jsx';
import { FONT, COLOR } from './tokens.js';

// A faithful stand-in for the extension sidebar panel: fixed 300px width to
// mirror the Figma frame, header + content + tab bar stacked vertically.
function Panel({ children, height = 695 }) {
  const [active, setActive] = useState('inspect');
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 300,
        height,
        background: COLOR.background,
        overflow: 'hidden',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      {/* Minimal header stand-in (the live header lives inline in App.jsx). */}
      <div style={{
        height: 52,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        borderBottom: `1px solid ${COLOR.border}`,
        fontFamily: FONT.sans,
        fontWeight: 700,
        fontSize: 16,
        color: COLOR.foreground,
      }}>
        awwdits
      </div>
      {children}
      <TabBar active={active} onChange={setActive} />
    </div>
  );
}

export default {
  title: 'Redesign/Inspect/EmptyState',
  component: InspectEmptyState,
  parameters: { layout: 'centered' },
};

// The full Figma node (2028:1201): header, empty state, and tab bar in the panel.
export const InPanel = {
  render: (args) => (
    <Panel>
      <InspectEmptyState {...args} />
    </Panel>
  ),
};

// The empty-state content on its own, on the panel surface.
export const ContentOnly = {
  render: (args) => (
    <div style={{ width: 300, height: 540, background: COLOR.background, display: 'flex' }}>
      <InspectEmptyState {...args} />
    </div>
  ),
};

// Windows / Linux variant — modifier key renders as "Ctrl".
export const WindowsModifier = {
  render: (args) => (
    <Panel>
      <InspectEmptyState {...args} mod="Ctrl" />
    </Panel>
  ),
};
