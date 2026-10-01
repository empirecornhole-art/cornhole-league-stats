import type { Config } from 'tailwindcss';

const config: Config = {
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
          raisedHover: '#26231f',
        },
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
