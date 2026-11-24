/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: { DEFAULT: token("surface"), 2: token("surface-2") },
        line: { DEFAULT: token("line"), strong: token("line-strong") },
        ink: { DEFAULT: token("ink"), 2: token("ink-2") },
        muted: { DEFAULT: token("muted"), faint: token("faint") },
        faint: token("faint"),
        brand: { DEFAULT: token("brand"), strong: token("brand-strong"), soft: token("brand-soft"), on: token("on-brand") },
        good: { DEFAULT: token("good"), soft: token("good-soft") },
        info: { DEFAULT: token("info"), soft: token("info-soft") },
        warn: { DEFAULT: token("warn"), soft: token("warn-soft") },
        bad: { DEFAULT: token("bad"), soft: token("bad-soft") },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ['"JetBrains Mono Variable"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.05), 0 8px 24px -8px rgb(var(--shadow) / 0.08)",
        pop: "0 12px 40px -8px rgb(var(--shadow) / 0.25)",
      },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        slide: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(320%)" } },
      },
      animation: {
        rise: "rise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        slide: "slide 1.3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
