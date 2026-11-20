/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 950: '#030b24', 900: '#06153d', 800: '#0a2159', 700: '#0d2c78' },
        royal: { 700: '#123fb0', 600: '#1650d6', 500: '#2a6af0', 400: '#4f8bff', 300: '#86b0ff' },
        gold: { 600: '#b8860b', 500: '#d4a72c', 400: '#f2c94c', 300: '#ffe08a', 200: '#fff1c4' },
      },
      fontFamily: {
        display: ['Montserrat', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        script: ['"Dancing Script"', 'cursive'],
      },
      keyframes: {
        rise: { '0%': { transform: 'translateY(0) scale(.6)', opacity: '0' }, '10%': { opacity: '1' }, '100%': { transform: 'translateY(-85vh) scale(1.3)', opacity: '0' } },
        fadeUp: { '0%': { transform: 'translateY(24px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pop: { '0%': { transform: 'scale(.7)', opacity: '0' }, '60%': { transform: 'scale(1.06)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        kenburns: { '0%': { transform: 'scale(1)' }, '100%': { transform: 'scale(1.08)' } },
        pulseRing: { '0%': { transform: 'scale(.9)', opacity: '.7' }, '100%': { transform: 'scale(1.6)', opacity: '0' } },
        confetti: { '0%': { transform: 'translateY(-10vh) rotate(0)' }, '100%': { transform: 'translateY(110vh) rotate(720deg)' } },
      },
      animation: {
        rise: 'rise 4s ease-out forwards',
        fadeUp: 'fadeUp .7s cubic-bezier(.2,.8,.2,1) both',
        pop: 'pop .6s cubic-bezier(.2,.8,.2,1) both',
        shimmer: 'shimmer 3s linear infinite',
        float: 'float 4s ease-in-out infinite',
        kenburns: 'kenburns 14s ease-out both',
        pulseRing: 'pulseRing 2s ease-out infinite',
        confetti: 'confetti linear forwards',
      },
    },
  },
  plugins: [],
}
