/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#0e0e12',
        card: '#17171d',
        'card-raised': '#1d1d24',
        line: 'rgba(255,255,255,0.10)',
        field: 'rgba(255,255,255,0.06)',
        primary: {
          DEFAULT: '#fbbf24',
          foreground: '#251a02',
        },
        muted: {
          DEFAULT: '#232329',
          foreground: '#a1a1ab',
        },
        destructive: '#f87171',
      },
    },
  },
  plugins: [],
}
