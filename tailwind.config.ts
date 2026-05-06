import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          teal:   '#00d2d4',
          purple: '#6a2898',
          orange: '#ff8d00',
          yellow: '#f9bd00',
          pink:   '#f094bf',
          ink:    '#1a1a1a',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted:   '#f5f5f5',
          border:  '#e5e7eb',
        },
      },
      fontFamily: {
        heading: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
        body:    ['var(--font-inter)', 'system-ui', 'sans-serif'],
        sans:    ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
