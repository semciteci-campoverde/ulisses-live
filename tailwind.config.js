/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#071433',
        royal: '#1347e6',
        gold: '#f0c14d',
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        display: ['"Bebas Neue"', 'Impact', 'sans-serif'],
        script: ['"Great Vibes"', 'cursive'],
        cinzel: ['Cinzel', 'serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(240, 193, 77, 0.28)',
        royal: '0 20px 60px rgba(8, 20, 70, 0.45)',
      },
    },
  },
  plugins: [],
}
