/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: v("ink-900"),
          800: v("ink-800"),
          700: v("ink-700"),
          600: v("ink-600"),
          500: v("ink-500"),
          300: v("ink-300"),
          100: v("ink-100"),
        },
        trust: { 600: v("trust-600"), 500: v("trust-500"), 400: v("trust-400") },
      },
    },
  },
  plugins: [],
};
