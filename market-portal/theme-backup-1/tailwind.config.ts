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
        glow: "0 0 40px -10px rgba(34, 211, 238, 0.4)",
        "glow-violet": "0 0 40px -10px rgba(167, 139, 250, 0.35)",
      },
      animation: {
        "pulse-slow": "pulseSlow 3s ease-in-out infinite",
        "border-flow": "borderGlow 4s ease-in-out infinite",
      },
      keyframes: {
        pulseSlow: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        borderGlow: {
          "0%, 100%": { borderColor: "rgba(34, 211, 238, 0.2)" },
          "50%": { borderColor: "rgba(34, 211, 238, 0.45)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
