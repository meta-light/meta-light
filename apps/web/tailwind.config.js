/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}', // Update this to match your project structure
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'media',
  theme: {
    extend: {
      // Palette for the /strudel player, mapped onto the house neutrals the rest
      // of the site already uses (see src/app/page.tsx): true black ground,
      // gray-800 hairlines, gray-100 text. Green-500 is the single accent and is
      // reserved for live/playing/selected; orange-500 marks unsaved or
      // destructive actions. Everything else is neutral gray.
      //
      // Hex literals rather than var(--x) so that opacity modifiers
      // (bg-acid/10, border-line/40) resolve under v3. Mirrored into the :root
      // block in src/app/strudel/globals.css, which is what the canvas code
      // reads via getComputedStyle.
      //
      // Token names are inherited from the player's original acid/olive theme.
      // Note `acid-dim` is now a neutral gray-600: it marks interactive and
      // active affordances, not a dimmer green.
      colors: {
        background: '#000000', //   black     — page ground
        surface: '#030712', //      gray-950  — chrome bars
        'surface-2': '#111827', //  gray-900  — controls, raised panels
        line: '#1f2937', //         gray-800  — default hairline
        'line-bright': '#374151', // gray-700 — emphasis hairline, inert LED
        text: '#f3f4f6', //         gray-100
        'text-dim': '#9ca3af', //   gray-400
        'text-faint': '#6b7280', // gray-500
        acid: '#22c55e', //         green-500 — live / playing / selected
        'acid-dim': '#4b5563', //   gray-600  — hover + active borders
        'acid-deep': '#052e16', //  green-950 — selection fill
        ember: '#f97316', //        orange-500 — unsaved, solo, destructive
        'ember-dim': '#9a3412', //  orange-800
      },
      // `display` only. fontFamily.mono is deliberately left at the Tailwind
      // default -- 13 pre-merge files use font-mono and must not change.
      fontFamily: {
        display: ['var(--font-unbounded)', 'sans-serif'],
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};