// Tokens first, then styles — same order as main.jsx. Without tokens.css every
// var(--…) resolves to nothing and stories render untokenised (black-on-nothing).
// awwdits is dark-only, so importing this is all it takes to match the panel.
import '../src/sidebar/tokens.css';
import '../src/sidebar/styles.css';

// Redesign fonts. The plugin currently ships Geist Mono only; the new direction
// adds Gentium Book Basic (display/headings) and Geist (body/UI).
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href =
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600;700&family=Gentium+Book+Basic:ital,wght@0,400;0,700;1,400;1,700&display=swap';
document.head.appendChild(fontLink);

/** @type {import('@storybook/react').Preview} */
const preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      default: 'panel',
      values: [
        { name: 'panel', value: '#313131' },
        { name: 'page', value: '#0f0f0f' },
      ],
    },
    layout: 'centered',
  },
};

export default preview;
