import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "fs-glow": "0 0 40px -8px rgba(239, 68, 68, 0.35)",
        "fs-glow-sm": "0 0 24px -6px rgba(239, 68, 68, 0.25)",
      },
      keyframes: {
        "fs-shimmer": {
          "0%": { backgroundPosition: "-120% 0" },
          "100%": { backgroundPosition: "220% 0" },
        },
        "fs-pulse-soft": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fs-shimmer": "fs-shimmer 2.2s ease-in-out infinite",
        "fs-pulse-soft": "fs-pulse-soft 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
