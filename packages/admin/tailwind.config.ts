import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["selector", "[data-theme='dark']"],
  theme: {
    extend: {
      colors: {
        // Semantic background tokens
        "bg-strong": "rgb(var(--bg-strong-950) / <alpha-value>)",
        "bg-surface": "rgb(var(--bg-surface-800) / <alpha-value>)",
        "bg-sub": "rgb(var(--bg-sub-300) / <alpha-value>)",
        "bg-soft": "rgb(var(--bg-soft-200) / <alpha-value>)",
        "bg-weak": "rgb(var(--bg-weak-50) / <alpha-value>)",
        "bg-white": "rgb(var(--bg-white-0) / <alpha-value>)",
        // Semantic text tokens
        "text-strong": "rgb(var(--text-strong-950) / <alpha-value>)",
        "text-sub": "rgb(var(--text-sub-600) / <alpha-value>)",
        "text-soft": "rgb(var(--text-soft-400) / <alpha-value>)",
        "text-disabled": "rgb(var(--text-disabled-300) / <alpha-value>)",
        // Semantic stroke tokens
        "stroke-strong": "rgb(var(--stroke-strong-950) / <alpha-value>)",
        "stroke-sub": "rgb(var(--stroke-sub-300) / <alpha-value>)",
        "stroke-soft": "rgb(var(--stroke-soft-200) / <alpha-value>)",
        // State color tokens
        "success-dark": "rgb(var(--success-dark) / <alpha-value>)",
        "success-base": "rgb(var(--success-base) / <alpha-value>)",
        "success-light": "rgb(var(--success-light) / <alpha-value>)",
        "success-lighter": "rgb(var(--success-lighter) / <alpha-value>)",
        "error-dark": "rgb(var(--error-dark) / <alpha-value>)",
        "error-base": "rgb(var(--error-base) / <alpha-value>)",
        "error-light": "rgb(var(--error-light) / <alpha-value>)",
        "error-lighter": "rgb(var(--error-lighter) / <alpha-value>)",
        "warning-dark": "rgb(var(--warning-dark) / <alpha-value>)",
        "warning-base": "rgb(var(--warning-base) / <alpha-value>)",
        "warning-light": "rgb(var(--warning-light) / <alpha-value>)",
        "warning-lighter": "rgb(var(--warning-lighter) / <alpha-value>)",
        "information-dark": "rgb(var(--information-dark) / <alpha-value>)",
        "information-base": "rgb(var(--information-base) / <alpha-value>)",
        "information-light": "rgb(var(--information-light) / <alpha-value>)",
        "information-lighter": "rgb(var(--information-lighter) / <alpha-value>)",
        // Gray scale from CSS variables
        gray: {
          950: "rgb(var(--gray-950) / <alpha-value>)",
          900: "rgb(var(--gray-900) / <alpha-value>)",
          800: "rgb(var(--gray-800) / <alpha-value>)",
          700: "rgb(var(--gray-700) / <alpha-value>)",
          600: "rgb(var(--gray-600) / <alpha-value>)",
          500: "rgb(var(--gray-500) / <alpha-value>)",
          400: "rgb(var(--gray-400) / <alpha-value>)",
          300: "rgb(var(--gray-300) / <alpha-value>)",
          200: "rgb(var(--gray-200) / <alpha-value>)",
          100: "rgb(var(--gray-100) / <alpha-value>)",
          50: "rgb(var(--gray-50) / <alpha-value>)",
        },
        // Keep existing green scale (brand color)
        green: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;