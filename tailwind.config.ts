import type { Config } from 'tailwindcss';

const config: Config = {
  // Emit hover: styles only under @media (hover: hover), so tapping on a
  // phone doesn't leave cards and buttons stuck in their hover state.
  future: { hoverOnlyWhenSupported: true },
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#f04a22',
          orangeHover: '#ff5c34',
          bg: '#0d0c0b',
          panel: '#141210',
          text: '#f5f5f0',
          textSecondary: '#c9c5bf',
          textMuted: '#9a9a9a',
          textFaint: '#7a7772',
          raised: '#1c1a17',
          // Podium + trend colors, tuned to sit on the warm near-black surfaces.
          gold: '#f2c14e',
          silver: '#d6d3cd',
          bronze: '#cd8a4f',
          up: '#5bd18b',
          down: '#ff5d5d',
          raisedHover: '#26231f',
        },
      },
      // One shadow, reserved for layers that float over content (popovers,
      // the cart). Everything else gets depth from surface color, not shadow.
      boxShadow: {
        float: '0 16px 40px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      },
      fontFamily: {
        display: ['var(--font-anton)'],
        sans: ['var(--font-barlow)'],
      },
    },
  },
  plugins: [],
};
export default config;
