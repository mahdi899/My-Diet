const preset = require('./packages/config/tailwind.config.js')

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [preset],
  content: [
    './apps/*/index.html',
    './apps/*/src/**/*.{js,ts,jsx,tsx}',
    './packages/shared/src/**/*.{js,ts,jsx,tsx}',
  ],
}
