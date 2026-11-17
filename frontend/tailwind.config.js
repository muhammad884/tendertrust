/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0B1220",
          800: "#111A2E",
          700: "#1B2740",
          600: "#2A3957",
          500: "#5B6B8C",
          300: "#A9B4CC",
          100: "#E6EAF3",
        },
        trust: { 600: "#0E9F8E", 500: "#14B8A6", 400: "#2DD4BF" },
      },
    },
  },
  plugins: [],
};
