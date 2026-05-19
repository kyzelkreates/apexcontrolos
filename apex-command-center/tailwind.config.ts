import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './storage/**/*.{js,ts}',
    './lib/**/*.{js,ts}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './store/**/*.{js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        apex: {
          bg: '#050810',
          surface: '#0b0f1a',
          card: '#0f1521',
          border: '#1a2235',
          borderLight: '#243050',
          accent: '#0ea5e9',
          accentDim: '#0284c7',
          accentGlow: '#38bdf8',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          dangerDim: '#dc2626',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
          emerald: '#059669',
          orange: '#ea580c',
          text: '#e2e8f0',
          textMuted: '#64748b',
          textDim: '#94a3b8',
        },
      },
      backgroundImage: {
        'apex-gradient': 'linear-gradient(135deg, #050810 0%, #0b0f1a 100%)',
        'card-gradient': 'linear-gradient(135deg, #0f1521 0%, #0b0f1a 100%)',
        'accent-gradient': 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)',
        'success-gradient': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'danger-gradient': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'apex-card': '0 0 0 1px rgba(26,34,53,0.8), 0 4px 24px rgba(0,0,0,0.4)',
        'apex-glow': '0 0 20px rgba(14,165,233,0.15)',
        'apex-glow-strong': '0 0 40px rgba(14,165,233,0.3)',
        'success-glow': '0 0 20px rgba(16,185,129,0.15)',
        'danger-glow': '0 0 20px rgba(239,68,68,0.15)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(14,165,233,0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(14,165,233,0.3)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
