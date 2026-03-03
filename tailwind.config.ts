import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563eb",
          foreground: "#ffffff"
        },
        danger: {
          DEFAULT: "#ef4444",
          foreground: "#fef2f2"
        },
        pneuma: {
          red: "#E11D48",
          "red-hover": "#b01838"
        }
      }
    }
  },
  plugins: []
};

export default config;

