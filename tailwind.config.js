// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // ✅ Already enabled - perfect!
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Your existing colors - KEPT
        primary: {
          DEFAULT: '#3B82F6',
          light: '#DBEAFE',
          hover: '#2563EB',
          dark: '#1E40AF',
        },
        success: '#10B981',
        
        // OPTIONAL: Add dark mode specific colors
        // (You can use Tailwind's defaults or add these for more control)
        dark: {
          bg: '#0f172a',           // Main background
          surface: '#1e293b',      // Cards, panels
          border: '#334155',       // Borders
          text: '#e2e8f0',         // Primary text
          'text-muted': '#94a3b8', // Secondary text
        }
      },
      boxShadow: {
        // Your existing shadows - KEPT
        'card': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 8px 24px rgba(59, 130, 246, 0.15)',
        'card-3d': '0 10px 30px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08)',
        'inner-light': 'inset 0 2px 4px rgba(255, 255, 255, 0.1)',
      },
      animation: {
        // Your existing animations - KEPT
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        // Your existing keyframes - KEPT
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}