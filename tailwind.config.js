/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        bg: {
          dark: 'rgb(var(--bg-dark) / <alpha-value>)',
          card: 'rgb(var(--bg-card) / <alpha-value>)',
          deep: 'rgb(var(--bg-deep) / <alpha-value>)',
        },
        accent:  'rgb(var(--accent)  / <alpha-value>)',
        muted:   'rgb(var(--muted)   / <alpha-value>)',
        subtle:  'rgb(var(--subtle)  / <alpha-value>)',
        // 'white' 오버라이드 → 테마에 따른 주 텍스트 색상
        white:   'rgb(var(--text-primary) / <alpha-value>)',
      }
    }
  },
  plugins: []
}
