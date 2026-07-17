import { FONT, COLOR } from './tokens.js';

const TABS = [
  { id: 'inspect', label: 'Inspect' },
  { id: 'health', label: 'Health' },
];

// Bottom tab bar — Figma nodes 2093:1265 (dark) / 2093:1222 (light): 8px padding,
// 1px top border, two equal 40px text-only tabs (12px gap, no icons). Active tab is
// a neutral raised pill (surface) with foreground label; inactive is transparent +
// muted. Special Gothic Expanded One labels; no accent color here.
function TabBar({ active = 'inspect', onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        flexShrink: 0,
        padding: 8,
        borderTop: `1px solid ${COLOR.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange?.(tab.id)}
              className={isActive ? 'awd-nav' : 'awd-tab awd-nav'}
              style={{
                display: 'flex',
                flex: 1,
                minWidth: 0,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 12,
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                background: isActive ? COLOR.surface : 'transparent',
                fontFamily: FONT.display,
              }}
            >
              <span style={{
                fontFamily: FONT.display,
                fontSize: 12,
                whiteSpace: 'nowrap',
                color: isActive ? COLOR.foreground : COLOR.foregroundLabel,
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TabBar;
