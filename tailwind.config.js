/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#2D5A27',
          dark: '#23481F',
          light: '#E5EEE3',
          bg: '#F4F6F4',
          border: '#E7EBE7',
          darkBg: '#0A0A0A',       // True Premium Black background
          darkSurface: '#121212',  // Deep dark gray/black card surface
          darkElevated: '#18181B', // Elevated modal surface
          darkBorder: '#27272A',   // Refined low-contrast border
        }
      },
      maxWidth: {
        'workspace': '1400px',
      }
    },
  },
  plugins: [],
}