import type { Config } from "tailwindcss";

const config: Config = {
  presets: [require("@aragon/ods/tailwind.config")],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/plugins/**/*.{js,ts,jsx,tsx,mdx}",
    "../aragon-ods-fork/dist/**/*.js",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "ellipse-35":
          "radial-gradient(50% 50% at 50% 50%, rgba(61, 136, 255, 0.14) 0%, rgba(207, 227, 255, 0.18) 100%)",
        "ellipse-36":
          "radial-gradient(50% 50% at 50% 50%, rgba(191, 255, 55, 0.11) 0%, rgba(189, 217, 255, 0.23) 100%)",
        "ellipse-34":
          "radial-gradient(50% 50% at 50% 50%, rgba(105, 164, 250, 0.65) 0%, rgba(207, 227, 255, 0.55) 100%)",
      },
      colors: {
        primary: {
          50: "rgb(var(--ods-color-primary-50) / <alpha-value>)",
          100: "rgb(var(--ods-color-primary-100) / <alpha-value>)",
          200: "rgb(var(--ods-color-primary-200) / <alpha-value>)",
          300: "rgb(var(--ods-color-primary-300) / <alpha-value>)",
          400: "rgb(var(--ods-color-primary-400) / <alpha-value>)",
          500: "rgb(var(--ods-color-primary-500) / <alpha-value>)",
          600: "rgb(var(--ods-color-primary-600) / <alpha-value>)",
          700: "rgb(var(--ods-color-primary-700) / <alpha-value>)",
          800: "rgb(var(--ods-color-primary-800) / <alpha-value>)",
          900: "rgb(var(--ods-color-primary-900) / <alpha-value>)",
        },

        warning: {
          100: "rgb(var(--ods-color-warning-100) / <alpha-value>)",
          200: "rgb(var(--ods-color-warning-200) / <alpha-value>)",
          300: "rgb(var(--ods-color-warning-300) / <alpha-value>)",
          400: "rgb(var(--ods-color-warning-400) / <alpha-value>)",
          500: "rgb(var(--ods-color-warning-500) / <alpha-value>)",
          600: "rgb(var(--ods-color-warning-600) / <alpha-value>)",
          700: "rgb(var(--ods-color-warning-700) / <alpha-value>)",
          800: "rgb(var(--ods-color-warning-800) / <alpha-value>)",
          900: "rgb(var(--ods-color-warning-900) / <alpha-value>)",
        },

        success: {
          100: "rgb(var(--ods-color-success-100) / <alpha-value>)",
          200: "rgb(var(--ods-color-success-200) / <alpha-value>)",
          300: "rgb(var(--ods-color-success-300) / <alpha-value>)",
          400: "rgb(var(--ods-color-success-400) / <alpha-value>)",
          500: "rgb(var(--ods-color-success-500) / <alpha-value>)",
          600: "rgb(var(--ods-color-success-600) / <alpha-value>)",
          700: "rgb(var(--ods-color-success-700) / <alpha-value>)",
          800: "rgb(var(--ods-color-success-800) / <alpha-value>)",
          900: "rgb(var(--ods-color-success-900) / <alpha-value>)",
        },

        critical: {
          100: "rgb(var(--ods-color-critical-100) / <alpha-value>)",
          200: "rgb(var(--ods-color-critical-200) / <alpha-value>)",
          300: "rgb(var(--ods-color-critical-300) / <alpha-value>)",
          400: "rgb(var(--ods-color-critical-400) / <alpha-value>)",
          500: "rgb(var(--ods-color-critical-500) / <alpha-value>)",
          600: "rgb(var(--ods-color-critical-600) / <alpha-value>)",
          700: "rgb(var(--ods-color-critical-700) / <alpha-value>)",
          800: "rgb(var(--ods-color-critical-800) / <alpha-value>)",
          900: "rgb(var(--ods-color-critical-900) / <alpha-value>)",
        },

        secondary: {
          100: "rgb(var(--ods-color-secondary-100) / <alpha-value>)",
          200: "rgb(var(--ods-color-secondary-200) / <alpha-value>)",
          300: "rgb(var(--ods-color-secondary-300) / <alpha-value>)",
          400: "rgb(var(--ods-color-secondary-400) / <alpha-value>)",
          500: "rgb(var(--ods-color-secondary-500) / <alpha-value>)",
          600: "rgb(var(--ods-color-secondary-600) / <alpha-value>)",
          700: "rgb(var(--ods-color-secondary-700) / <alpha-value>)",
          800: "rgb(var(--ods-color-secondary-800) / <alpha-value>)",
          900: "rgb(var(--ods-color-secondary-900) / <alpha-value>)",
        },
      },
    },
  },
};
export default config;
