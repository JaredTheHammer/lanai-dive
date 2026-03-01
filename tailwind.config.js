/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: '#e6f4fa',
          100: '#c0e4f3',
          200: '#96d3ec',
          300: '#6bc1e4',
          400: '#4bb3de',
          500: '#2ba5d8',
          600: '#2097c9',
          700: '#1484b4',
          800: '#0a729f',
          900: '#00527c',
          950: '#0c1929'
        },
        score: {
          excellent: '#22c55e',
          good: '#84cc16',
          fair: '#eab308',
          poor: '#f97316',
          dangerous: '#ef4444'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
};
