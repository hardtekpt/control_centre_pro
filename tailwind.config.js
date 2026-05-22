/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/src/**/*.{js,ts,jsx,tsx}',
    './src/renderer/index.html',
    './src/webClient/**/*.{js,ts,jsx,tsx}',
    './src/webClient/index.html',
  ],
  // Dark mode is toggled via the data-theme="dark" attribute on <html>
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      transitionDuration: {
        fast: '100ms',
        normal: '150ms',
        slow: '200ms',
        page: 'var(--anim-page-duration)'
      }
    }
  },
  plugins: []
}
