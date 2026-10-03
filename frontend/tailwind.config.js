/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Be Vietnam Pro"', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        pink: {
          50: '#fff1f4', 100: '#ffe0e8', 200: '#ffc2d2', 300: '#ff94b0', 400: '#f9648f',
          500: '#ec3f72', 600: '#d12460', 700: '#ae1850', 800: '#8a1642', 900: '#6e1538',
        },
        ink: { DEFAULT: '#3b2430', soft: '#7a6670' },
        blush: '#fff8f9',
        line: '#f3dde3',
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        soft: '0 2px 16px -4px rgba(209, 36, 96, 0.12)',
        lift: '0 12px 32px -12px rgba(209, 36, 96, 0.28)',
      },
    },
  },
  plugins: [],
}
