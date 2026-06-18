/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces — deep ink, not pure black.
        ink: { DEFAULT: '#090a0f', 900: '#0a0c12', 800: '#0f111a', 700: '#151826', 600: '#1c2031' },
        edge: '#272c3e',
        edgesoft: '#1d2130',
        text: '#e8eaf3',
        mute: '#9aa0b6',
        ghost: '#5d6379',
        // Semantic node colours.
        agent: '#2dd4bf',
        felt: '#0c2a24',
        tabletone: '#f5b942',
        service: '#a78bfa',
        // Fee-type tints (consistent everywhere).
        seat: '#5eead4',
        hand: '#fbbf24',
        action: '#a3e635',
        svcfee: '#c084fc',
        // Status.
        ok: '#34d399',
        warn: '#fbbf24',
        bad: '#fb7185',
        neon: '#38e0c8',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(56,224,200,0.12), 0 0 28px -8px rgba(56,224,200,0.30)',
        panel: '0 18px 50px -28px rgba(0,0,0,0.85)',
        soft: '0 1px 0 0 rgba(255,255,255,0.03) inset',
      },
      keyframes: {
        dash: { to: { strokeDashoffset: '-32' } },
        pulseGlow: { '0%,100%': { opacity: '0.45' }, '50%': { opacity: '1' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-3px)' } },
        risein: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        sweep: { '100%': { transform: 'translateX(180%)' } },
      },
      animation: {
        dash: 'dash 1.1s linear infinite',
        pulseGlow: 'pulseGlow 2.2s ease-in-out infinite',
        floaty: 'floaty 4s ease-in-out infinite',
        risein: 'risein 0.35s ease-out',
      },
    },
  },
  plugins: [],
};
