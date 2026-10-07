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
        sans: ['Montserrat', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        // Preserved JFCM-SL Core Brand Identity & Intuitive Progression
        brand: {
          DEFAULT: '#2D5A27',
          dark: '#23481F',
          light: '#E5EEE3',
          bg: '#F4F6F4',
          border: '#E7EBE7',
          bright: '#10B981',
          glow: '#34D399',
          soft: '#D1FAE5',
          darkBg: '#0A0C0B',
          darkSurface: '#121513',
          darkElevated: '#171B19',
          darkBorder: '#252B28',
        },
        // Premium Light Mode Hierarchy
        light: {
          bg: '#F4F6F4',
          surface: '#FFFFFF',
          elevated: '#FAFCFA',
          floating: '#F0F3F0',
          soft: '#E7EBE7',
          border: '#E7EBE7',
          borderStrong: '#D1D5DB',
          text: '#1E293B',
          textSecondary: '#64748B',
          textMuted: '#94A3B8',
        },
        // Premium Dark Mode Hierarchy
        dark: {
          bg: '#0A0C0B',
          surface: '#121513',
          elevated: '#171B19',
          floating: '#1C211F',
          soft: '#252B28',
          border: '#252B28',
          borderStrong: '#3A423E',
          text: '#F8FAF9',
          textSecondary: '#94A3B8',
          textMuted: '#64748B',
        },
        // Strict Semantic Status System (with cohesive Cyan/Teal info)
        status: {
          success: { DEFAULT: '#10B981', dark: '#047857', soft: '#D1FAE5' },
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