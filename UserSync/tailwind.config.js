/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './index.tsx', './App.tsx', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // UserSync accent (teal) kept as the primary; surfaces match the dark theme.
        brand: {
          DEFAULT: '#14b8a6',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      transitionDuration: {
        // Motion tokens (spec §11): fast for controls, view for tab/subview swaps.
        fast: '150ms',
        view: '300ms',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.96)' },
          to: { opacity: '1', transform: 'none' },
        },
        viewInRight: {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'none' },
        },
        viewInLeft: {
          from: { opacity: '0', transform: 'translateX(-24px)' },
          to: { opacity: '1', transform: 'none' },
        },
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease',
        'view-right': 'viewInRight 0.3s ease',
        'view-left': 'viewInLeft 0.3s ease',
        blink: 'blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
};
