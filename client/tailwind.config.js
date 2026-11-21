/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    screens: { sm: '480px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    extend: {
      colors: {
        ivory: v('ivory'),
        paper: v('paper'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        maroon: v('maroon'),
        gold: v('gold'),
        sage: v('sage'),
        blush: v('blush'),
        danger: v('danger'),
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        // fluid display sizes (clamp up to ~9rem on desktop)
        'd-1': ['clamp(3.4rem, 11vw, 9rem)', { lineHeight: '0.92', letterSpacing: '-0.02em' }],
        'd-2': ['clamp(2.6rem, 7vw, 5.75rem)', { lineHeight: '0.98', letterSpacing: '-0.015em' }],
        'd-3': ['clamp(2rem, 4.6vw, 3.6rem)', { lineHeight: '1.02', letterSpacing: '-0.01em' }],
        'd-4': ['clamp(1.6rem, 3vw, 2.4rem)', { lineHeight: '1.1' }],
      },
      borderRadius: { card: '18px', sheet: '24px' },
      transitionTimingFunction: { silk: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      transitionDuration: { 600: '600ms', 900: '900ms', 1200: '1200ms' },
      maxWidth: { page: '1440px' },
    },
  },
  plugins: [],
};
