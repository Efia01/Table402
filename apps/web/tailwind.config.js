/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Maison 402 palette — sampled from the locked swatches ──────
        // Warm near-black + a violet-tinged charcoal for depth.
        noir: { DEFAULT: '#160d0e', 900: '#0c0708', 800: '#1c1214', 700: '#241921', 600: '#2e2129' },
        // Pure paper white + warm bone for elegant ivory text.
        bone: { DEFAULT: '#f4efe7', dim: '#b3a99c', faint: '#7d7269' },
        // The one bright accent (swatch #e3344b) over deep maison maroon.
        crimson: { DEFAULT: '#c8202f', bright: '#e3344b', deep: '#86131d', dark: '#4e0e13', soft: '#d8606b' },
        // Pure highlight white + true ink, used liberally against the reddish-black.
        paper: { DEFAULT: '#ffffff', dim: '#f3f0ea' },
        coal: '#16100f',
        // Warm amber spotlight glow.
        ember: { DEFAULT: '#e7a23c', soft: '#f3cd8c' },
        // Maison felt green (swatch #15694a).
        table: { DEFAULT: '#15694a', light: '#1d8159', dark: '#0c3d2c', rail: '#3a2017' },
        hairline: 'rgba(244,239,231,0.12)',

        // ── Legacy tokens (kept so non-redesigned pages still render) ──
        ink: { DEFAULT: '#0e0809', 900: '#0a0506', 800: '#150d0f', 700: '#1d1316', 600: '#271a1d' },
        edge: '#2a1d20',
        edgesoft: '#1f1417',
        text: '#ece3d6',
        mute: '#b3a99c',
        ghost: '#766c61',
        agent: '#2dd4bf',
        felt: '#0c2a24',
        tabletone: '#e7a23c',
        service: '#a78bfa',
        seat: '#5eead4',
        hand: '#fbbf24',
        action: '#a3e635',
        svcfee: '#c084fc',
        ok: '#34d399',
        warn: '#fbbf24',
        bad: '#fb7185',
        neon: '#e2334a',
      },
      fontFamily: {
        // Bodoni Moda → display headlines & numerals.
        display: ['"Bodoni Moda"', 'Didot', 'Georgia', 'Cambria', 'serif'],
        // Inter Tight → actual paragraph / body copy.
        sans: ['"Inter Tight"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        // Space Mono → eyebrows, labels, stats, buttons (the "technical" voice).
        mono: ['"Space Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: { widest2: '0.32em', widest3: '0.45em' },
      // Edgy, elegant — sharp but not square. Pills (full) kept for dots only.
      borderRadius: {
        none: '0px',
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
        lg: '5px',
        xl: '7px',
        '2xl': '9px',
        '3xl': '12px',
        full: '9999px',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(200,32,47,0.10), 0 0 30px -8px rgba(200,32,47,0.35)',
        ember: '0 0 60px -12px rgba(231,162,60,0.45)',
        panel: '0 24px 70px -36px rgba(0,0,0,0.9)',
        rail: 'inset 0 0 0 1px rgba(231,162,60,0.16), inset 0 0 120px rgba(0,0,0,0.55)',
      },
      keyframes: {
        flicker: {
          '0%,100%': { opacity: '1' },
          '45%': { opacity: '0.93' },
          '47%': { opacity: '0.78' },
          '49%': { opacity: '0.95' },
        },
        pulseGlow: { '0%,100%': { opacity: '0.5' }, '50%': { opacity: '1' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-3px)' } },
        risein: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        dash: { to: { strokeDashoffset: '-32' } },
      },
      animation: {
        flicker: 'flicker 6s ease-in-out infinite',
        pulseGlow: 'pulseGlow 2.2s ease-in-out infinite',
        floaty: 'floaty 4s ease-in-out infinite',
        risein: 'risein 0.5s ease-out both',
        dash: 'dash 1.1s linear infinite',
      },
    },
  },
  plugins: [],
};
