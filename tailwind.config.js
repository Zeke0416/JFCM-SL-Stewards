/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        display: ['Manrope', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Preserved JFCM-SL Core Brand Identity & Intuitive Progression
        brand: {
          DEFAULT: 'var(--action)',
          dark: 'var(--action-hover)',
          light: '#E7F0F5',
          bg: 'var(--canvas)',
          border: '#DEE5EC',
          bright: 'var(--accent)',
          glow: 'var(--accent)',
          soft: '#E0EDF4',
          darkBg: '#0D1118',
          darkSurface: '#151C26',
          darkElevated: '#1B2531',
          darkBorder: '#2B3948',
        },
        // Premium Light Mode Hierarchy
        light: {
          bg: 'var(--canvas)',
          surface: 'var(--surface)',
          elevated: 'var(--soft)',
          floating: 'var(--soft-strong)',
          soft: '#DEE5EC',
          border: '#DEE5EC',
          borderStrong: '#D1D5DB',
          text: 'var(--ink)',
          textSecondary: 'var(--muted)',
          textMuted: 'var(--faint)',
        },
        // Premium Dark Mode Hierarchy
        dark: {
          bg: 'var(--canvas)',
          surface: 'var(--surface)',
          elevated: 'var(--soft)',
          floating: 'var(--soft-strong)',
          soft: '#2B3948',
          border: '#2B3948',
          borderStrong: '#405064',
          text: 'var(--ink)',
          textSecondary: 'var(--muted)',
          textMuted: 'var(--faint)',
        },
        // Strict Semantic Status System (with cohesive Cyan/Teal info)
        status: {
          success: { DEFAULT: '#398067', dark: '#047857', soft: '#E0EDF4' },
          warning: { DEFAULT: '#F59E0B', dark: '#B45309', soft: '#FEF3C7' },
          danger:  { DEFAULT: '#EF4444', dark: '#B91C1C', soft: '#FEE2E2' },
          info:    { DEFAULT: '#22D3EE', dark: '#0891B2', soft: '#CFFAFE' },
        },
      },
      boxShadow: {
        'tech-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.05)',
        'tech': '0 8px 24px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.035)',
        'tech-lg': '0 20px 60px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'emerald-glow': '0 0 15px -3px rgba(16, 185, 129, 0.25)',
        'emerald-glow-lg': '0 0 25px -5px rgba(16, 185, 129, 0.35)',
      },
      backgroundImage: {
        'tech-grid': 'linear-gradient(to right, rgba(16, 185, 129, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(16, 185, 129, 0.04) 1px, transparent 1px)',
        'dark-grid': 'linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)'
      },
      backgroundSize: {
        'grid-sm': '24px 24px',
        'grid-lg': '48px 48px',
      },
      maxWidth: {
        'workspace': '1400px',
      }
    },
  },
  plugins: [],
}
