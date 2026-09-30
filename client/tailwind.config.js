/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#ecf7f5', 100: '#d5eeea', 500: '#1f9a86', 600: '#178471', 700: '#126b5c', 900: '#0d3f37' },
        ink: { DEFAULT: '#0f1f1d', soft: '#5b6b68', mute: '#8a9895' },
        canvas: '#f5f8f7',
        line: '#e4ebe9',
      },
      boxShadow: { card: '0 1px 2px rgba(15,31,29,0.04), 0 1px 1px rgba(15,31,29,0.02)' },
    },
  },
  plugins: [],
};
