/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './app.js'],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0a0a0f',
          card: '#12121a',
          border: '#1e1e2e',
          neon: '#00f5ff',
          pink: '#ff2d78',
          purple: '#a855f7',
          green: '#39ff14',
          yellow: '#ffd700',
        },
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 8px #00f5ff, 0 0 20px #00f5ff44',
        pink: '0 0 8px #ff2d78, 0 0 20px #ff2d7844',
        purple: '0 0 8px #a855f7, 0 0 20px #a855f744',
      },
    },
  },
  plugins: [],
};