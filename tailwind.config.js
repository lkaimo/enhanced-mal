export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: {
      // rgb channel variables (see index.css) so opacity utilities like bg-background/75 actually work
      background: 'rgb(var(--rgb-background) / <alpha-value>)', surface: 'rgb(var(--rgb-surface) / <alpha-value>)',
      primary: 'rgb(var(--rgb-primary) / <alpha-value>)', secondary: 'rgb(var(--rgb-secondary) / <alpha-value>)', tertiary: 'rgb(var(--rgb-tertiary) / <alpha-value>)',
      ink: 'rgb(var(--rgb-text-primary) / <alpha-value>)', muted: 'rgb(var(--rgb-text-secondary) / <alpha-value>)', line: 'var(--color-border)'
    },
    fontFamily: { display: ['"Bricolage Grotesque"','system-ui','sans-serif'], sans: ['"DM Sans"','system-ui','sans-serif'] }
  } }
}
