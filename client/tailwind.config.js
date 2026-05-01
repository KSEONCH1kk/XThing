/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Чисто-монохромная палитра. Никаких цветных акцентов.
        bg: {
          primary: "#000000",
          secondary: "#0a0a0a",
          card: "#141414",
          elevated: "#1c1c1c",
        },
        ink: {
          0: "#ffffff",
          1: "#e7e7e7",
          2: "#a8a8a8",
          3: "#6a6a6a",
          4: "#3a3a3a",
        },
        line: {
          DEFAULT: "rgba(255,255,255,0.08)",
          strong: "rgba(255,255,255,0.16)",
          bright: "rgba(255,255,255,0.32)",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: {
        field: "10px",
        card: "14px",
        modal: "20px",
      },
      boxShadow: {
        // Только белое/чёрное: тонкая подсветка контура и глубокая тень карточек.
        ringSoft: "0 0 0 1px rgba(255,255,255,0.08)",
        ringStrong: "0 0 0 1px rgba(255,255,255,0.24)",
        glow: "0 0 32px rgba(255,255,255,0.10)",
        glowStrong: "0 0 48px rgba(255,255,255,0.18)",
        card: "0 8px 32px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04) inset",
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
      },
      animation: {
        shake: "shake 0.4s ease-in-out",
      },
    },
  },
  plugins: [],
};
