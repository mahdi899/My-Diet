/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: 'rgb(var(--site-forest, 21 62 53) / <alpha-value>)', deep: 'rgb(var(--site-forest-deep, 18 54 46) / <alpha-value>)' },
        green: { DEFAULT: 'rgb(var(--site-green, 35 106 77) / <alpha-value>)', hover: 'rgb(var(--site-green-hover, 25 86 61) / <alpha-value>)' },
        mint: { DEFAULT: 'rgb(var(--site-mint, 216 233 201) / <alpha-value>)', bright: 'rgb(var(--site-mint-bright, 201 226 181) / <alpha-value>)' },
        sage: 'rgb(var(--site-sage, 234 241 220) / <alpha-value>)',
        pine: 'rgb(var(--site-pine, 32 86 56) / <alpha-value>)',
        cream: 'rgb(var(--site-cream, 247 248 240) / <alpha-value>)',
        ink: 'rgb(var(--site-ink, 35 60 45) / <alpha-value>)',
        muted: 'rgb(var(--site-muted, 118 131 110) / <alpha-value>)',
        line: { DEFAULT: 'rgb(var(--site-line, 227 232 223) / <alpha-value>)', strong: 'rgb(var(--site-line-strong, 181 192 179) / <alpha-value>)' },
        soft: 'rgb(var(--site-soft, 240 244 236) / <alpha-value>)',
        danger: { DEFAULT: 'rgb(var(--site-danger, 164 59 59) / <alpha-value>)', soft: 'rgb(var(--site-danger-soft, 255 240 239) / <alpha-value>)' },
        amber: { DEFAULT: 'rgb(var(--site-amber, 139 96 32) / <alpha-value>)', soft: 'rgb(var(--site-amber-soft, 251 242 224) / <alpha-value>)' },
        blue: { DEFAULT: 'rgb(var(--site-blue, 59 98 137) / <alpha-value>)', soft: 'rgb(var(--site-blue-soft, 237 243 250) / <alpha-value>)' },
      },
      opacity: { 12: '0.12', 15: '0.15', 85: '0.85', 94: '0.94', 96: '0.96' },
      fontFamily: {
        sans: ['var(--site-font-sans, Vazirmatn)', 'IRANSansX', 'Tahoma', 'sans-serif'],
      },
      borderRadius: {
        xs: '2px',
        'mydiet-sm': 'var(--site-radius-sm, 9px)',
        mydiet: '18px',
        'mydiet-lg': 'var(--site-radius-lg, 22px)',
      },
      // The public site uses the v4 theme; panel fallbacks keep their existing appearance.
      boxShadow: {
        sm: 'var(--site-shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))',
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        '2xs': '0 1px 0 0 rgb(0 0 0 / 0.05)',
      },
      scale: {
        104: '1.04',
        106: '1.06',
        108: '1.08',
      },
      spacing: {
        sidebar: '248px',
        4.5: '1.125rem',
        5.5: '1.375rem',
        6.5: '1.625rem',
        13: '3.25rem',
        15: '3.75rem',
        18: '4.5rem',
      },
    },
  },
  plugins: [],
}
